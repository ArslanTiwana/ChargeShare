import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { createSupportMessageSchema } from '@/shared/src';
import { checkRateLimit } from '@/lib/ratelimit';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    await checkRateLimit(`${ip}:support`, 5, 600);

    const body = await request.json();
    const data = createSupportMessageSchema.parse(body);

    const supportMessage = await db.supportMessage.create({
      data: {
        userId: user.id,
        subject: data.subject,
        message: data.message,
        appVersion: typeof body.appVersion === 'string' ? body.appVersion : null,
        status: 'OPEN',
      },
    });

    return apiSuccess(
      {
        id: supportMessage.id,
        status: supportMessage.status,
        message: 'Your message has been received. Our support team will respond shortly.',
      },
      201
    );
  } catch (err) {
    return apiError(err);
  }
}
