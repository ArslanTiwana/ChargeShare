import { apiFetch } from './client';
import { ConnectorType } from './chargers';

export type BookingStatus =
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'CHARGING'
  | 'COMPLETED'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'DISPUTED';

export interface BookingSession {
  id: string;
  kwhDelivered: number;
  rateSnapshotPaisa: number;
  totalPaisa: number;
  commissionPaisa: number;
  meterStartPhotoKey?: string | null;
  meterEndPhotoKey?: string | null;
  hostEnteredAt: string;
  driverConfirmedAt?: string | null;
  autoConfirmed?: boolean;
}

export interface BookingListItem {
  id: string;
  driverId: string;
  chargerId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  rateSnapshotPaisa?: number | null;
  estimatedKwh?: number | null;
  expiresAt?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  charger: {
    id: string;
    title: string;
    areaLabel: string;
    powerKw: number;
    connectorType: ConnectorType;
    pricePerKwhPaisa: number;
    addressLine?: string;
  };
  host: {
    id: string;
    name: string;
    phone?: string;
  };
  driver?: {
    id: string;
    name: string;
    phone?: string;
  };
}

export interface BookingDetail extends BookingListItem {
  serverTime: string;
  charger: BookingListItem['charger'] & {
    publicLat?: number;
    publicLng?: number;
    lat?: number;
    lng?: number;
  };
  driver: {
    id: string;
    name: string;
    phone?: string;
  };
  session?: BookingSession | null;
}

export interface CreateBookingInput {
  chargerId: string;
  startsAt: string;
  endsAt: string;
  estimatedKwh?: number;
}

export async function createBooking(input: CreateBookingInput): Promise<BookingDetail> {
  return apiFetch<BookingDetail>('/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getBookings(params: {
  role?: 'driver' | 'host';
  status?: BookingStatus;
  cursor?: string;
  limit?: number;
}): Promise<{ bookings: BookingListItem[]; nextCursor: string | null }> {
  const query = new URLSearchParams({
    role: params.role || 'driver',
    ...(params.status && { status: params.status }),
    ...(params.cursor && { cursor: params.cursor }),
    ...(params.limit && { limit: params.limit.toString() }),
  });
  return apiFetch<{ bookings: BookingListItem[]; nextCursor: string | null }>(`/bookings?${query.toString()}`);
}

export async function getBookingDetail(id: string): Promise<BookingDetail> {
  return apiFetch<BookingDetail>(`/bookings/${id}`);
}

export async function acceptBooking(id: string): Promise<{ id: string; status: BookingStatus; message: string }> {
  return apiFetch<{ id: string; status: BookingStatus; message: string }>(`/bookings/${id}/accept`, {
    method: 'POST',
  });
}

export async function declineBooking(id: string, reason?: string): Promise<{ id: string; status: BookingStatus; message: string }> {
  return apiFetch<{ id: string; status: BookingStatus; message: string }>(`/bookings/${id}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Host declined booking request' }),
  });
}

export async function startBooking(id: string): Promise<{ id: string; status: BookingStatus; message: string }> {
  return apiFetch<{ id: string; status: BookingStatus; message: string }>(`/bookings/${id}/start`, {
    method: 'POST',
  });
}

export async function submitMeterReading(
  id: string,
  data: { kwhDelivered: number; meterEndPhotoKey?: string | null; reason?: string }
): Promise<{ sessionId: string; bookingId: string; bookingStatus: BookingStatus; revised: boolean }> {
  return apiFetch<{ sessionId: string; bookingId: string; bookingStatus: BookingStatus; revised: boolean }>(
    `/bookings/${id}/session`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

export async function cancelBooking(id: string, reason: string): Promise<{ id: string; status: BookingStatus; message: string }> {
  return apiFetch<{ id: string; status: BookingStatus; message: string }>(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function confirmBooking(id: string): Promise<{ bookingId: string; status: BookingStatus; message: string }> {
  return apiFetch<{ bookingId: string; status: BookingStatus; message: string }>(`/bookings/${id}/session/confirm`, {
    method: 'POST',
  });
}

export async function disputeBooking(id: string, reason: string): Promise<{ disputeId: string; bookingId: string; status: BookingStatus; message: string }> {
  return apiFetch<{ disputeId: string; bookingId: string; status: BookingStatus; message: string }>(`/bookings/${id}/session/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function createReview(
  bookingId: string,
  input: { rating: number; comment?: string }
): Promise<{ id: string; rating: number; comment?: string | null }> {
  return apiFetch<{ id: string; rating: number; comment?: string | null }>(`/bookings/${bookingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getReadUrl(key: string): Promise<{ key: string; readUrl: string; expiresInSeconds: number }> {
  return apiFetch<{ key: string; readUrl: string; expiresInSeconds: number }>(`/uploads/read-url?key=${encodeURIComponent(key)}`);
}
