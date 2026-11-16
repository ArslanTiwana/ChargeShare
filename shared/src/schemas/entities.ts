import { z } from 'zod';
import {
  userRoleSchema,
  preferredModeSchema,
  hostStatusSchema,
  connectorTypeSchema,
  approvalStatusSchema,
  bookingStatusSchema,
  walletTransactionTypeSchema,
  disputeStatusSchema,
  emailTokenTypeSchema,
} from './enums';

export const userSchema = z.object({
  id: z.string().cuid(),
  email: z.string().email(),
  emailVerifiedAt: z.date().nullable(),
  googleId: z.string().nullable().optional(),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  role: userRoleSchema,
  preferredMode: preferredModeSchema.nullable().optional(),
  hostStatus: hostStatusSchema,
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type UserEntity = z.infer<typeof userSchema>;

export const chargerPublicSchema = z.object({
  id: z.string().cuid(),
  title: z.string(),
  powerKw: z.number().positive(),
  connectorType: connectorTypeSchema,
  pricePerKwhPaisa: z.number().int().nonnegative(),
  areaLabel: z.string(),
  notes: z.string().nullable().optional(),
  meterInstalled: z.boolean(),
  isOnline: z.boolean(),
  approvalStatus: approvalStatusSchema,
  publicLat: z.number(),
  publicLng: z.number(),
  distanceMeters: z.number().nonnegative().optional(),
  hostRatingAverage: z.number().nullable().optional(),
});
export type ChargerPublic = z.infer<typeof chargerPublicSchema>;

export const chargerPrivateSchema = chargerPublicSchema.extend({
  hostId: z.string().cuid(),
  addressLine: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ChargerPrivate = z.infer<typeof chargerPrivateSchema>;

export const bookingSchema = z.object({
  id: z.string().cuid(),
  driverId: z.string().cuid(),
  chargerId: z.string().cuid(),
  startsAt: z.date(),
  endsAt: z.date(),
  status: bookingStatusSchema,
  rateSnapshotPaisa: z.number().int().nonnegative().nullable().optional(),
  estimatedKwh: z.number().positive().nullable().optional(),
  expiresAt: z.date().nullable().optional(),
  cancelReason: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type BookingEntity = z.infer<typeof bookingSchema>;

export const sessionSchema = z.object({
  id: z.string().cuid(),
  bookingId: z.string().cuid(),
  kwhDelivered: z.number().nonnegative(),
  rateSnapshotPaisa: z.number().int().nonnegative(),
  totalPaisa: z.number().int().nonnegative(),
  commissionPaisa: z.number().int().nonnegative(),
  autoConfirmed: z.boolean().default(false),
  meterStartPhotoKey: z.string().nullable().optional(),
  meterEndPhotoKey: z.string().nullable().optional(),
  hostEnteredAt: z.date().nullable().optional(),
  driverConfirmedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type SessionEntity = z.infer<typeof sessionSchema>;

export const sessionEditSchema = z.object({
  id: z.string().cuid(),
  sessionId: z.string().cuid(),
  previousKwh: z.number().nonnegative(),
  newKwh: z.number().nonnegative(),
  reason: z.string().nullable().optional(),
  editedById: z.string().cuid(),
  createdAt: z.date(),
});
export type SessionEditEntity = z.infer<typeof sessionEditSchema>;

export const adminAuditLogSchema = z.object({
  id: z.string().cuid(),
  adminId: z.string().cuid(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date(),
});
export type AdminAuditLogEntity = z.infer<typeof adminAuditLogSchema>;

export const walletTransactionSchema = z.object({
  id: z.string().cuid(),
  hostId: z.string().cuid(),
  type: walletTransactionTypeSchema,
  amountPaisa: z.number().int(),
  bookingId: z.string().cuid().nullable().optional(),
  topupId: z.string().cuid().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.date(),
});
export type WalletTransactionEntity = z.infer<typeof walletTransactionSchema>;

export const walletTopupSchema = z.object({
  id: z.string().cuid(),
  hostId: z.string().cuid(),
  amountPaisa: z.number().int().positive(),
  screenshotKey: z.string(),
  reference: z.string().nullable().optional(),
  status: approvalStatusSchema,
  reviewedById: z.string().cuid().nullable().optional(),
  reviewedAt: z.date().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type WalletTopupEntity = z.infer<typeof walletTopupSchema>;

export const reviewSchema = z.object({
  id: z.string().cuid(),
  bookingId: z.string().cuid(),
  reviewerId: z.string().cuid(),
  revieweeId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ReviewEntity = z.infer<typeof reviewSchema>;

export const disputeSchema = z.object({
  id: z.string().cuid(),
  bookingId: z.string().cuid(),
  openedById: z.string().cuid(),
  reason: z.string(),
  status: disputeStatusSchema,
  resolution: z.string().nullable().optional(),
  resolvedById: z.string().cuid().nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DisputeEntity = z.infer<typeof disputeSchema>;

export const appConfigSchema = z.object({
  id: z.string().cuid(),
  key: z.string(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type AppConfigEntity = z.infer<typeof appConfigSchema>;

export const nearbyChargersQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(10),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type NearbyChargersQuery = z.infer<typeof nearbyChargersQuerySchema>;
