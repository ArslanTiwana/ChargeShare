import { apiSuccess, apiError } from '@/lib/api-response';
import { refreshTokenSchema } from '@/shared/src';
import { rotateRefreshToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = refreshTokenSchema.parse(body);

    const userAgent = request.headers.get('user-agent') || undefined;
    const { newAccessToken, newRefreshToken, user } = await rotateRefreshToken(refreshToken, userAgent);

    return apiSuccess({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hostStatus: user.hostStatus,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
