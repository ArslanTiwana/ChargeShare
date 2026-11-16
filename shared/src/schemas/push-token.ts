import { z } from 'zod';

export const pushTokenRegisterSchema = z.object({
  token: z.string().trim().min(1, 'Token is required').max(255),
  platform: z.enum(['android', 'ios', 'web']),
});

export type PushTokenRegisterInput = z.infer<typeof pushTokenRegisterSchema>;

export const pushTokenDeleteSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

export type PushTokenDeleteInput = z.infer<typeof pushTokenDeleteSchema>;
