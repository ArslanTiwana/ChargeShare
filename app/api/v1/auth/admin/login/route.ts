import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { adminLoginSchema } from '@/shared/src';
import { comparePassword, signAdminSessionToken, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit } from '@/lib/ratelimit';
import { UnauthorizedError, ForbiddenError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (origin && origin !== appUrl) {
      throw new ForbiddenError('CSRF check failed: Origin header mismatch');
    }

    const body = await request.json();
    const { email, password } = adminLoginSchema.parse(body);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'ip_unknown';
    await checkRateLimit(`admin-login:${clientIp}:${email}`, 5, 600);

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash || user.role !== 'ADMIN' || !user.isActive) {
      throw new UnauthorizedError('Invalid admin credentials');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid admin credentials');
    }

    const sessionToken = await signAdminSessionToken({ id: user.id, email: user.email });

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieString = `${ADMIN_COOKIE_NAME}=${sessionToken}; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=86400`;

    return apiSuccess(
      {
        message: 'Admin session established',
        admin: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      200,
      {
        'Set-Cookie': cookieString,
      }
    );
  } catch (err) {
    return apiError(err);
  }
}
