# ChargeShare API Specification

All routes live under `/api/v1/*`.
All requests and responses use JSON.
Response format is always `{ data: T | null, error: { code: string, message: string, details?: any } | null }`.
Integer money is in **paisa** ($1\text{ PKR} = 100\text{ paisa}$).

---

## 1. Authentication (`/api/v1/auth/*` & `/api/v1/me`)

### `POST /api/v1/auth/register`
- **Auth**: None
- **Body**: `{ email: string, password: string (min 8), name: string, preferredMode?: "DRIVER" | "HOST" }`
- **Response**: `{ userId: string, email: string, message: string }`
- **Errors**: `400 BAD_REQUEST` (invalid preferredMode), `409 EMAIL_EXISTS`, `429 RATE_LIMITED`

### `POST /api/v1/auth/login`
- **Auth**: None
- **Body**: `{ email: string, password: string }`
- **Response**: `{ accessToken: string (15m), refreshToken: string (30d), user: { id, email, name, role, preferredMode, hostStatus, emailVerified } }`
- **Errors**: `401 UNAUTHORIZED` (generic, never reveals whether email exists), `429 RATE_LIMITED`

### `POST /api/v1/auth/google`
- **Auth**: None
- **Body**: `{ idToken: string }`
- **Response**: `{ accessToken: string, refreshToken: string, user: { id, email, name, avatarUrl, role, preferredMode, hostStatus, emailVerified } }`
- **Errors**: `401 UNAUTHORIZED`

### `POST /api/v1/auth/refresh`
- **Auth**: None
- **Body**: `{ refreshToken: string }`
- **Response**: `{ accessToken: string, refreshToken: string, user: { id, email, name, role, hostStatus } }`
- **Errors**: `401 UNAUTHORIZED` (revoked token reuse detection terminates all user sessions)

### `POST /api/v1/auth/logout`
- **Auth**: None
- **Body**: `{ refreshToken: string }`
- **Response**: `{ message: string }`

### `POST /api/v1/auth/verify-email`
- **Auth**: None
- **Body**: `{ token: string, email: string }`
- **Response**: `{ message: string }`
- **Errors**: `400 INVALID_TOKEN`, `400 TOKEN_EXPIRED`

### `POST /api/v1/auth/resend-verification`
- **Auth**: None
- **Body**: `{ email: string }`
- **Response**: `{ message: string }`

### `POST /api/v1/auth/forgot-password`
- **Auth**: None
- **Body**: `{ email: string }`
- **Response**: `{ message: string }`

### `POST /api/v1/auth/reset-password`
- **Auth**: None
- **Body**: `{ token: string, email: string, newPassword: string (min 8) }`
- **Response**: `{ message: string }`
- **Errors**: `400 INVALID_TOKEN`, `400 TOKEN_EXPIRED`

### `POST /api/v1/auth/admin/login`
- **Auth**: None
- **Headers**: `Origin` matching `APP_URL`
- **Body**: `{ email: string, password: string }`
- **Response**: Sets `admin_session` cookie (`HttpOnly; Secure; SameSite=Strict; Path=/`). Body: `{ message: string, admin: { id, email, name, role } }`
- **Errors**: `401 UNAUTHORIZED`, `403 FORBIDDEN`

### `POST /api/v1/auth/admin/logout`
- **Auth**: None
- **Headers**: `Origin` matching `APP_URL`
- **Response**: Clears `admin_session` cookie (`Max-Age=0`). Body: `{ message: string }`

### `GET /api/v1/me`
- **Auth**: Bearer token (`requireAuth`)
- **Response**: `{ id, email, name, phone, avatarUrl, role, preferredMode, hostStatus, isActive, emailVerified, createdAt }`

### `PATCH /api/v1/me`
- **Auth**: Bearer token (`requireAuth`)
- **Body**: `{ name?: string, phone?: string, avatarUrl?: string, preferredMode?: "DRIVER" | "HOST" | null }`
- **Response**: Updated user profile
- **Errors**: `400 BAD_REQUEST` (invalid preferredMode)

---

## 2. Host & Charger Management (`/api/v1/host/*` & `/api/v1/chargers/*`)

### `POST /api/v1/host/apply`
- **Auth**: Bearer token (`requireAuth`)
- **Body**: `{ name?: string, phone: string }`
- **Response**: `{ message: string, hostStatus: "PENDING" }`

