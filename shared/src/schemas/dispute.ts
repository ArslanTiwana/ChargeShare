import { z } from 'zod';

export const createBookingDisputeSchema = z.object({
  reason: z.string().trim().min(5, 'Dispute reason must be at least 5 characters').max(1000),
});
export type CreateBookingDisputeInput = z.infer<typeof createBookingDisputeSchema>;

export const resolveDisputeSchema = z.object({
  resolution: z.string().trim().min(5, 'Resolution summary is required').max(1000),
  targetStatus: z.enum(['CONFIRMED', 'CANCELLED']),
  adjustmentPaisa: z.number().int().optional(),
  adjustmentNote: z.string().trim().min(5).optional(),
}).refine(
  (data) => {
    if (data.adjustmentPaisa !== undefined && data.adjustmentPaisa !== 0) {
      return !!data.adjustmentNote;
    }
    return true;
  },
  {
    message: 'An adjustment note is required when applying a financial adjustment',
    path: ['adjustmentNote'],
  }
);
export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
