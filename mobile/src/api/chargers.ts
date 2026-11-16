import { apiFetch } from './client';

export type ConnectorType = 'TYPE2' | 'CCS2' | 'CHADEMO' | 'GBT' | 'SOCKET_3PIN';

export interface NearbyCharger {
  id: string;
  title: string;
  powerKw: number;
  connectorType: ConnectorType;
  pricePerKwhPaisa: number;
  areaLabel: string;
  notes?: string | null;
  meterInstalled: boolean;
  isOnline: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  publicLat: number;
  publicLng: number;
  distanceMeters?: number;
  hostRatingAverage?: number | null;
}

export interface ChargerDetail extends NearbyCharger {
  hostName: string;
  reviewCount: number;
  addressLine?: string;
}

export interface BookedSlot {
  bookingId: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface ChargerAvailability {
  chargerId: string;
  date: string;
  timezone: string;
  bookedSlots: BookedSlot[];
}

export interface ReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  reviewerName: string;
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: ReviewItem[];
  nextCursor?: string | null;
}

export async function getNearbyChargers(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}): Promise<{ chargers: NearbyCharger[]; count: number }> {
  const query = new URLSearchParams({
    lat: params.lat.toString(),
    lng: params.lng.toString(),
    ...(params.radiusKm && { radiusKm: params.radiusKm.toString() }),
    ...(params.limit && { limit: params.limit.toString() }),
  });
  return apiFetch<{ chargers: NearbyCharger[]; count: number }>(`/chargers/nearby?${query.toString()}`);
}

export async function getChargerDetail(id: string): Promise<ChargerDetail> {
  return apiFetch<ChargerDetail>(`/chargers/${id}`);
}

export async function getChargerAvailability(id: string, date: string): Promise<ChargerAvailability> {
  return apiFetch<ChargerAvailability>(`/chargers/${id}/availability?date=${date}`);
}

export interface HostChargerItem {
  id: string;
  title: string;
  powerKw: number;
  connectorType: ConnectorType;
  pricePerKwhPaisa: number;
  areaLabel: string;
  addressLine: string;
  notes?: string | null;
  meterInstalled: boolean;
  isOnline: boolean;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  lat: number;
  lng: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChargerInput {
  title: string;
  powerKw: number;
  connectorType: ConnectorType;
  pricePerKwhPaisa: number;
  areaLabel: string;
  addressLine: string;
  notes?: string | null;
  meterInstalled: boolean;
  lat: number;
  lng: number;
}

export interface UpdateChargerInput {
  title?: string;
  powerKw?: number;
  connectorType?: ConnectorType;
  pricePerKwhPaisa?: number;
  areaLabel?: string;
  addressLine?: string;
  notes?: string | null;
  meterInstalled?: boolean;
  lat?: number;
  lng?: number;
}

export async function getMyChargers(cursor?: string, limit = 20): Promise<{
  chargers: HostChargerItem[];
  nextCursor?: string | null;
}> {
  const query = new URLSearchParams({
    limit: limit.toString(),
    ...(cursor && { cursor }),
  });
  return apiFetch<{ chargers: HostChargerItem[]; nextCursor?: string | null }>(
    `/chargers/mine?${query.toString()}`
  );
}

export async function createCharger(input: CreateChargerInput): Promise<HostChargerItem> {
  return apiFetch<HostChargerItem>('/chargers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCharger(id: string, input: UpdateChargerInput): Promise<HostChargerItem> {
  return apiFetch<HostChargerItem>(`/chargers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function setChargerOnline(id: string): Promise<{ isOnline: boolean }> {
  return apiFetch<{ isOnline: boolean }>(`/chargers/${id}/online`, {
    method: 'POST',
  });
}

export async function setChargerOffline(id: string): Promise<{ isOnline: boolean }> {
  return apiFetch<{ isOnline: boolean }>(`/chargers/${id}/offline`, {
    method: 'POST',
  });
}

export async function getChargerReviews(
  id: string,
  cursor?: string,
  limit = 10
): Promise<ReviewsResponse> {
  const query = new URLSearchParams({
    limit: limit.toString(),
    ...(cursor && { cursor }),
  });
  return apiFetch<ReviewsResponse>(`/chargers/${id}/reviews?${query.toString()}`);
}
