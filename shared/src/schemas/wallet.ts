import { z } from 'zod';

export const createTopupSchema = z.object({
  amountPaisa: z
    .number()
    .int('Amount must be an integer in paisa')
    .min(50000, 'Minimum top-up is Rs 500 (50,000 paisa)')
    .max(50000000, 'Maximum single top-up is Rs 500,000'),
  screenshotKey: z.string().trim().min(1, 'Payment screenshot key is required'),
  reference: z.string().trim().max(100).optional(),
});
export type CreateTopupInput = z.infer<typeof createTopupSchema>;
