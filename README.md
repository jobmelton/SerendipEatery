# SerendipEatery

> Spin your next meal. Win a deal. Walk in.

Flash-sale platform for food trucks and restaurants. Businesses launch time-limited sales, consumers spin a roulette wheel to win prizes, then walk to the restaurant within 60 minutes. Geofencing confirms visits. Businesses pay only for verified foot traffic.

## Architecture

```
serendipeatery/
├── apps/
│   ├── web/          → Next.js 14 — dashboard, billing, pricing, admin portal (Netlify)
│   ├── api/          → Fastify 5 — spin engine, geofence, loyalty, analytics (Railway)
│   ├── consumer/     → React Native + Expo — consumer mobile app
│   ├── business/     → React Native + Expo — business owner mobile app
│   └── worker/       → BullMQ — notification worker with rules engine (Railway/Docker)
├── packages/
│   └── shared/       → TypeScript types and constants shared across all apps
├── supabase/
│   └── migrations/   → PostgreSQL + PostGIS schema and functions
├── CLAUDE.md         → Project context for Claude Code sessions
├── netlify.toml
└── package.json
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 14 (App Router), Tailwind CSS |
| API | Fastify 5, Zod validation, TypeScript |
| Mobile | React Native, Expo SDK 52, Reanimated 3 |
| Auth | Clerk (web + mobile) |
| Database | Supabase (PostgreSQL 16 + PostGIS) |
| Payments | Stripe (web only — no in-app purchases) |
| Push | Expo Push API (FCM + APNs) |
| Queue | BullMQ + Redis |
| Deploy | Netlify (web), Railway (API + worker) |

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- Redis (for worker)
- Expo Go app on your phone
- Supabase CLI (`npm install -g supabase`)

### Setup

```bash
git clone https://github.com/jobmelton/SerendipEatery.git
cd SerendipEatery
npm install

# Copy environment variables
cp .env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp .env.example apps/worker/.env
# Edit each file with your actual keys (see .env.example for details)
```

### Run Each App

```bash
# Web (Next.js) — http://localhost:3000
cd apps/web && npm run dev

# API (Fastify) — http://localhost:4000
cd apps/api && npm run dev

# Consumer mobile app
cd apps/consumer && npx expo start

# Business mobile app
cd apps/business && npx expo start

# Notification worker (requires Redis)
cd apps/worker && npm run dev
```

### Database Setup

```bash
# Start local Supabase
supabase start

# Run all migrations
supabase db push

# Migrations applied in order:
# 20240101000000_initial_schema.sql          — tables, enums, RLS, PostGIS functions
# 20240103000000_loyalty_functions.sql        — leaderboard, tier progress
# 20240104000000_referral_functions.sql       — validate code, referral stats
# 20240105000000_evidence_functions.sql       — evidence thresholds, progress
# 20240110000000_final_schema_updates.sql     — column bridging, helper RPCs, indexes
```

## Deployment

### Netlify (Web)

1. Connect repo → select `serendipeatery`
2. Build command: `cd apps/web && npm run build`
3. Publish directory: `apps/web/.next`
4. Set env vars from `apps/web/.env.example`
5. Custom domain: `serendip.app`

### Railway (API)

1. New project → deploy from GitHub
2. Root directory: `apps/api`
3. Uses `railway.json` for build config
4. Set env vars (Supabase, Clerk, admin IDs)
5. Health check: `/health`

### Railway (Worker)

1. Separate Railway service
2. Uses `apps/worker/Dockerfile`
3. Add Redis plugin (auto-sets `REDIS_URL`)
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Supabase

1. Create project at supabase.com
2. Enable PostGIS extension
3. Run all migrations in `supabase/migrations/` in order
4. Note: Uses service role key for server operations (bypasses RLS)

## Key Features

| Feature | Description |
|---------|-------------|
| Spin Wheel | Server-side prize selection, loyalty boost, ghost slots, race condition guard |
| Geofencing | PostGIS 10m radius check-in, food truck location tracking |
| Visit State Machine | spun_away → inside_fence → confirmed → billing event |
| Evidence Paywall | Free trial (no time limit), 5 thresholds, graduated prompts, hard lockdown |
| Loyalty | 8 consumer tiers (Explorer → Icon), 6 business tiers, cross-conversion |
| Referrals | 4 paths: user→user, user→biz, biz→customer, biz→biz |
| Notifications | 7 types, rules engine (dedup, daily cap, quiet hours, 30min gap) |
| Share Cards | Server-generated branded PNGs, Instagram/Twitter/iMessage sharing |
| Analytics | Business, consumer, sale-level, and platform-wide dashboards |
| Admin Portal | Platform overview, business management, sales monitor, notification worker |
| Billing | Stripe web-only: Trial (free), Starter ($29/mo), Growth ($79/mo), Pro ($5,940/5yr) |

## Build Progress

- [x] Section 1 — Monorepo + Netlify config
- [x] Section 2 — Database schema + Supabase + PostGIS
- [x] Section 3 — Clerk auth (web + mobile)
- [x] Section 4 — Fastify API server with full route structure
- [x] Section 5 — Server-side spin wheel engine
- [x] Section 6 — Geofencing + visit state machine
- [x] Section 7 — Consumer mobile app (map, spin, win, profile)
- [x] Section 8 — Business mobile app (dashboard, sales, analytics, settings)
- [x] Section 9 — Notification worker (BullMQ, rules engine, Expo push)
- [x] Section 10 — Loyalty and tier system
- [x] Section 11 — Referral system + Branch.io deep links
- [x] Section 12 — Social sharing + share cards
- [x] Section 13 — Stripe billing (web only)
- [x] Section 14 — Evidence paywall
- [x] Section 15 — Analytics engine + one-tap fixes
- [x] Section 16 — Admin portal
- [x] Section 17 — QA pass, schema bridging, documentation

## Environment Variables

See `.env.example` at repo root for the complete list with comments explaining where to get each value.

## License

Private — all rights reserved.