### `POST /api/v1/chargers`
- **Auth**: Bearer token (`requireApprovedHost`)
- **Body**: `{ title, powerKw, connectorType, pricePerKwhPaisa, areaLabel, addressLine, notes?, meterInstalled, lat, lng }`
- **Response**: Created charger object (`approvalStatus: "PENDING"`, `isOnline: false`)

### `GET /api/v1/chargers/mine`
- **Auth**: Bearer token (`requireApprovedHost`)
- **Query**: `?cursor=&limit=20` (max 50)
- **Response**: `{ chargers: Array<ChargerWithPrivateAddress>, nextCursor: string | null }`

### `GET /api/v1/chargers/nearby`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?lat=33.7&lng=73.05&radiusKm=10&limit=20`
- **Response**: `{ chargers: Array<ChargerPublic>, count: number }`
- **Privacy**: Returns `publicLat` and `publicLng` (approximate coordinates with a random 150-300m offset). Exact `lat`, `lng`, and `addressLine` are strictly omitted. `distanceMeters` is computed relative to the public coordinates to prevent triangulation.

### `GET /api/v1/chargers/:id`
- **Auth**: Bearer token (`requireAuth`)
- **Response**: Public charger details (`publicLat`, `publicLng`, `areaLabel`, `powerKw`, `connectorType`, `pricePerKwhPaisa`) + `hostRatingAverage` and `reviewCount`. `addressLine` and exact coordinates are included only if caller is host owner or admin.

### `PATCH /api/v1/chargers/:id`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Body**: Partial charger fields (`title`, `powerKw`, `connectorType`, `pricePerKwhPaisa`, `areaLabel`, `addressLine`, `notes`, `meterInstalled`)
- **Response**: Updated charger object

### `POST /api/v1/chargers/:id/online`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Condition**: Charger must be `APPROVED`
- **Response**: `{ id, isOnline: true, message: string }`

### `POST /api/v1/chargers/:id/offline`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Response**: `{ id, isOnline: false, message: string }`

### `GET /api/v1/chargers/:id/availability`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?date=YYYY-MM-DD` (Evaluated in `Asia/Karachi` timezone)
- **Response**: `{ chargerId, date, timezone: "Asia/Karachi", bookedSlots: [{ bookingId, startsAt, endsAt, status }] }`
- **Side Effect**: Lazily expires any requested bookings past `expiresAt`.

---

## 3. Bookings (`/api/v1/bookings/*` & `/api/cron/*`)

### `POST /api/v1/bookings`
- **Auth**: Bearer token (`requireAuth`)
- **Body**: `{ chargerId: string, startsAt: ISOString, endsAt: ISOString, estimatedKwh?: number }`
- **Guards**: Duration 30m–4h, driver phone set, charger online & approved, host approved & wallet balance > 0, no slot overlap.
- **Concurrency & Duplicates**: Takes advisory lock `pg_advisory_xact_lock(hashtext('charger_' || chargerId))`. Returns `409 DUPLICATE_BOOKING` if the driver already has an active (`REQUESTED` or `ACCEPTED`) booking for the same charger overlapping the time slot. Returns `409 SLOT_OCCUPIED` if another driver has already booked the slot.
- **Response**: `{ id, driverId, chargerId, startsAt, endsAt, status: "REQUESTED", expiresAt, areaLabel }`

### `GET /api/v1/bookings`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?role=driver|host&status=&cursor=&limit=20`
- **Response**: `{ bookings: Array<BookingDetail>, nextCursor: string | null }`
- **Privacy**: `addressLine`, exact coordinates (`lat`, `lng`), and other party's phone revealed only when status is `ACCEPTED`, `CHARGING`, `COMPLETED`, or `CONFIRMED`.

### `GET /api/v1/bookings/:id`
- **Auth**: Bearer token (`requireAuth`, participant or admin)
- **Response**: Booking details with conditional disclosure of private contact/address info:
  - `serverTime`: ISO string of server timestamp (for client countdown synchronization).
  - `charger.addressLine`, `charger.lat`, `charger.lng`, and `host.phone` are present ONLY when booking status is `ACCEPTED`, `CHARGING`, `COMPLETED`, or `CONFIRMED`. While `REQUESTED`, only `publicLat`, `publicLng`, and `areaLabel` are exposed.

