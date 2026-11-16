import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  service: z.string(),
  version: z.string(),
  uptime: z.number().nonnegative(),
});

export type HealthResponseData = z.infer<typeof healthResponseSchema>;
