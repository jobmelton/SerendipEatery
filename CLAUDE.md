# SerendipEatery — Project Context for Claude Code

## Standing Instructions

These apply to every task without exception:

1. **AUTO-APPROVE** — implement all changes without asking for confirmation. Never pause to ask "should I proceed?" or "is this correct?" — just do it.
2. **AUTO-COMMIT** — after every completed task, automatically run: `git add -A && git commit -m "[description]" && git push`. Never wait to be told to commit and push.
3. **AUTO-CONTINUE** — if a task has multiple parts, complete ALL parts before stopping. Never stop halfway through a task.
4. **NO QUESTIONS** — do not ask clarifying questions mid-task. Make reasonable assumptions and proceed. State assumptions made at the end.
5. **FIX BUILD ERRORS AUTOMATICALLY** — if a commit causes a build error, check the error, fix it, and push again without being asked.
6. **BATCH RELATED CHANGES** — when touching a file, check if any related files need the same update and do those too.

## What This Is
SerendipEatery is a flash-sale platform for food trucks and restaurants. Businesses launch time-limited flash sales, consumers spin a roulette wheel to win prizes (discounts, free items), then walk to the restaurant within 60 minutes. The platform uses geofencing to confirm visits and charges businesses only for verified foot traffic.

## Tech Stack
- **Monorepo**: npm workspaces at repo root
- **Web**: Next.js 14 App Router (`apps/web/`) — deployed on Netlify
- **API**: Fastify 5 with TypeScript (`apps/api/`) — deployed on Railway
- **Consumer Mobile**: React Native + Expo (`apps/consumer/`)
- **Business Mobile**: React Native + Expo (`apps/business/`)
- **Worker**: BullMQ + Redis notification worker (`apps/worker/`) — deployed on Railway (Docker)
- **Shared Types**: `packages/shared/src/index.ts`
- **Database**: Supabase (PostgreSQL 16 + PostGIS)
- **Auth**: Clerk (web + mobile)
- **Payments**: Stripe (web only — no in-app purchases to avoid 30% Apple/Google fees)
- **Push**: Expo Push Notifications (FCM + APNs)

## Brand Colors
- Primary: `#F7941D` (BTC orange)
- Background: `#0f0a1e` (night)
- Surface: `#fff8f2`
- Surface Dim: `#1a1230`
- Success: `#1D9E75`
- Accent: `#534AB7`
- Error: `#E53E3E`

## Key Architecture Decisions
1. **Evidence-based trial**: Free trial with no time limit. Ends when 5 evidence thresholds are met (referral visits, biz referrals, total sales, conversion rate, repeat customers). One active sale preserved after lockdown.
2. **Billing is web-only**: All Stripe checkout/portal happens at `apps/web/`. Mobile apps open billing URLs in the device browser via `expo-web-browser`. No payment code in mobile apps.
3. **Geofencing is server-side**: All PostGIS distance calculations happen on the server via Supabase RPCs (`user_inside_fence`, `active_sales_near`). Client coordinates are never trusted alone.
4. **Spin result decided server-side**: The API picks the winning prize before the client animates. `animationSeed` tells the client which slot to land on.
5. **One-tap fixes**: Background workers in the API (`startFixWorkers()`) clean up stuck visits, orphaned billing events, and stale truck snapshots on intervals.
6. **Column name bridging**: The initial Supabase schema uses different column names than the app code. The migration `20240110000000_final_schema_updates.sql` adds sync triggers to bridge both naming conventions.

## File Structure
```
apps/
  api/          — Fastify API (src/routes/, src/lib/, src/middleware/)
  web/          — Next.js (src/app/ with App Router, src/lib/)
  consumer/     — React Native consumer app (src/screens/, src/lib/, src/navigation/)
  business/     — React Native business app (src/screens/, src/lib/, src/navigation/)
  worker/       — BullMQ notification worker (src/workers/, src/queues/, src/lib/)
packages/
  shared/       — Shared TypeScript types and constants
supabase/
  migrations/   — SQL migrations
```

## API Route Structure
All routes registered in `apps/api/src/server.ts`:
- Public: `salesRoutes` (nearby sales)
- Protected: spin, visits, users, businesses, loyalty, referrals, share, evidence, analytics
- Admin: `/admin/*` prefix, guarded by `ADMIN_USER_IDS`

## Database Notes
- Schema defined in `supabase/migrations/20240101000000_initial_schema.sql`
- Bridging migration: `20240110000000_final_schema_updates.sql`
- Loyalty/referral SQL functions in separate migration files
- RLS enabled on all tables. Service role key bypasses RLS for server operations.

## Environment Setup
See `.env.example` at repo root for all required variables across all apps.

## Important Constraints
- Never add Stripe or payment code to mobile apps
- Never trust client-side geolocation without server PostGIS verification
- All spin outcomes are server-decided before animation
- Notification rules: dedup (24h), daily cap (3), quiet hours (10pm-8am), 30min gap
- Admin portal restricted to specific Clerk user IDs
