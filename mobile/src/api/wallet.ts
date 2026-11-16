import { apiFetch } from './client';

export type WalletTransactionType = 'TOPUP' | 'COMMISSION' | 'ADJUSTMENT';
export type TopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WalletTransactionItem {
  id: string;
  type: WalletTransactionType;
  amountPaisa: number;
  bookingId?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface WalletResponse {
  balancePaisa: number;
  transactions: WalletTransactionItem[];
  nextCursor?: string | null;
}

export interface WalletTopupItem {
  id: string;
  amountPaisa: number;
  reference?: string | null;
  screenshotKey: string;
  status: TopupStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopupsResponse {
  topups: WalletTopupItem[];
  nextCursor?: string | null;
}

export interface CreateTopupInput {
  amountPaisa: number;
  reference?: string;
  screenshotKey: string;
}

export async function getWallet(cursor?: string, limit = 20): Promise<WalletResponse> {
  const query = new URLSearchParams({
    limit: limit.toString(),
    ...(cursor && { cursor }),
  });
  return apiFetch<WalletResponse>(`/wallet?${query.toString()}`);
}

export async function getTopups(cursor?: string, limit = 20): Promise<TopupsResponse> {
  const query = new URLSearchParams({
    limit: limit.toString(),
    ...(cursor && { cursor }),
  });
  return apiFetch<TopupsResponse>(`/wallet/topups?${query.toString()}`);
}

export async function createTopup(input: CreateTopupInput): Promise<WalletTopupItem> {
  return apiFetch<WalletTopupItem>('/wallet/topups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
