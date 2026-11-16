import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { registerSchema } from '@/shared/src';
import { hashPassword, generateRandomToken, hashToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit } from '@/lib/ratelimit';
import { AppError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = registerSchema.parse(body);

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'ip_unknown';
    await checkRateLimit(`register:${clientIp}`, 10, 3600);

    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await hashPassword(data.password);

    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: 'USER',
        preferredMode: data.preferredMode || null,
        hostStatus: 'NONE',
        isActive: true,
      },
    });

    // Generate single-use email verification token (24h expiry)
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

    return apiSuccess(
      {
        userId: user.id,
        email: user.email,
        message: 'Account created. Please check your email to verify your account.',
      },
      201
    );
  } catch (err) {
    return apiError(err);
  }
}
