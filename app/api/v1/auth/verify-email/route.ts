import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { verifyEmailSchema } from '@/shared/src';
import { hashToken } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, email } = verifyEmailSchema.parse(body);

    const tokenHash = hashToken(token);

    const emailToken = await db.emailToken.findFirst({
      where: {
        tokenHash,
        type: 'VERIFY_EMAIL',
        user: { email },
      },
      include: { user: true },
    });

    if (!emailToken || emailToken.consumedAt != null) {
      throw new AppError('Invalid or already used verification token', 400, 'INVALID_TOKEN');
    }

    if (emailToken.expiresAt < new Date()) {
      throw new AppError('Verification token has expired', 400, 'TOKEN_EXPIRED');
    }

    await db.$transaction([
      db.user.update({
        where: { id: emailToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      db.emailToken.update({
        where: { id: emailToken.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    return apiSuccess({
      message: 'Email address verified successfully.',
    });
  } catch (err) {
    return apiError(err);
  }
}
