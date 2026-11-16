# AGENTS.md: instructions for AI coding agents

Read `PROJECT_RULES.md` first. It holds the product flow, stack and decisions. This file says how to work in this repo.

## Project in one line
ChargeShare: a Pakistan marketplace for residential EV chargers. One Next.js app (API + admin) on Vercel, plus an Expo React Native app in `/mobile`.

## How to work
- We build in **phases**. Do only the phase the user asks for. Do not add features from later phases.
- **Show a short plan before making large changes.** Wait for approval on schema changes, auth changes and anything touching money.
- Keep changes small and focused. Do not refactor unrelated files.
- If a request conflicts with `PROJECT_RULES.md`, say so and ask before proceeding.
- At the end of each phase: run lint, type-check and build, report the results, then list what to test manually.
- Never invent requirements. If something is unclear, ask one short question.

## Structure
- `app/api/v1/*`: REST route handlers (thin: validate, call lib, respond)
- `app/admin/*`: admin pages
- `lib/*`: business logic (booking state machine, wallet ledger, auth, db client)
- `prisma/*`: schema and migrations
- `shared/*`: zod schemas and types used by both web and mobile
- `mobile/*`: Expo app (separate package.json; do not import from the Next.js app except via `shared/`)

## Coding conventions
- TypeScript strict. No `any` unless commented why.
- Validate every API input with a zod schema from `shared/`. Never trust client data.
- API response shape is always `{ data, error }`. Errors use consistent codes and HTTP statuses.
- Business rules live in `lib/`, not inside route handlers or UI components.
- Money is an integer (rupees or paise), never a float. Wallet balance comes from the append-only ledger.
- Booking status changes go only through the state machine in `lib/booking-state.ts`.
- Use Prisma for normal queries and `$queryRaw` for PostGIS. Always parameterize raw SQL.
- Use the pooled DB connection string. Do not hold connections open.
- Keep secrets in `.env`. Never commit them or print them. Keep `.env.example` current.

## Security rules
- Reveal a host's exact address and phone only after a booking is `accepted`.
- Authorize every endpoint: a user may only read or change their own bookings, chargers and wallet. Admin routes require an admin role.
- Rate-limit login, register, forgot-password and resend-verification. Hash passwords with bcryptjs. Store only hashes of refresh and email tokens. Auth is Google or email + password, with no phone OTP.
- Photo uploads go straight to storage through signed URLs, with type and size checks. End-of-charging meter photo is optional (there is no start photo). Top-up payment screenshot is required.

## Mobile rules
- Expo Router, TanStack Query for server data, Zustand for small local state.
- Route structure follows Expo Router standard: Root `<Stack>` in `mobile/app/_layout.tsx` containing `(auth)` group, `(tabs)` group, and root-level Stack detail screens (`charger/[id]`, `bookings/[id]`, `host-booking/[id]`, `host-booking/[id]/meter`, `host-charger/new`, `host-charger/[id]`, `host-wallet/topup`, `help`).
- `(tabs)` layout contains strictly the 7 real tab screens (`find`, `bookings`, `host-dashboard`, `host-bookings`, `host-chargers`, `host-wallet`, `profile`), hiding tabs of the opposite role using `href: null`. Detail screens must NEVER be placed inside `<Tabs>`.
- Typed routes enabled (`experiments.typedRoutes: true` in `app.json`). Navigation must always use typed router calls: `router.push({ pathname: '/charger/[id]', params: { id } })`, never untyped `navigation.navigate(...)` or unparameterized template strings.
- Follow the design in `PROJECT_RULES.md` section 8/9: light Uber/Careem style, Inter font, muted map, bottom sheet, one primary button per screen.
- Android first. Touch targets at least 44 px. Use real buttons and labels for accessibility. Targets Android 16 (API 36).
- Map: MapLibre or react-native-maps. No Google Places API. Hosts drop a pin; directions open the external maps app.

## Vercel rules
- `mobile/` must stay excluded from the Next.js build (`tsconfig.json` exclude and `.vercelignore`).
- No WebSockets. Use push notifications and polling. Use Vercel Cron for scheduled jobs.
- Request bodies are limited to about 4.5 MB.

## Commands (update if they change)
```
npm install            # root, Next.js app
npm run dev            # Next.js dev server
npm run lint
npm run build
npx prisma migrate dev # create/apply a migration locally
cd mobile && npm install && npx expo start   # mobile app
```

## Definition of done for a phase
1. Code matches `PROJECT_RULES.md`.
2. Lint, type-check and build pass.
3. New API routes validated with zod and checked for authorization.
4. `.env.example` and docs updated if anything changed.
5. A short summary of what changed and how to test it.