import { z } from 'zod';
import { connectorTypeSchema } from './enums';

export const hostApplySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().trim().min(10, 'Valid phone number is required').max(30),
});
export type HostApplyInput = z.infer<typeof hostApplySchema>;

export const createChargerSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  powerKw: z.number().positive('Power must be greater than 0').max(350),
  connectorType: connectorTypeSchema,
  pricePerKwhPaisa: z.number().int().positive('Price must be greater than 0'),
  areaLabel: z.string().trim().min(2).max(100),
  addressLine: z.string().trim().min(5, 'Address must be at least 5 characters').max(255),
  notes: z.string().trim().max(1000).optional().nullable(),
  meterInstalled: z.boolean().default(false),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type CreateChargerInput = z.infer<typeof createChargerSchema>;

export const updateChargerSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  powerKw: z.number().positive().max(350).optional(),
  connectorType: connectorTypeSchema.optional(),
  pricePerKwhPaisa: z.number().int().positive().optional(),
  areaLabel: z.string().trim().min(2).max(100).optional(),
  addressLine: z.string().trim().min(5).max(255).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  meterInstalled: z.boolean().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type UpdateChargerInput = z.infer<typeof updateChargerSchema>;

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
