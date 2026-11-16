import { z } from 'zod';
import { bookingStatusSchema } from './enums';

export { bookingStatusSchema, bookingStateSchema } from './enums';

export const createBookingSchema = z
  .object({
    chargerId: z.string().trim().min(1, 'Valid charger ID is required'),
    startsAt: z.string().datetime({ message: 'startsAt must be an ISO datetime string' }),
    endsAt: z.string().datetime({ message: 'endsAt must be an ISO datetime string' }),
    estimatedKwh: z.number().positive().max(200).optional(),
  })
  .refine(
    (data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(),
    {
      message: 'endsAt must be strictly after startsAt',
      path: ['endsAt'],
    }
  );
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
  reason: z.string().trim().min(3, 'Cancellation reason must be at least 3 characters').max(500),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const updateBookingStatusSchema = z.object({
  status: bookingStatusSchema,
  reason: z.string().trim().max(500).optional(),
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;

export const listBookingsQuerySchema = z.object({
  role: z.enum(['driver', 'host']).optional(),
  status: bookingStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
