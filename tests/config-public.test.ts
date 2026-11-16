import { describe, it, expect } from 'vitest';
import { GET as getPublicConfigHandler } from '../app/api/v1/config/public/route';

describe('Public Config API', () => {
  it('GET /api/v1/config/public returns public app configuration without secrets', async () => {
    const res = await getPublicConfigHandler();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.minBookingDurationHours).toBeGreaterThanOrEqual(1);
    expect(body.data.maxBookingDurationHours).toBeGreaterThanOrEqual(body.data.minBookingDurationHours);
    expect(body.data.bookingExpiryMinutes).toBeDefined();
    expect(body.data.autoConfirmHours).toBeDefined();
    expect(body.data.minTopupPaisa).toBeGreaterThan(0);
    expect(body.data.maxTopupPaisa).toBeGreaterThan(body.data.minTopupPaisa);
    expect(body.data.maxSessionKwh).toBeGreaterThan(0);
    expect(body.data.commissionPercent).toBeUndefined();
    expect(typeof body.data.topupInstructions).toBe('string');
    expect(body.data.hostMinWalletWarningPaisa).toBeGreaterThan(0);

    // Make sure no sensitive keys leaked
    expect(body.data.jwtSecret).toBeUndefined();
    expect(body.data.databaseUrl).toBeUndefined();
  });
});
