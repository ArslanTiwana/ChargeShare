export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  preferredMode: 'DRIVER' | 'HOST' | null;
  hostStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'SUSPENDED';
  commissionPercent?: number;
  isActive: boolean;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthResponseData {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
}
