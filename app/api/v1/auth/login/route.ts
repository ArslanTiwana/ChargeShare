import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { loginSchema } from '@/shared/src';
import { comparePassword, signAccessToken, createRefreshToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { UnauthorizedError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'ip_unknown';
    await checkRateLimit(`login:${clientIp}:${data.email}`, 10, 600);

    const user = await db.user.findUnique({
      where: { email: data.email },
    });

    // Generic error: never reveal whether an email exists
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated');
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const userAgent = request.headers.get('user-agent') || undefined;
    const { rawToken: refreshToken } = await createRefreshToken(user.id, userAgent);

    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      hostStatus: user.hostStatus,
    });

    return apiSuccess({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        preferredMode: user.preferredMode,
        hostStatus: user.hostStatus,
        emailVerified: user.emailVerifiedAt != null,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