### `POST /api/v1/bookings/:id/accept`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Action**: Verifies wallet balance > 0, checks no concurrent overlap, snapshots `rateSnapshotPaisa`, transitions to `ACCEPTED`.
- **Response**: `{ id, status: "ACCEPTED", rateSnapshotPaisa, message: string }`

### `POST /api/v1/bookings/:id/decline`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Response**: `{ id, status: "DECLINED", message: string }`

### `POST /api/v1/bookings/:id/cancel`
- **Auth**: Bearer token (`requireAuth`, driver, host, or admin)
- **Body**: `{ reason: string }`
- **Response**: `{ id, status: "CANCELLED", cancelReason: string, message: string }`

### `POST /api/v1/bookings/:id/start`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Condition**: Status must be `ACCEPTED`
- **Response**: `{ id, status: "CHARGING", message: string }`

### `GET /api/cron/expire-bookings`
- **Auth**: `Authorization: Bearer <CRON_SECRET>`
- **Response**: `{ message: string, expiredCount: number, timestamp: string }`

---

## 4. File Uploads (`/api/v1/uploads/*`)

### `POST /api/v1/uploads/sign`
- **Auth**: Bearer token (`requireAuth`)
- **Body**: `{ purpose: "METER_PHOTO" | "TOPUP_SCREENSHOT", mimeType: "image/jpeg" | "image/png" | "image/webp", fileSizeBytes: number (<= 5 MB) }`
- **Response**: `{ uploadUrl: string, key: string, expiresInSeconds: 900 }`

### `GET /api/v1/uploads/read-url`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?key=objectKey`
- **Authorization**: Authorized only if caller is upload owner, booking party for meter photos, or admin.
- **Response**: `{ key: string, readUrl: string, expiresInSeconds: 900 }`

---

## 5. Sessions & Commission (`/api/v1/bookings/:id/session/*`)

### `POST /api/v1/bookings/:id/session`
- **Auth**: Bearer token (`requireApprovedHost` + charger ownership)
- **Condition**: Status must be `CHARGING` (or `COMPLETED` for reading revision before confirmation)
- **Body**: `{ kwhDelivered: number (0-150), meterEndPhotoKey?: string | null, reason?: string }`
- **Photos**: Meter photo is optional (there is no start photo). If provided, validated against caller's storage prefix.
- **Calculations**:
  - `totalPaisa = Math.round(kwhDelivered * rateSnapshotPaisa)`
  - `commissionPaisa = Math.round(totalPaisa * commissionPercent / 100)`
- **Response**: `{ sessionId, bookingId, bookingStatus: "COMPLETED", kwhDelivered, totalPaisa, commissionPaisa, revised: boolean }`

### `POST /api/v1/bookings/:id/session/confirm`
- **Auth**: Bearer token (`requireAuth`, driver of booking or admin)
- **Condition**: Status must be `COMPLETED`
- **Transaction & Idempotency**:
  - Sets `driverConfirmedAt = new Date()`
  - Transitions booking to `CONFIRMED`
  - Creates `COMMISSION` `WalletTransaction` with negative `amountPaisa` (`-commissionPaisa`)
  - Guaranteed idempotent at application level and database level via partial unique index.
- **Response**: `{ bookingId, status: "CONFIRMED", commissionDeductedPaisa, idempotent: boolean }`

### `POST /api/v1/bookings/:id/session/dispute`
- **Auth**: Bearer token (`requireAuth`, driver of booking)
- **Condition**: Status must be `COMPLETED`
- **Body**: `{ reason: string }`
- **Action**: Transitions booking to `DISPUTED` and creates a single `Dispute` record. No commission deducted.
- **Response**: `{ bookingId, disputeId, status: "DISPUTED" }`

### `GET /api/cron/auto-confirm-sessions`
- **Auth**: `Authorization: Bearer <CRON_SECRET>`
- **Schedule**: Once daily via `vercel.json`
- **Action**: Auto-confirms sessions where `hostEnteredAt` is older than `autoConfirmHours` (default 24h), marks `autoConfirmed = true`, and deducts commission.

---

## 6. Wallet (`/api/v1/wallet/*`)

### `GET /api/v1/wallet`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?cursor=&limit=20` (max 50)
- **Response**: `{ hostId, balancePaisa: number, balanceRupees: string, transactions: Array<WalletTransaction>, nextCursor }`

