import { apiSuccess, apiError } from '@/lib/api-response';
import { requireAuth, comparePassword } from '@/lib/auth';
import { inAppDeleteAccountSchema } from '@/shared/src';
import { executeAccountDeletion } from '@/lib/account-deletion';
import { AppError } from '@/lib/errors';

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth(request);

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty if client passed no payload
    }

    const data = inAppDeleteAccountSchema.parse(body);

    // If user registered with password, require and verify it
    if (user.passwordHash) {
      if (!data.password) {
        throw new AppError('Password is required to delete your account', 400, 'PASSWORD_REQUIRED');
      }
      const isValid = await comparePassword(data.password, user.passwordHash);
      if (!isValid) {
        throw new AppError('Incorrect password', 400, 'INVALID_CREDENTIALS');
      }
    }

    await executeAccountDeletion(user.id);

    return apiSuccess({
      message: 'Account successfully deleted and anonymized.',
    });
  } catch (err) {
    return apiError(err);
  }
}
