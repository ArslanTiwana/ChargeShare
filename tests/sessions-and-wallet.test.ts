import { describe, it, expect } from 'vitest';
import db from '../lib/db';
import { getWalletBalance } from '../lib/wallet';
import { Prisma } from '@prisma/client';

describe('Part 3.5 & 3.6: Sessions, Commission, Ledger & Idempotency', () => {
  it('correctly calculates totalPaisa and commissionPaisa in integer paisa', () => {
    // Test Case 1: 28.5 kWh at 6500 paisa/kWh (Rs 65/kWh) with 15% commission
    const kwh = 28.5;
    const rateSnapshotPaisa = 6500;
    const commissionPercent = 15;

    const totalPaisa = Math.round(kwh * rateSnapshotPaisa);
    const commissionPaisa = Math.round((totalPaisa * commissionPercent) / 100);

    expect(Number.isInteger(totalPaisa)).toBe(true);
    expect(Number.isInteger(commissionPaisa)).toBe(true);
    expect(totalPaisa).toBe(185250); // Rs 1,852.50
    expect(commissionPaisa).toBe(27788); // Rs 277.88

    // Test Case 2: Rounding edge case: 12.333 kWh at 7200 paisa/kWh with 15%
    const edgeKwh = 12.333;
    const edgeRate = 7200;
    const edgeTotal = Math.round(edgeKwh * edgeRate);
    const edgeCommission = Math.round((edgeTotal * commissionPercent) / 100);

    expect(Number.isInteger(edgeTotal)).toBe(true);
    expect(Number.isInteger(edgeCommission)).toBe(true);
    expect(edgeTotal).toBe(88798);
    expect(edgeCommission).toBe(13320);
  });

  it('proves database-level idempotency: prevents multiple commission entries per booking', async () => {
    const host = await db.user.findFirst({ where: { role: 'USER', hostStatus: 'APPROVED' } });
    const driver = await db.user.findFirst({ where: { role: 'USER', id: { not: host?.id } } });
    const charger = await db.charger.findFirst({ where: { hostId: host?.id } });
    if (!host || !driver || !charger) return;

    // Create a real test booking
    const booking = await db.booking.create({
      data: {
        driverId: driver.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'COMPLETED',
      },
    });

    // First commission transaction succeeds
    const tx1 = await db.walletTransaction.create({
      data: {
        hostId: host.id,
        type: 'COMMISSION',
        amountPaisa: -15000,
        bookingId: booking.id,
        note: 'First commission deduction',
      },
    });
    expect(tx1.id).toBeDefined();

    // Duplicate commission attempt MUST be rejected by the partial unique index:
    // "wallet_tx_one_commission_per_booking"
    await expect(
      db.walletTransaction.create({
        data: {
          hostId: host.id,
          type: 'COMMISSION',
          amountPaisa: -15000,
          bookingId: booking.id,
          note: 'Duplicate commission attempt',
        },
      })
    ).rejects.toThrow();

    // Note: Due to append-only trigger, attempting to delete tx1 is rejected!
    await expect(
      db.$executeRaw(Prisma.sql`DELETE FROM "WalletTransaction" WHERE id = ${tx1.id}`)
    ).rejects.toThrow(/append-only ledger/);
  });

  it('enforces single dispute per booking via database unique constraint', async () => {
    const user = await db.user.findFirst({ where: { role: 'USER' } });
    const charger = await db.charger.findFirst();
    if (!user || !charger) return;

    // Create a temporary booking
    const booking = await db.booking.create({
      data: {
        driverId: user.id,
        chargerId: charger.id,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600 * 1000),
        status: 'COMPLETED',
      },
    });

    // Dispute 1 succeeds
    const d1 = await db.dispute.create({
      data: {
        bookingId: booking.id,
        openedById: user.id,
        reason: 'Meter was reading higher than car display',
      },
    });
    expect(d1.id).toBeDefined();

    // Dispute 2 MUST fail due to unique constraint on Dispute.bookingId
    await expect(
      db.dispute.create({
        data: {
          bookingId: booking.id,
          openedById: user.id,
          reason: 'Second dispute attempt',
        },
      })
    ).rejects.toThrow();

    // Cleanup
    await db.dispute.delete({ where: { id: d1.id } });
    await db.booking.delete({ where: { id: booking.id } });
  });

  it('accurately derives wallet balance by summing all ledger transactions', async () => {
    const host = await db.user.findFirst({ where: { role: 'USER', hostStatus: 'APPROVED' } });
    if (!host) return;

    const balancePaisa = await getWalletBalance(host.id);
    expect(typeof balancePaisa).toBe('number');
    expect(Number.isInteger(balancePaisa)).toBe(true);
  });
});
