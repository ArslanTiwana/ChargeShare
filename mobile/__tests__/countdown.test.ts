export function calculateRemainingSeconds(
  expiresAtISO: string,
  serverTimeISO: string,
  localTimestampMs: number,
  clientOffsetAtReceipt: number
): number {
  // Server-skew = ServerTime - LocalDeviceTimeAtReceipt
  const currentServerTime = localTimestampMs + clientOffsetAtReceipt;
  const expiresAtMs = new Date(expiresAtISO).getTime();
  const diffMs = Math.max(0, expiresAtMs - currentServerTime);
  return Math.floor(diffMs / 1000);
}

describe('Phase 5b: Server-Time Synchronized Expiry Countdown', () => {
  it('correctly computes countdown when client clock is ahead of server', () => {
    // Server says now is 12:00:00 (1000000ms), expiresAt is 12:30:00 (1000000 + 1800000ms)
    // Client device clock is 5 minutes ahead (1000000 + 300000ms)
    const serverTimeMs = 1700000000000;
    const clientTimeMs = serverTimeMs + 5 * 60 * 1000;
    const clientSkew = serverTimeMs - clientTimeMs; // -300000 ms

    const expiresAtMs = serverTimeMs + 30 * 60 * 1000; // 30 mins later
    const expiresAtISO = new Date(expiresAtMs).toISOString();
    const serverTimeISO = new Date(serverTimeMs).toISOString();

    // At moment of receipt:
    const remaining = calculateRemainingSeconds(
      expiresAtISO,
      serverTimeISO,
      clientTimeMs,
      clientSkew
    );
    expect(remaining).toBe(1800); // exactly 30 minutes = 1800 seconds
  });

  it('correctly computes countdown when client clock is behind server', () => {
    // Client device clock is 10 minutes behind
    const serverTimeMs = 1700000000000;
    const clientTimeMs = serverTimeMs - 10 * 60 * 1000;
    const clientSkew = serverTimeMs - clientTimeMs; // +600000 ms

    const expiresAtMs = serverTimeMs + 15 * 60 * 1000; // 15 mins later
    const remaining = calculateRemainingSeconds(
      new Date(expiresAtMs).toISOString(),
      new Date(serverTimeMs).toISOString(),
      clientTimeMs,
      clientSkew
    );
    expect(remaining).toBe(900); // exactly 15 minutes = 900 seconds
  });

  it('clamps to zero when expired', () => {
    const serverTimeMs = 1700000000000;
    const expiresAtMs = serverTimeMs - 60 * 1000; // 1 minute in the past
    const remaining = calculateRemainingSeconds(
      new Date(expiresAtMs).toISOString(),
      new Date(serverTimeMs).toISOString(),
      serverTimeMs,
      0
    );
    expect(remaining).toBe(0);
  });
});
