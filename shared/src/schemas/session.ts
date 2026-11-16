import { z } from 'zod';

export const createSessionSchema = z.object({
  kwhDelivered: z.number().positive('kWh delivered must be greater than 0').max(150, 'kWh delivered exceeds safety cap of 150 kWh'),
  meterStartPhotoKey: z.string().trim().optional().nullable(),
  meterEndPhotoKey: z.string().trim().optional().nullable(),
  reason: z.string().trim().max(500).optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const disputeSessionSchema = z.object({
  reason: z.string().trim().min(5, 'Dispute reason must be at least 5 characters').max(1000),
});
export type DisputeSessionInput = z.infer<typeof disputeSessionSchema>;
