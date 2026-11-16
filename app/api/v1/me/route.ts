import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { updateProfileSchema } from '@/shared/src';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    let commissionPercent: number | undefined;
    if (user.hostStatus === 'APPROVED' || user.role === 'ADMIN') {
      const commConfig = await db.appConfig.findUnique({
        where: { key: 'commissionPercent' },
      });
      commissionPercent = commConfig ? parseFloat(commConfig.value) : 15;
    }

    return apiSuccess({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
      preferredMode: user.preferredMode,
      hostStatus: user.hostStatus,
      isActive: user.isActive,
      emailVerified: user.emailVerifiedAt != null,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      ...(commissionPercent !== undefined && { commissionPercent }),
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = updateProfileSchema.parse(body);

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.preferredMode !== undefined && { preferredMode: data.preferredMode }),
      },
    });

    return apiSuccess({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
      preferredMode: updatedUser.preferredMode,
      hostStatus: updatedUser.hostStatus,
      isActive: updatedUser.isActive,
      emailVerified: updatedUser.emailVerifiedAt != null,
      emailVerifiedAt: updatedUser.emailVerifiedAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (err) {
    return apiError(err);
  }
}
