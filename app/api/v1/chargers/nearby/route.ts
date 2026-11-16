import { apiSuccess, apiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { findNearbyChargers } from '@/lib/geo';
import { checkRateLimit } from '@/lib/ratelimit';
import { nearbyChargersQuerySchema } from '@/shared/src';

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 'ip_unknown';

    // Rate-limit per user and IP: 60 requests per 60 seconds
    await checkRateLimit(`nearby:${clientIp}:${user.id}`, 60, 60);

    const { searchParams } = new URL(request.url);

    const query = nearbyChargersQuerySchema.parse({
      lat: searchParams.get('lat'),
      lng: searchParams.get('lng'),
      radiusKm: searchParams.get('radiusKm') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const chargers = await findNearbyChargers(
      query.lat,
      query.lng,
      query.radiusKm,
      query.limit
    );

    return apiSuccess({
      chargers,
      count: chargers.length,
    });
  } catch (err) {
    return apiError(err);
  }
}
