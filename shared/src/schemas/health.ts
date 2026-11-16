import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  timestamp: z.string().datetime(),
  service: z.string(),
  version: z.string(),
  uptime: z.number().nonnegative(),
  database: z.string().optional(),
});

export type HealthResponseData = z.infer<typeof healthResponseSchema>;
