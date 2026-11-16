import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { OAuth2Client } from 'google-auth-library';
import db from './db';
import { UnauthorizedError, ForbiddenError, AppError } from './errors';
import { UserRole, HostStatus } from '@/shared/src';
import type { User } from '@prisma/client';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_DAYS = 30;

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing');
  }
  return new TextEncoder().encode(secret);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface AuthJwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  hostStatus: HostStatus;
}

export async function signAccessToken(payload: AuthJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<AuthJwtPayload> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      hostStatus: payload.hostStatus as HostStatus,
    };
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export async function createRefreshToken(
  userId: string,
  userAgent?: string
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateRandomToken(40);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);

  await db.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: userAgent || null,
    },
  });

  return { rawToken, expiresAt };
}

export async function rotateRefreshToken(
  rawToken: string,
  userAgent?: string
): Promise<{ user: User; newAccessToken: string; newRefreshToken: string }> {
  const tokenHash = hashToken(rawToken);

  const tokenRecord = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  // If token not found, reject
  if (!tokenRecord) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Token reuse detection: if revoked token is presented again, revoke ALL user refresh tokens
  if (tokenRecord.revokedAt != null) {
    await db.refreshToken.updateMany({
      where: { userId: tokenRecord.userId },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Revoked token reuse detected. All active sessions have been terminated.');
  }

  // Check expiration
  if (tokenRecord.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  const user = tokenRecord.user;
  if (!user.isActive) {
    throw new UnauthorizedError('User account is deactivated');
  }

  // Revoke current token
  await db.refreshToken.update({
    where: { id: tokenRecord.id },
    data: { revokedAt: new Date() },
  });

  // Create new refresh token
  const { rawToken: newRefreshToken } = await createRefreshToken(user.id, userAgent);

  // Create new access token
  const newAccessToken = await signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    hostStatus: user.hostStatus,
  });

  return { user, newAccessToken, newRefreshToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await db.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<{ googleId: string; email: string; name: string; avatarUrl?: string }> {
  const clientIds = (process.env.GOOGLE_CLIENT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const client = new OAuth2Client();
  let ticket;

  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: clientIds.length > 0 ? clientIds : undefined,
    });
  } catch (err) {
    throw new UnauthorizedError('Failed to verify Google ID token', err);
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new UnauthorizedError('Google ID token missing required email profile');
  }

  if (!payload.email_verified) {
    throw new UnauthorizedError('Google account email is not verified');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || payload.email.split('@')[0],
    avatarUrl: payload.picture,
  };
}

export function extractBearerToken(request: Request): string {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }
  return authHeader.substring(7).trim();
}

export async function requireAuth(request: Request): Promise<User> {
  const token = extractBearerToken(request);
  const payload = await verifyAccessToken(token);

  const user = await db.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new UnauthorizedError('User no longer exists');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('User account is deactivated');
  }

  return user;
}

export async function requireRole(request: Request, role: UserRole): Promise<User> {
  const user = await requireAuth(request);
  if (user.role !== role) {
    throw new ForbiddenError(`Access forbidden: requires ${role} role`);
  }
  return user;
}

export async function requireApprovedHost(request: Request): Promise<User> {
  const user = await requireAuth(request);
  if (user.hostStatus !== 'APPROVED') {
    throw new ForbiddenError('Access forbidden: requires an approved host account');
  }
  return user;
}

// ==========================================
// Admin Cookie Session Helpers
// ==========================================

export const ADMIN_COOKIE_NAME = 'admin_session';

export async function signAdminSessionToken(user: { id: string; email: string }): Promise<string> {
  return new SignJWT({ userId: user.id, email: user.email, role: 'ADMIN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getJwtSecret());
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, str) => {
    const [key, ...v] = str.trim().split('=');
    if (key) acc[key] = decodeURIComponent(v.join('='));
    return acc;
  }, {} as Record<string, string>);
}

export async function requireAdminSession(request: Request): Promise<User> {
  // Bearer-token auth is strictly forbidden on admin routes per requirement 4
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    throw new ForbiddenError('Bearer token authentication is forbidden on admin routes. Cookie session required.');
  }

  // CSRF validation on non-GET requests per requirement 4
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (origin && origin !== appUrl) {
      throw new ForbiddenError('CSRF check failed: Origin header mismatch');
    }
  }

  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[ADMIN_COOKIE_NAME];

  if (!sessionToken) {
    throw new UnauthorizedError('Admin session cookie missing');
  }

  try {
    const { payload } = await jwtVerify(sessionToken, getJwtSecret());
    if (payload.role !== 'ADMIN') {
      throw new ForbiddenError('Admin privileges required');
    }

    const adminUser = await db.user.findUnique({
      where: { id: payload.userId as string },
    });

    if (!adminUser || adminUser.role !== 'ADMIN' || !adminUser.isActive) {
      throw new UnauthorizedError('Invalid or deactivated admin account');
    }

    return adminUser;
  } catch {
    throw new UnauthorizedError('Invalid or expired admin session');
  }
}
