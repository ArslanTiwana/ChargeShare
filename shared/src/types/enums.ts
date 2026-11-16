export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PREFERRED_MODES = ['DRIVER', 'HOST'] as const;
export type PreferredMode = (typeof PREFERRED_MODES)[number];

export const HOST_STATUSES = ['NONE', 'PENDING', 'APPROVED', 'SUSPENDED'] as const;
export type HostStatus = (typeof HOST_STATUSES)[number];

export const CONNECTOR_TYPES = ['TYPE2', 'CCS2', 'CHADEMO', 'GBT', 'SOCKET_3PIN'] as const;
export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

export const APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const BOOKING_STATES = [
  'REQUESTED',
  'ACCEPTED',
  'CHARGING',
  'COMPLETED',
  'CONFIRMED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
  'DISPUTED',
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];
export type BookingStatus = BookingState;

export const WALLET_TRANSACTION_TYPES = ['TOPUP', 'COMMISSION', 'ADJUSTMENT'] as const;
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

export const DISPUTE_STATUSES = ['OPEN', 'RESOLVED'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const EMAIL_TOKEN_TYPES = ['VERIFY_EMAIL', 'RESET_PASSWORD'] as const;
export type EmailTokenType = (typeof EMAIL_TOKEN_TYPES)[number];
