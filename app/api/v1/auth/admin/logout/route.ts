import { apiSuccess, apiError } from '@/lib/api-response';
import { ADMIN_COOKIE_NAME } from '@/lib/auth';
import { ForbiddenError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin) {
      const requestOrigin = (() => {
        try {
          return new URL(request.url).origin;
        } catch {
          return null;
        }
      })();
      const allowed = [
        requestOrigin,
        process.env.APP_URL?.replace(/\/$/, ''),
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ''),
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ].filter(Boolean);

      if (!allowed.includes(origin.replace(/\/$/, ''))) {
        throw new ForbiddenError('CSRF check failed: Origin header mismatch');
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const clearCookieString = `${ADMIN_COOKIE_NAME}=; HttpOnly; ${isProduction ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`;

    return apiSuccess(
      {
        message: 'Admin logged out successfully',
      },
      200,
      {
        'Set-Cookie': clearCookieString,
      }
    );
  } catch (err) {
    return apiError(err);
  }
}
