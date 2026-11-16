import { apiSuccess, apiError } from '@/lib/api-response';
import { healthResponseSchema } from '@/shared/src';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rawData = {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      service: 'chargeshare-api',
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
    };

    const validatedData = healthResponseSchema.parse(rawData);

    return apiSuccess(validatedData);
  } catch (error) {
    return apiError(error);
  }
}
