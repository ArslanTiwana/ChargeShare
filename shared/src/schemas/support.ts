import { z } from 'zod';

export const createSupportMessageSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().trim().email('Invalid email address'),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

export type CreateSupportMessageInput = z.infer<typeof createSupportMessageSchema>;

export const resolveSupportMessageSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED']),
});

export type ResolveSupportMessageInput = z.infer<typeof resolveSupportMessageSchema>;
