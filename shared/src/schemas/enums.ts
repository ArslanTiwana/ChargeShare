import { z } from 'zod';
import {
  USER_ROLES,
  PREFERRED_MODES,
  HOST_STATUSES,
  CONNECTOR_TYPES,
  APPROVAL_STATUSES,
  BOOKING_STATES,
  WALLET_TRANSACTION_TYPES,
  DISPUTE_STATUSES,
  EMAIL_TOKEN_TYPES,
} from '../types/enums';

export const userRoleSchema = z.enum(USER_ROLES);
export const preferredModeSchema = z.enum(PREFERRED_MODES);
export const hostStatusSchema = z.enum(HOST_STATUSES);
export const connectorTypeSchema = z.enum(CONNECTOR_TYPES);
export const approvalStatusSchema = z.enum(APPROVAL_STATUSES);
export const bookingStatusSchema = z.enum(BOOKING_STATES);
export const bookingStateSchema = bookingStatusSchema;
export const walletTransactionTypeSchema = z.enum(WALLET_TRANSACTION_TYPES);
export const disputeStatusSchema = z.enum(DISPUTE_STATUSES);
export const emailTokenTypeSchema = z.enum(EMAIL_TOKEN_TYPES);
