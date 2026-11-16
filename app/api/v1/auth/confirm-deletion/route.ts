import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { confirmAccountDeletionSchema } from '@/shared/src';
import { hashToken } from '@/lib/auth';
import { executeAccountDeletion } from '@/lib/account-deletion';
import { AppError } from '@/lib/errors';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = confirmAccountDeletionSchema.parse(body);

    const tokenHash = hashToken(data.token);

    const tokenRecord = await db.emailToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.type !== 'DELETE_ACCOUNT') {
      throw new AppError('Invalid or expired deletion token', 400, 'INVALID_TOKEN');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await db.emailToken.delete({ where: { id: tokenRecord.id } });
      throw new AppError('Deletion link has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
    }

    // Delete the token immediately
    await db.emailToken.delete({ where: { id: tokenRecord.id } });

    // Execute deletion and anonymization
    await executeAccountDeletion(tokenRecord.userId);

    return apiSuccess({
      message: 'Account successfully deleted and anonymized.',
    });
  } catch (err) {
    return apiError(err);
  }
}
