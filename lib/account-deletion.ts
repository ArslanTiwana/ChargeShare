import db from './db';
import { AppError } from './errors';
import { getWalletBalance } from './wallet';
import { BookingStatus } from '@prisma/client';

export async function executeAccountDeletion(userId: string): Promise<void> {
  const activeStatuses: BookingStatus[] = [
    'REQUESTED',
    'ACCEPTED',
    'CHARGING',
    'COMPLETED',
    'DISPUTED',
  ];

  // 1. Check wallet balance
  const balance = await getWalletBalance(userId);
  if (balance < 0) {
    throw new AppError(
      'Cannot delete account with an unsettled negative wallet balance. Please clear outstanding amounts first.',
      400,
      'NEGATIVE_BALANCE'
    );
  }

  // 2. Transaction for active bookings check & anonymization
  await db.$transaction(async (tx) => {
    // Check driver active bookings
    const activeDriverBooking = await tx.booking.findFirst({
      where: {
        driverId: userId,
        status: { in: activeStatuses },
      },
    });

    if (activeDriverBooking) {
      throw new AppError(
        'Cannot delete account while you have active bookings.',
        400,
        'ACTIVE_BOOKINGS_EXIST'
      );
    }

    // Check host active bookings
    const activeHostBooking = await tx.booking.findFirst({
      where: {
        charger: { hostId: userId },
        status: { in: activeStatuses },
      },
    });

    if (activeHostBooking) {
      throw new AppError(
        'Cannot delete account while your chargers have active or unresolved bookings.',
        400,
        'ACTIVE_BOOKINGS_EXIST'
      );
    }

    // Set chargers offline
    await tx.charger.updateMany({
      where: { hostId: userId },
      data: { isOnline: false },
    });

    // Revoke refresh tokens
    await tx.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    // Delete push tokens
    await tx.pushToken.deleteMany({
      where: { userId },
    });

    // Anonymize user
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: `deleted_${userId}@chargeshare.local`,
        phone: null,
        avatarUrl: null,
        googleId: null,
        passwordHash: null,
        isActive: false,
        hostStatus: 'NONE',
        preferredMode: null,
      },
    });
  });
}
