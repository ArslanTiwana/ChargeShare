import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createBookingSchema, listBookingsQuerySchema } from '@/shared/src';
import { getWalletBalance } from '@/lib/wallet';
import { lazyExpireBookings } from '@/lib/booking-state';
import { AppError, ForbiddenError } from '@/lib/errors';
import { Prisma } from '@prisma/client';
import { dispatchPushNotification } from '@/lib/notifications';

const MIN_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const DEFAULT_EXPIRY_MINUTES = 30;

export async function POST(request: Request) {
  try {
    const driver = await requireAuth(request);

    if (!driver.phone) {
      throw new AppError('Your phone number must be provided in your profile before requesting a booking', 400, 'PHONE_REQUIRED');
    }

    const body = await request.json();
    const data = createBookingSchema.parse(body);

    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    const now = new Date();

    if (startsAt.getTime() <= now.getTime()) {
      throw new AppError('Booking start time must be in the future', 400, 'START_IN_PAST');
    }

    const durationMs = endsAt.getTime() - startsAt.getTime();
    if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
      throw new AppError('Booking duration must be between 30 minutes and 4 hours', 400, 'INVALID_DURATION');
    }

    // Read configured expiry minutes from AppConfig
    const expiryConfig = await db.appConfig.findUnique({
      where: { key: 'bookingExpiryMinutes' },
    });
    const expiryMinutes = expiryConfig ? parseInt(expiryConfig.value, 10) : DEFAULT_EXPIRY_MINUTES;
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    // Advisory locked transaction to prevent concurrent double bookings
    const booking = await db.$transaction(async (tx) => {
      // 1. Advisory Lock per charger
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('charger_' || ${data.chargerId}))`
      );

      // 2. Fetch charger & host
      const charger = await tx.charger.findUnique({
        where: { id: data.chargerId },
        include: { host: true },
      });

      if (!charger) {
        throw new AppError('Charger not found', 404, 'NOT_FOUND');
      }

      if (charger.hostId === driver.id) {
        throw new ForbiddenError('Hosts cannot book their own chargers');
      }

      if (charger.approvalStatus !== 'APPROVED' || !charger.isOnline) {
        throw new AppError('Charger is currently offline or not approved for bookings', 400, 'CHARGER_UNAVAILABLE');
      }

      if (charger.host.hostStatus !== 'APPROVED') {
        throw new AppError('Host account is currently not active', 400, 'HOST_UNAVAILABLE');
      }

      // 3. Check Host Wallet Balance
      const hostBalance = await getWalletBalance(charger.hostId);
      if (hostBalance <= 0) {
        throw new AppError('This charger is temporarily unavailable due to host wallet limits', 400, 'HOST_ZERO_BALANCE');
      }

      // 4. Lazy-expire past requested bookings before checking overlap
      await tx.booking.updateMany({
        where: {
          chargerId: data.chargerId,
          status: 'REQUESTED',
          expiresAt: { lt: now },
        },
        data: { status: 'EXPIRED' },
      });

      // 5. Driver duplicate booking check & general overlap check
      const driverDuplicate = await tx.booking.findFirst({
        where: {
          driverId: driver.id,
          chargerId: data.chargerId,
          status: { in: ['REQUESTED', 'ACCEPTED'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });

      if (driverDuplicate) {
        throw new AppError('You already have a pending or accepted booking for this charger during this time slot', 409, 'DUPLICATE_BOOKING');
      }

      const overlapping = await tx.booking.findFirst({
        where: {
          chargerId: data.chargerId,
          status: { in: ['ACCEPTED', 'CHARGING', 'REQUESTED'] },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });

      if (overlapping) {
        throw new AppError('This time slot is already booked or requested by another driver', 409, 'SLOT_OCCUPIED');
      }

      // 6. Create Booking
      return tx.booking.create({
        data: {
          driverId: driver.id,
          chargerId: data.chargerId,
          startsAt,
          endsAt,
          status: 'REQUESTED',
          estimatedKwh: data.estimatedKwh ? new Prisma.Decimal(data.estimatedKwh) : null,
          expiresAt,
        },
        include: {
          charger: true,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

    dispatchPushNotification({
      userId: booking.charger.hostId,
      title: 'New Booking Request',
      body: 'You have a new booking request.',
      data: {
        type: 'BOOKING_REQUESTED',
        bookingId: booking.id,
      },
    });

    return apiSuccess(
      {
        id: booking.id,
        driverId: booking.driverId,
        chargerId: booking.chargerId,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        status: booking.status,
        expiresAt: booking.expiresAt,
        estimatedKwh: booking.estimatedKwh ? Number(booking.estimatedKwh) : null,
        areaLabel: booking.charger.areaLabel,
        createdAt: booking.createdAt,
      },
      201
    );
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const query = listBookingsQuerySchema.parse({
      role: searchParams.get('role') || undefined,
      status: searchParams.get('status') || undefined,
      cursor: searchParams.get('cursor') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    // Lazy-expire stale requested bookings
    await lazyExpireBookings();

    const limit = query.limit;

    const where: Prisma.BookingWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.cursor && { id: { gt: query.cursor } }),
    };

    if (query.role === 'host') {
      where.charger = { hostId: user.id };
    } else if (query.role === 'driver') {
      where.driverId = user.id;
    } else {
      // Default: show bookings where caller is either driver or host
      where.OR = [
        { driverId: user.id },
        { charger: { hostId: user.id } },
      ];
    }

    const bookings = await db.booking.findMany({
      where,
      take: limit + 1,
      orderBy: { id: 'asc' },
      include: {
        charger: {
          include: {
            host: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        driver: {
          select: { id: true, name: true, phone: true },
        },
        session: true,
      },
    });

    const hasNextPage = bookings.length > limit;
    const items = hasNextPage ? bookings.slice(0, limit) : bookings;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    // Apply strict privacy rules to each item
    const formatted = items.map((b) => {
      const isConfirmedOrActive = ['ACCEPTED', 'CHARGING', 'COMPLETED', 'CONFIRMED'].includes(b.status);
      const isDriver = b.driverId === user.id;
      const isHost = b.charger.hostId === user.id;
      const isAdmin = user.role === 'ADMIN';

      const canSeePrivateDetails = (isDriver || isHost || isAdmin) && isConfirmedOrActive;

      return {
        id: b.id,
        driverId: b.driverId,
        chargerId: b.chargerId,
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        status: b.status,
        rateSnapshotPaisa: b.rateSnapshotPaisa,
        estimatedKwh: b.estimatedKwh ? Number(b.estimatedKwh) : null,
        expiresAt: b.expiresAt,
        cancelReason: b.cancelReason,
        createdAt: b.createdAt,
        charger: {
          id: b.charger.id,
          title: b.charger.title,
          areaLabel: b.charger.areaLabel,
          powerKw: Number(b.charger.powerKw),
          connectorType: b.charger.connectorType,
          pricePerKwhPaisa: b.charger.pricePerKwhPaisa,
          addressLine: canSeePrivateDetails ? b.charger.addressLine : undefined,
        },
        host: {
          id: b.charger.host.id,
          name: b.charger.host.name,
          phone: canSeePrivateDetails ? b.charger.host.phone : undefined,
        },
        driver: {
          id: b.driver.id,
          name: b.driver.name,
          phone: canSeePrivateDetails ? b.driver.phone : undefined,
        },
        session: b.session
          ? {
              id: b.session.id,
              kwhDelivered: Number(b.session.kwhDelivered),
              totalPaisa: b.session.totalPaisa,
              commissionPaisa: b.session.commissionPaisa,
            }
          : null,
      };
    });

    return apiSuccess({
      bookings: formatted,
      nextCursor,
    });
  } catch (err) {
    return apiError(err);
  }
}
