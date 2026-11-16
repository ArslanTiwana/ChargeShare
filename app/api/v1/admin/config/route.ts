import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { requireAdminSession } from '@/lib/auth';
import { adminConfigUpdateSchema } from '@/shared/src';

export async function GET(request: Request) {
  try {
    await requireAdminSession(request);

    const configs = await db.appConfig.findMany({
      orderBy: { key: 'asc' },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return apiSuccess({
      configs: configMap,
      items: configs,
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdminSession(request);
    const body = await request.json();
    const updates = adminConfigUpdateSchema.parse(body);

    const result = await db.$transaction(async (tx) => {
      const updatedEntries: Array<{ key: string; value: string }> = [];

      for (const [key, value] of Object.entries(updates)) {
        const item = await tx.appConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
        updatedEntries.push({ key: item.key, value: item.value });
      }

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: 'CONFIG_UPDATED',
          targetType: 'AppConfig',
          targetId: 'global',
          metadata: updates,
        },
      });

      return updatedEntries;
    });

    return apiSuccess({
      updated: result,
      message: 'Platform configuration updated successfully',
    });
  } catch (err) {
    return apiError(err);
  }
}
