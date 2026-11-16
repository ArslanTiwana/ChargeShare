import { z } from 'zod';

export const inAppDeleteAccountSchema = z.object({
  password: z.string().optional(),
  confirmationText: z.literal('DELETE').optional(),
});

export type InAppDeleteAccountInput = z.infer<typeof inAppDeleteAccountSchema>;

export const requestAccountDeletionSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;

export const confirmAccountDeletionSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

export type ConfirmAccountDeletionInput = z.infer<typeof confirmAccountDeletionSchema>;
