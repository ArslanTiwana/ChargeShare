# ChargeShare: Project Rules (source of truth)

Working name: **ChargeShare**. If anything in the code or a prompt conflicts with this file, this file wins. Update it when a decision changes.

## 1. Product
An Airbnb-style marketplace for **residential EV chargers in Pakistan**.
- **Hosts** (homeowners, often with solar) list a charger with power (kW), connector type, price per kWh and location.
- **Drivers** search a map for nearby chargers, pick a slot and request a booking.
- Why: public chargers are sparse (the next one can be 50 km away) and commercial rates are high.
- MVP pilot zone: a few sectors of Islamabad, about 10 hand-recruited hosts.

## 2. Core flow (v1: manual metering, no payment gateway)
1. Host signs up, adds a charger (pin drop on map, kW, connector, Rs per kWh) and waits for admin approval.
2. Driver finds a charger on the map, picks a slot, requests a booking.
3. Host accepts or declines. Exact address and phone are revealed only after acceptance.
4. Driver arrives and charges. A resettable plug-in kWh meter (rated 16A or higher) sits in front of the charger.
5. Host reads the meter and enters the kWh in the app (with an optional photo of the meter; there is no start photo).
6. App calculates price = kWh x host rate. Driver confirms the reading in the app.
7. **Driver pays the host directly** (cash or transfer, outside the app).
8. App records the **commission** owed. It is deducted from the host's prepaid wallet.
9. Host tops up the wallet via Easypaisa or JazzCash and uploads a screenshot. Admin approves it.
10. A host with zero wallet balance cannot accept new bookings.

Later phases: Easypaisa/JazzCash API payments, smart plugs with automatic kWh reading, phone OTP verification, iOS release.

## 3. Booking states
`requested -> accepted -> charging -> completed -> confirmed`
Side states: `declined`, `cancelled`, `expired`, `disputed`.
- Only valid transitions are allowed, enforced in one place (`lib/booking-state.ts`).
- `completed` = host entered kWh. `confirmed` = driver confirmed it. Commission is charged on `confirmed`.
- Unanswered `requested` bookings expire via Vercel Cron and lazy evaluation.

