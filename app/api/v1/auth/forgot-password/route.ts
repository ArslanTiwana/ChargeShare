import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { forgotPasswordSchema } from '@/shared/src';
import { generateRandomToken, hashToken } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'ip_unknown';
    await checkRateLimit(`forgot-pass:${clientIp}:${email}`, 3, 3600);

    const user = await db.user.findUnique({
      where: { email },
    });

    // Security: never reveal whether an email exists
    if (user && user.isActive) {
      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour expiry

      await db.emailToken.create({
        data: {
          userId: user.id,
          type: 'RESET_PASSWORD',
          tokenHash,
          expiresAt,
        },
      });

      await sendPasswordResetEmail(user.email, rawToken);
    }

    return apiSuccess({
      message: 'If an account exists with that email, password reset instructions have been sent.',
    });
  } catch (err) {
    return apiError(err);
  }
}
