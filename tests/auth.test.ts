import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  comparePassword,
  hashToken,
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  rotateRefreshToken,
} from '../lib/auth';
import db from '../lib/db';

describe('Part 3.1: Auth System & Security Helpers', () => {
  it('hashes passwords using bcryptjs with cost factor', async () => {
    const raw = 'SuperSecret123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(hash.startsWith('$2')).toBe(true);

    const valid = await comparePassword(raw, hash);
    const invalid = await comparePassword('WrongPassword', hash);

    expect(valid).toBe(true);
    expect(invalid).toBe(false);
  });

  it('hashes tokens with SHA-256 for secure DB storage', () => {
    const token = 'my-raw-random-token-12345';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 produces 64 hex chars
    expect(hash1).not.toBe(token);
  });

  it('signs and verifies 15-minute access JWTs', async () => {
    const payload = {
      userId: 'test-user-id',
      email: 'test@chargeshare.pk',
      role: 'USER' as const,
      hostStatus: 'NONE' as const,
    };

    const token = await signAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = await verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.role).toBe(payload.role);
    expect(decoded.hostStatus).toBe(payload.hostStatus);
  });

  it('detects refresh token reuse and revokes all active sessions for that user', async () => {
    // Create test user in DB
    const testEmail = `reuse-test-${Date.now()}@example.com`;
    const user = await db.user.create({
      data: {
        email: testEmail,
        name: 'Reuse Test User',
        role: 'USER',
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    // Create session 1 and session 2
    const { rawToken: token1 } = await createRefreshToken(user.id);
    const { rawToken: token2 } = await createRefreshToken(user.id);

    // Legitimate rotation of token1 -> gives new token3
    const { newRefreshToken: token3 } = await rotateRefreshToken(token1);
    expect(token3).toBeDefined();

    // Replay attack: Attacker or client tries to use token1 AGAIN!
    await expect(rotateRefreshToken(token1)).rejects.toThrow(/Revoked token reuse detected/);

    // Verify that ALL sessions (including token2 and token3) were revoked!
    const activeTokens = await db.refreshToken.findMany({
      where: { userId: user.id, revokedAt: null },
    });
    expect(activeTokens.length).toBe(0);

    // Cleanup
    await db.user.delete({ where: { id: user.id } });
  });
});