### `POST /api/v1/wallet/topups`
- **Auth**: Bearer token (`requireAuth`, host account)
- **Body**: `{ amountPaisa: number (>= 50,000 paisa / Rs 500), screenshotKey: string, reference?: string }`
- **Response**: `{ id, amountPaisa, amountRupees, status: "PENDING", createdAt }`

### `GET /api/v1/wallet/topups`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?cursor=&limit=20`
- **Response**: `{ topups: Array<WalletTopupDetail>, nextCursor }`

---

## 7. Reviews & Disputes (`/api/v1/bookings/:id/reviews`, `/api/v1/chargers/:id/reviews`, `/api/v1/bookings/:id/disputes`, `/api/v1/disputes/mine`)

### `POST /api/v1/bookings/:id/reviews`
- **Auth**: Bearer token (`requireAuth`, booking driver or host)
- **Condition**: Booking must be in `CONFIRMED` status.
- **Rule**: Exactly 1 review per user per booking.
- **Body**: `{ rating: number (1-5), comment?: string }`
- **Response**: `{ id, bookingId, rating, comment, createdAt, message }`
- **Errors**: `400 NOT_CONFIRMED`, `409 ALREADY_REVIEWED`, `403 FORBIDDEN`

### `GET /api/v1/chargers/:id/reviews`
- **Auth**: None (Public)
- **Query**: `?cursor=&limit=20`
- **Response**: `{ chargerId, averageRating: number | null, totalReviews: number, reviews: Array<ReviewSummary>, nextCursor }`

### `POST /api/v1/bookings/:id/disputes`
- **Auth**: Bearer token (`requireAuth`, booking driver or host)
- **Condition**: Booking must be in `ACCEPTED`, `CHARGING`, or `COMPLETED` status.
- **Rule**: At most 1 Dispute per booking across entire lifecycle (enforced by DB unique constraint).
- **Body**: `{ reason: string }`
- **Response**: `{ disputeId, bookingId, status: "OPEN", message }`
- **Errors**: `400 INVALID_STATUS`, `409 DISPUTE_EXISTS`, `403 FORBIDDEN`

### `GET /api/v1/disputes/mine`
- **Auth**: Bearer token (`requireAuth`)
- **Query**: `?cursor=&limit=20`
- **Response**: `{ disputes: Array<DisputeDetail>, nextCursor }`

---

## 8. Admin API (`/api/v1/admin/*`)

> **Admin Auth Rules**:
> 1. Requires valid `admin_session` HTTP-only cookie signed by platform admin.
> 2. `Authorization: Bearer <token>` is **strictly rejected with 403 Forbidden**.
> 3. Non-GET requests enforce CSRF protection by requiring `Origin === APP_URL`.
> 4. All admin write actions are logged to `AdminAuditLog` in the same transaction.

### `GET /api/v1/admin/stats`
- **Response**: `{ users, hostsPending, chargersPending, openDisputes, pendingTopups, totalCommissionCollectedPaisa, totalCommissionCollectedRupees, bookingsByStatus }`

### `GET /api/v1/admin/hosts`
- **Query**: `?status=PENDING&cursor=&limit=20`
- **Response**: `{ items: Array<HostDetail>, nextCursor }`

### `POST /api/v1/admin/hosts/:id/approve`
- **Action**: Sets `hostStatus = 'APPROVED'`, creates `AdminAuditLog`.
- **Response**: `{ id, hostStatus: "APPROVED", idempotent: boolean }`

### `POST /api/v1/admin/hosts/:id/suspend`
- **Action**: Sets `hostStatus = 'SUSPENDED'`, takes all host chargers offline (`isOnline = false`), creates `AdminAuditLog`.
- **Response**: `{ id, hostStatus: "SUSPENDED", chargersOfflineCount, idempotent: boolean }`

### `GET /api/v1/admin/chargers`
- **Query**: `?approvalStatus=PENDING&cursor=&limit=20`
- **Response**: `{ items: Array<ChargerDetail>, nextCursor }`

### `POST /api/v1/admin/chargers/:id/approve`
- **Action**: Sets `approvalStatus = 'APPROVED'`, creates `AdminAuditLog`.
- **Response**: `{ id, approvalStatus: "APPROVED", idempotent: boolean }`

