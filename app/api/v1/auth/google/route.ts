import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { googleAuthSchema } from '@/shared/src';
import { verifyGoogleIdToken, signAccessToken, createRefreshToken } from '@/lib/auth';
import { UnauthorizedError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken } = googleAuthSchema.parse(body);

    const googleProfile = await verifyGoogleIdToken(idToken);

    // Link by verified email or find by googleId
    let user = await db.user.findFirst({
      where: {
        OR: [
          { googleId: googleProfile.googleId },
          { email: googleProfile.email },
        ],
      },
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedError('User account is deactivated');
      }

      // Link googleId or update avatar/verification timestamp if not set
      user = await db.user.update({
        where: { id: user.id },
        data: {
          googleId: user.googleId || googleProfile.googleId,
          emailVerifiedAt: user.emailVerifiedAt || new Date(),
          avatarUrl: user.avatarUrl || googleProfile.avatarUrl,
        },
      });
    } else {
      // New user registering via Google
      user = await db.user.create({
        data: {
          email: googleProfile.email,
          googleId: googleProfile.googleId,
          name: googleProfile.name,
          avatarUrl: googleProfile.avatarUrl,
          emailVerifiedAt: new Date(),
          role: 'USER',
          hostStatus: 'NONE',
          isActive: true,
        },
      });
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
        avatarUrl: user.avatarUrl,
        role: user.role,
        preferredMode: user.preferredMode,
        hostStatus: user.hostStatus,
        emailVerified: true,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
