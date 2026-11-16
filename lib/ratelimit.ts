import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { AppError } from './errors';

let warnedMissingEnv = false;

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

// Local in-memory fallback for testing and dev environments
const memoryCache = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string,
  limit = 5,
  windowSeconds = 600
): Promise<void> {
  if (!redis) {
    if (!warnedMissingEnv && process.env.NODE_ENV !== 'production') {
      console.warn('[RATELIMIT] Upstash Redis credentials not configured. Using local in-memory rate limiting.');
      warnedMissingEnv = true;
    }

    const now = Date.now();
    const entry = memoryCache.get(identifier);

    if (!entry || now > entry.resetAt) {
      memoryCache.set(identifier, { count: 1, resetAt: now + windowSeconds * 1000 });
      return;
    }

    if (entry.count >= limit) {
      throw new AppError('Too many attempts. Please try again later.', 429, 'RATE_LIMITED');
    }

    entry.count += 1;
    return;
  }

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
    prefix: 'chargeshare:ratelimit',
  });

  const { success } = await ratelimit.limit(identifier);

  if (!success) {
    throw new AppError('Too many attempts. Please try again later.', 429, 'RATE_LIMITED');
  }
}
