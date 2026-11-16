import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requestAccountDeletionSchema } from '@/shared/src';
import { generateRandomToken, hashToken } from '@/lib/auth';
import { sendAccountDeletionEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/ratelimit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await checkRateLimit(`${ip}:auth`, 5, 600);

    const body = await request.json();
    const data = requestAccountDeletionSchema.parse(body);

    const user = await db.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (user && user.isActive) {
      // Invalidate existing active delete tokens for this user
      await db.emailToken.deleteMany({
        where: {
          userId: user.id,
          type: 'DELETE_ACCOUNT',
        },
      });

      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.emailToken.create({
        data: {
          userId: user.id,
          tokenHash,
          type: 'DELETE_ACCOUNT',
          expiresAt,
        },
      });

      await sendAccountDeletionEmail(user.email, rawToken);
    }

    return apiSuccess({
      message: 'If an account exists with this email, a deletion link has been sent.',
    });
  } catch (err) {
    return apiError(err);
  }
}
