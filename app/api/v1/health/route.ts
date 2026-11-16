import { apiSuccess, apiError } from '@/lib/api-response';
import db from '@/lib/db';
import { healthResponseSchema } from '@/shared/src';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let dbStatus = 'connected';
    try {
      await db.$queryRawUnsafe('SELECT 1');
    } catch (err) {
      console.error('Health check DB ping failed:', err);
      dbStatus = 'disconnected';
    }

    const rawData = {
      status: dbStatus === 'connected' ? ('ok' as const) : ('degraded' as const),
      timestamp: new Date().toISOString(),
      service: 'chargeshare-api',
      version: '0.1.0',
      uptime: Math.floor(process.uptime()),
      database: dbStatus,
    };

    const validatedData = healthResponseSchema.parse(rawData);

    return apiSuccess(validatedData, dbStatus === 'connected' ? 200 : 503);
  } catch (error) {
    return apiError(error);
  }
}
