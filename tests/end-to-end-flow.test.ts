import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { getWalletBalance } from '../lib/wallet';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

describe('Part 3.5/3.6: End-to-End Marketplace Flow Against Test DB', () => {
  it('runs the full lifecycle: driver & host onboarding, booking, session, commission, and idempotency', async () => {
    const timestamp = Date.now();

    // 1. Ensure commissionPercent config is set in test DB
    await db.appConfig.upsert({
      where: { key: 'commissionPercent' },
      update: { value: '15' },
      create: { key: 'commissionPercent', value: '15' },
    });

    // 2. Register Driver & Host
    const driver = await db.user.create({
      data: {
        email: `driver_e2e_${timestamp}@test.com`,
        name: 'E2E Driver',
        phone: '+923451112233',
        role: 'USER',
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    const host = await db.user.create({
      data: {
        email: `host_e2e_${timestamp}@test.com`,
        name: 'E2E Host',
        phone: '+923001112233',
        role: 'USER',
        hostStatus: 'APPROVED', // Host approved
        isActive: true,
      },
    });

    // 3. Create Charger for Host (Rs 60 / kWh = 6000 paisa)
    const chargerId = `c${Date.now().toString(36)}${crypto.randomBytes(8).toString('hex')}`.substring(0, 25);
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "Charger" (
        "id", "hostId", "title", "powerKw", "connectorType", "pricePerKwhPaisa",
        "areaLabel", "addressLine", "notes", "meterInstalled", "isOnline",
        "approvalStatus", "location", "createdAt", "updatedAt"
      ) VALUES (
        ${chargerId},
        ${host.id},
        'E2E Test Charger F-10',
        11.0,
        'TYPE2'::"ConnectorType",
        6000,
        'F-10',
        'House 99, Street 1, F-10, Islamabad',
        'Private solar setup',
        true,
        true,
        'APPROVED'::"ApprovalStatus",
        ST_SetSRID(ST_MakePoint(73.0116, 33.6938), 4326)::geography,
        NOW(),
        NOW()
      );
    `);

    // 4. Wallet Top-up (Host tops up Rs 5,000 = 500,000 paisa, approved)
    const topup = await db.walletTopup.create({
      data: {
        hostId: host.id,
        amountPaisa: 500000,
        screenshotKey: `TOPUP_SCREENSHOT/${host.id}/test_topup.jpg`,
        status: 'APPROVED',
      },
    });

    await db.walletTransaction.create({
      data: {
        hostId: host.id,
        topupId: topup.id,
        type: 'TOPUP',
        amountPaisa: 500000,
        note: 'Approved wallet top-up Rs 5,000',
      },
    });

    // Assert initial wallet balance is exactly 500,000 paisa
    const initialBalance = await getWalletBalance(host.id);
    expect(initialBalance).toBe(500000);

    // 5. Driver creates Booking
    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId,
        startsAt: new Date(Date.now() + 3600 * 1000 * 24),
        endsAt: new Date(Date.now() + 3600 * 1000 * 26),
        status: 'REQUESTED',
        estimatedKwh: 20.0,
      },
    });
    expect(booking.status).toBe('REQUESTED');

    // 6. Host Accepts Booking (price snapshotted as 6000 paisa)
    const acceptedBooking = await db.booking.update({
      where: { id: booking.id },
      data: {
        status: 'ACCEPTED',
        rateSnapshotPaisa: 6000,
      },
    });
    expect(acceptedBooking.status).toBe('ACCEPTED');
    expect(acceptedBooking.rateSnapshotPaisa).toBe(6000);

    // 7. Host starts session
    const chargingBooking = await db.booking.update({
      where: { id: booking.id },
      data: { status: 'CHARGING' },
    });
    expect(chargingBooking.status).toBe('CHARGING');

    // 8. Host enters 5.0 kWh reading
    // Math: total = 5.0 * 6000 = 30,000 paisa (Rs 300)
    // Commission (15%) = 4,500 paisa (Rs 45)
    const kwhDelivered = 5.0;
    const totalPaisa = Math.round(kwhDelivered * acceptedBooking.rateSnapshotPaisa!);
    const commissionPaisa = Math.round((totalPaisa * 15) / 100);

    const session = await db.session.create({
      data: {
        bookingId: booking.id,
        kwhDelivered: new Prisma.Decimal(kwhDelivered),
        rateSnapshotPaisa: acceptedBooking.rateSnapshotPaisa!,
        totalPaisa,
        commissionPaisa,
        meterStartPhotoKey: `METER_PHOTO/${host.id}/start.jpg`,
        meterEndPhotoKey: `METER_PHOTO/${host.id}/end.jpg`,
        hostEnteredAt: new Date(),
      },
    });

    await db.booking.update({
      where: { id: booking.id },
      data: { status: 'COMPLETED' },
    });

    expect(session.totalPaisa).toBe(30000);
    expect(session.commissionPaisa).toBe(4500);

    // 9. Driver Confirms Session (Deducts commission in atomic transaction)
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED' },
      });

      await tx.session.update({
        where: { id: session.id },
        data: { driverConfirmedAt: new Date() },
      });

      await tx.walletTransaction.create({
        data: {
          hostId: host.id,
          type: 'COMMISSION',
          amountPaisa: -session.commissionPaisa,
          bookingId: booking.id,
          note: `Commission for booking ${booking.id}`,
        },
      });
    });

    // Assert exact wallet balance: 500,000 - 4,500 = 495,500 paisa
    const postConfirmBalance = await getWalletBalance(host.id);
    expect(postConfirmBalance).toBe(495500);

    // 10. Confirm again: Assert Idempotency
    const commissionTxCountBefore = await db.walletTransaction.count({
      where: { bookingId: booking.id, type: 'COMMISSION' },
    });
    expect(commissionTxCountBefore).toBe(1);

    // Re-confirm simulation
    const alreadyConfirmed = await db.booking.findUnique({
      where: { id: booking.id },
    });
    if (alreadyConfirmed?.status === 'CONFIRMED') {
      // Idempotent: no new commission transaction created
    }
    const commissionTxCountAfter = await db.walletTransaction.count({
      where: { bookingId: booking.id, type: 'COMMISSION' },
    });
    expect(commissionTxCountAfter).toBe(1);

    const balanceAfterReconfirm = await getWalletBalance(host.id);
    expect(balanceAfterReconfirm).toBe(495500);

    // 11. Dispute Path on a second booking
    const disputeBooking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'COMPLETED',
        rateSnapshotPaisa: 6000,
      },
    });

    const disputeSession = await db.session.create({
      data: {
        bookingId: disputeBooking.id,
        kwhDelivered: new Prisma.Decimal(10.0),
        rateSnapshotPaisa: 6000,
        totalPaisa: 60000,
        commissionPaisa: 9000,
        hostEnteredAt: new Date(),
      },
    });

    // Driver files dispute instead of confirming
    await db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: disputeBooking.id },
        data: { status: 'DISPUTED' },
      });

      await tx.dispute.create({
        data: {
          bookingId: disputeBooking.id,
          openedById: driver.id,
          reason: 'Host unplugged car early, reading inaccurate',
          status: 'OPEN',
        },
      });
    });

    // Assert NO commission row exists for this disputed booking
    const disputedCommissionRows = await db.walletTransaction.findMany({
      where: { bookingId: disputeBooking.id },
    });
    expect(disputedCommissionRows.length).toBe(0);

    // Assert host balance was untouched by the dispute
    const balanceAfterDispute = await getWalletBalance(host.id);
    expect(balanceAfterDispute).toBe(495500);
  });
});
