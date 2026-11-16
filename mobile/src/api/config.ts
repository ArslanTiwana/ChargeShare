import { apiFetch } from './client';

export interface PublicConfig {
  bookingExpiryMinutes: number;
  autoConfirmHours: number;
  maxSessionKwh: number;
  minTopupPaisa: number;
  maxTopupPaisa: number;
  minBookingDurationHours: number;
  maxBookingDurationHours: number;
  commissionPercent?: number;
  startWindowMinutes?: number;
  topupInstructions: string;
  hostMinWalletWarningPaisa: number;
}

export async function getPublicConfig(): Promise<PublicConfig> {
  return apiFetch<PublicConfig>('/config/public', { skipAuth: true });
}
