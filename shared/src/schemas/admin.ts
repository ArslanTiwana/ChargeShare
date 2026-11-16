import { z } from 'zod';
import { hostStatusSchema, approvalStatusSchema, bookingStatusSchema, disputeStatusSchema } from './enums';

export const rejectReasonSchema = z.object({
  reason: z.string().trim().min(3, 'A reason of at least 3 characters is required').max(500),
});
export type RejectReasonInput = z.infer<typeof rejectReasonSchema>;

export const adminConfigUpdateSchema = z
  .record(z.string().min(1), z.string())
  .superRefine((val, ctx) => {
    if (val.topupInstructions && val.topupInstructions.length > 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 1000,
        type: 'string',
        inclusive: true,
        path: ['topupInstructions'],
        message: 'topupInstructions must not exceed 1000 characters',
      });
    }
  });
export type AdminConfigUpdateInput = z.infer<typeof adminConfigUpdateSchema>;

export const adminBookingFiltersSchema = z.object({
  status: bookingStatusSchema.optional(),
  chargerId: z.string().optional(),
  driverId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminBookingFiltersQuery = z.infer<typeof adminBookingFiltersSchema>;

export const adminDisputesFiltersSchema = z.object({
  status: disputeStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminDisputesFiltersQuery = z.infer<typeof adminDisputesFiltersSchema>;

export const adminUsersFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  hostStatus: hostStatusSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminUsersFiltersQuery = z.infer<typeof adminUsersFiltersSchema>;

export const adminAuditLogFiltersSchema = z.object({
  action: z.string().optional(),
  adminId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminAuditLogFiltersQuery = z.infer<typeof adminAuditLogFiltersSchema>;