## 4. Authentication (decided)
- **Google sign-in or email + password.** No phone OTP for now.
- Mobile and web clients: short-lived JWT access token (15 min) + rotating refresh token (30 days, stored only as a SHA-256 hash; reuse of a revoked token revokes all of that user's tokens).
- Admin panel: email + password for users with role ADMIN, httpOnly secure cookie session.
- Google: client sends a Google ID token, the server verifies it with `google-auth-library` against `GOOGLE_CLIENT_IDS` (web, Android, iOS). A Google user with the same verified email as an existing user is linked to that account.
- Email/password: bcryptjs (cost 12). Email verification and password reset use single-use hashed tokens (verify 24 h, reset 1 h). Emails are sent with **Resend**.
- Rate limiting on login, register, forgot-password and resend-verification with **Upstash Redis** (`@upstash/ratelimit`).
- Login errors never reveal whether an email exists.
- **Phone is a plain, unverified contact field** (not unique). It is required before a user can book or host. Admin approval of every host is the trust control for the pilot.

## 5. Tech stack (locked)
| Area | Choice |
|---|---|
| Web + API + admin | **One Next.js app** (App Router, TypeScript, Tailwind) at the repo root, deployed to **Vercel** |
| API | REST route handlers under `app/api/v1/...` |
| Admin panel | `app/admin/...` in the same Next.js app (shadcn/ui) |
| Mobile | **Expo (React Native, TypeScript, Expo Router)** in `/mobile`, Android first |
| Mobile state | TanStack Query for server data, Zustand for small local state |
| Database | PostgreSQL + **PostGIS** (Neon or Supabase, pooled connection) |
| ORM | Prisma. Use `$queryRaw` for PostGIS queries |
| Validation | zod schemas in `/shared`, used by both API and mobile |
| Auth | See section 4 |
| Email | Resend |
| Rate limiting | Upstash Redis |
| Maps (mobile) | MapLibre or Google Maps SDK via react-native-maps. Muted, light map style |
| Nearby search | PostGIS "chargers within N km". No Google Places API |
| Host address | Host drops a pin or uses current location. No typed-address geocoding |
| Directions | Button opens Google Maps or Apple Maps with coordinates |
| File storage | Cloudflare R2 or Supabase Storage. Upload from phone via signed URL |
| Notifications | Expo Notifications (FCM) |
| Background jobs | Vercel Cron |
| Errors | Sentry |

## 6. Repo layout
```
/                     Next.js app (Vercel)
  app/admin/          admin panel
  app/api/v1/         auth, chargers, bookings, sessions, wallet, health
  lib/                db client, auth, email, geo, wallet, booking state machine, errors
  prisma/             schema.prisma + migrations + seed
  shared/             zod schemas + TS types (used by web and mobile)
  mobile/             Expo app, own package.json and node_modules
  PROJECT_RULES.md
  AGENTS.md
```
- `mobile/` is excluded in root `tsconfig.json` and listed in `.vercelignore`.
- `mobile/metro.config.js` uses `watchFolders` to reach `../shared`.

## 7. Data model
Tables: `User`, `RefreshToken`, `EmailToken`, `Charger` (PostGIS geography point), `Booking`, `Session` (kWh, photos, confirmations), `WalletTransaction` (append-only ledger), `WalletTopup` (screenshot + approval status), `Review`, `Dispute`, `AppConfig`.
- User: email (unique, lowercase), emailVerifiedAt, passwordHash (null for Google-only), googleId (unique, nullable), name, phone (nullable, unverified), avatarUrl, role (USER, ADMIN), preferredMode (DRIVER, HOST, nullable), hostStatus (NONE, PENDING, APPROVED, SUSPENDED), isActive.
- Charger: title, powerKw, connectorType, pricePerKwhPaisa, areaLabel, addressLine (private), notes, meterInstalled, isOnline, approvalStatus, rejectionReason (nullable), location (PostGIS point), publicLat/publicLng (random 150-300 m offset, recomputed only on >100m move).
- Booking: driverId, chargerId, startsAt, endsAt, status, rateSnapshotPaisa, estimatedKwh, expiresAt, cancelReason, cancelledById.
- Money is stored as integer paisa (1 Rs = 100 paisa), never floats.
- Wallet balance is derived from the ledger. Never edit or delete past ledger rows (enforced by a database trigger).
- Commission percent lives in `AppConfig` and is returned only to approved hosts via authenticated `/me`, never in `/config/public`.
- Public charger data never includes `addressLine` or exact `location`.
- Android builds target Android 16 (API level 36) per Google Play policy.

## 8. Platform constraints (Vercel serverless)
- Use the pooled DB connection string. Avoid long-lived connections.
- Request bodies are limited to about 4.5 MB: upload photos directly to storage with signed URLs.
- No WebSockets: use push notifications and polling.
- Vercel Hobby is non-commercial. Plan on Pro before real launch.

## 9. UI and design
- Style: light, clean, Uber/Careem-like. Full-screen muted map, draggable bottom sheet, one big primary action button per screen.
- Colors: ink `#0F172A`, emerald accent `#10B981` (text accent `#047857`), blue `#2563EB` for the user location, surface `#F1F4F6`, white background.
- Font: Inter. Touch targets at least 44 px.
- Design canvas (6 screens): https://claude.ai/artifact/KVgmqz5dQAYxfxrLq9wcAK
- MVP screens: driver (find on map, charger and slot, booking status and pay), host (dashboard with wallet and requests, add charger with pin drop, enter kWh). Plus sign in and sign up (Google button and email form) and profile (name, phone).

## 10. Safety and trust rules
- Require plug-in meters rated 16A or higher from a reputable brand. Warn hosts about cheap 10A plugs overheating.
- If a session is cut off (load shedding), bill only the kWh actually delivered.
- Host and driver ratings, a "report a problem" flow, and a dispute state exist from the start.
- Admin approves every host and every charger before it appears on the map.
- Reveal a host's exact address and phone only after a booking is `accepted`.

## 11. Phases
Order: **backend and admin first, then mobile.**
1. Scaffold repo and rules files (done)
2. Database schema + PostGIS
3. Auth (Google + email/password)
4. Host and charger APIs
5. Booking APIs + state machine
6. Meter readings, photos, wallet ledger
7. Admin panel
8. Mobile foundation + sign in
9. Mobile driver screens
10. Mobile host screens
11. Push notifications, polish, Vercel deploy

Work one phase at a time. Do not build features from later phases.

## 12. Out of scope for the MVP
Phone OTP, in-app payments, chat, smart-plug integration, OCPP chargers, surge pricing, iOS release, address autocomplete, in-app routing.

## 13. Environment variables
`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `APP_URL`, `GOOGLE_CLIENT_IDS`, `RESEND_API_KEY`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, storage keys (R2 or Supabase). Keep `.env.example` current. Never commit real secrets.

## 14. Open items (decide before launch)
- Commission percentage: [TBD]
- Legal check on reselling electricity in Pakistan (NEPRA / distribution company): [TBD]
- Database host (Neon or Supabase) and map tile provider: [TBD]
- Google Cloud OAuth setup (Web now; Android and iOS client IDs when mobile starts): [TBD]
- Final app name and domain: [TBD]