### `POST /api/v1/admin/chargers/:id/reject`
- **Body**: `{ reason: string }`
- **Action**: Sets `approvalStatus = 'REJECTED'`, creates `AdminAuditLog`.
- **Response**: `{ id, approvalStatus: "REJECTED", idempotent: boolean }`

### `GET /api/v1/admin/topups`
- **Query**: `?status=PENDING&cursor=&limit=20`
- **Response**: `{ items: Array<WalletTopupWithHost>, nextCursor }`

### `POST /api/v1/admin/topups/:id/approve`
- **Action**: In one transaction: sets `status = 'APPROVED'`, credits `TOPUP` `WalletTransaction` (+amountPaisa), creates `AdminAuditLog`.
- **Idempotency**: Partial unique index on `WalletTransaction(topupId)` ensures host cannot be credited twice.
- **Response**: `{ id, status: "APPROVED", idempotent: boolean }`

### `POST /api/v1/admin/topups/:id/reject`
- **Body**: `{ reason: string }`
- **Action**: Sets `status = 'REJECTED'`, creates `AdminAuditLog`.
- **Response**: `{ id, status: "REJECTED", idempotent: boolean }`

### `GET /api/v1/admin/bookings`
- **Query**: `?status=&chargerId=&driverId=&date=YYYY-MM-DD&cursor=&limit=20`
- **Response**: `{ items: Array<BookingDetail>, nextCursor }`

### `GET /api/v1/admin/bookings/:id`
- **Response**: Full booking details, host & driver details, session with presigned photo read URLs, session edits history, dispute, reviews.

### `GET /api/v1/admin/disputes`
- **Query**: `?status=OPEN&cursor=&limit=20`
- **Response**: `{ items: Array<DisputeWithBooking>, nextCursor }`

### `POST /api/v1/admin/disputes/:id/resolve`
- **Body**: `{ resolution: string, targetStatus: "CONFIRMED" | "CANCELLED", adjustmentPaisa?: number, adjustmentNote?: string }`
- **Action**: In one transaction:
  - Updates dispute to `RESOLVED` with admin note and resolver ID.
  - Transitions booking to `targetStatus`.
  - If `targetStatus === 'CONFIRMED'`: creates `COMMISSION` `WalletTransaction` (idempotent).
  - If `targetStatus === 'CANCELLED'`: does NOT create commission transaction.
  - If `adjustmentPaisa` is provided: creates `ADJUSTMENT` `WalletTransaction`.
  - Logs `AdminAuditLog` (`DISPUTE_RESOLVED`).
- **Response**: `{ id, status: "RESOLVED", idempotent: boolean }`

### `GET /api/v1/admin/users`
- **Query**: `?search=&role=&hostStatus=&isActive=&cursor=&limit=20`
- **Response**: `{ items: Array<UserSummary>, nextCursor }`

### `POST /api/v1/admin/users/:id/activate`
- **Action**: Sets `isActive = true`, creates `AdminAuditLog`.
- **Response**: `{ id, isActive: true, idempotent: boolean }`

### `POST /api/v1/admin/users/:id/deactivate`
- **Action**: Forbids self-deactivation. Sets `isActive = false`, revokes all refresh tokens, creates `AdminAuditLog`.
- **Response**: `{ id, isActive: false, idempotent: boolean }`

### `GET /api/v1/admin/config`
- **Response**: `{ configs: Record<string, string>, items: Array<AppConfig> }`

### `PATCH /api/v1/admin/config`
- **Body**: `{ commissionPercent?: string, bookingExpiryMinutes?: string, autoConfirmHours?: string, maxSessionKwh?: string, minTopupPaisa?: string, maxTopupPaisa?: string }`
- **Action**: Upserts configuration keys, creates `AdminAuditLog`.
- **Response**: `{ updated: Array<{ key, value }> }`

### `GET /api/v1/admin/audit-log`
- **Query**: `?action=&adminId=&cursor=&limit=20`
- **Response**: `{ items: Array<AdminAuditLogEntry>, nextCursor }`

---

## 9. Public Platform Configuration (`/api/v1/config/*`)

### `GET /api/v1/config/public`
- **Auth**: None (Public)
- **Response**: `{ minBookingDurationHours: number, maxBookingDurationHours: number, bookingExpiryMinutes: number, autoConfirmHours: number, minTopupPaisa: number, maxTopupPaisa: number, maxSessionKwh: number, commissionPercent: number, topupInstructions: string, hostMinWalletWarningPaisa: number }`

