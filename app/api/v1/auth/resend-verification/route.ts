import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { resendVerificationSchema } from '@/shared/src';
import { generateRandomToken, hashToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = resendVerificationSchema.parse(body);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'ip_unknown';
    await checkRateLimit(`resend-verify:${clientIp}:${email}`, 3, 3600);

    const user = await db.user.findUnique({
      where: { email },
    });

    // Don't leak user existence; if not found or already verified, return generic success
    if (user && !user.emailVerifiedAt) {
      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

      await db.emailToken.create({
        data: {
          userId: user.id,
          type: 'VERIFY_EMAIL',
          tokenHash,
          expiresAt,
        },
      });

      await sendVerificationEmail(user.email, rawToken);
    }

    return apiSuccess({
      message: 'If an unverified account exists with that email, a verification link has been sent.',
    });
  } catch (err) {
    return apiError(err);
  }
}
