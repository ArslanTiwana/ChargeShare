import { apiSuccess, apiError } from '@/lib/api-response';
import { ADMIN_COOKIE_NAME } from '@/lib/auth';
import { ForbiddenError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    if (origin && origin !== appUrl) {
      throw new ForbiddenError('CSRF check failed: Origin header mismatch');
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
