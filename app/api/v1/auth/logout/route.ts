import { apiSuccess, apiError } from '@/lib/api-response';
import { refreshTokenSchema } from '@/shared/src';
import { revokeRefreshToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = refreshTokenSchema.parse(body);

    await revokeRefreshToken(refreshToken);

    return apiSuccess({
      message: 'Successfully logged out',
    });
  } catch (err) {
    return apiError(err);
  }
}
