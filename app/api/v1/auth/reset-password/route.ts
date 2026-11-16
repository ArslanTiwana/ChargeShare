import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { resetPasswordSchema } from '@/shared/src';
import { hashToken, hashPassword } from '@/lib/auth';
import { AppError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, email, newPassword } = resetPasswordSchema.parse(body);

    const tokenHash = hashToken(token);

    const emailToken = await db.emailToken.findFirst({
      where: {
        tokenHash,
        type: 'RESET_PASSWORD',
        user: { email },
      },
      include: { user: true },
    });

    if (!emailToken || emailToken.consumedAt != null) {
      throw new AppError('Invalid or already used reset token', 400, 'INVALID_TOKEN');
    }

    if (emailToken.expiresAt < new Date()) {
      throw new AppError('Password reset token has expired', 400, 'TOKEN_EXPIRED');
    }

    const newPasswordHash = await hashPassword(newPassword);

    await db.$transaction([
      db.user.update({
        where: { id: emailToken.userId },
        data: {
          passwordHash: newPasswordHash,
          emailVerifiedAt: emailToken.user.emailVerifiedAt || new Date(),
        },
      }),
      db.emailToken.update({
        where: { id: emailToken.id },
        data: { consumedAt: new Date() },
      }),
      // Revoke all existing sessions for security
      db.refreshToken.updateMany({
        where: { userId: emailToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return apiSuccess({
      message: 'Password has been reset successfully. You may now log in.',
    });
  } catch (err) {
    return apiError(err);
  }
}
