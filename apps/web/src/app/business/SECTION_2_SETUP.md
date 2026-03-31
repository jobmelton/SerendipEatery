# Section 2 — Database Schema + Supabase Setup

## Files delivered

| File | Destination in repo |
|------|---------------------|
| `supabase/migrations/20240101000000_initial_schema.sql` | `serendipeatery/supabase/migrations/` |
| `supabase/seed.sql` | `serendipeatery/supabase/` |
| `supabase/config.toml` | `serendipeatery/supabase/` |
| `packages/shared/src/types/database.ts` | `serendipeatery/packages/shared/src/types/` |
| `apps/api/src/lib/supabase.ts` | `serendipeatery/apps/api/src/lib/` |
| `.env.example` | `serendipeatery/` (root) |

---

## Step 1 — Create Supabase project

1. Go to https://supabase.com → New project
2. Name: **SerendipEatery**
3. Region: **US West (N. California)** — closest to Sacramento
4. Database password: save it somewhere safe
5. Wait for project to provision (~1 min)

---

## Step 2 — Enable PostGIS

In Supabase dashboard → **Database → Extensions**
Search for `postgis` → Enable it.

Or run in SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## Step 3 — Run the migration

In Supabase dashboard → **SQL Editor → New query**
Paste the entire contents of `20240101000000_initial_schema.sql` → Run.

You should see: *Success. No rows returned.*

---

## Step 4 — Run seed data (dev only)

In SQL Editor → New query
Paste `seed.sql` → Run.

This creates:
- 2 sample businesses (Fuego Tacos + Maya's Rolling Kitchen)
- 1 sample consumer user
- 1 active flash sale with 5 prizes
- Sample referral codes

---

## Step 5 — Copy environment variables

1. Copy `.env.example` to `.env.local` (web) and `.env` (api)
2. Fill in from Supabase dashboard → **Settings → API**:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon/public key
   - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (keep secret!)

---

## Step 6 — Install Supabase client

```bash
# In apps/api
cd apps/api
npm install @supabase/supabase-js

# In apps/web
cd apps/web
npm install @supabase/supabase-js
```

---

## Step 7 — Verify

Test the PostGIS helper function in SQL Editor:
```sql
SELECT * FROM active_sales_near(38.5816, -121.4944, 5);
```
Should return the seeded Fuego Tacos flash sale.

Test fence check:
```sql
SELECT user_inside_fence(
  'f1000000-0000-0000-0000-000000000001',
  38.5816,
  -121.4944
);
-- Returns: true (you're standing on it)
```

---

## What was built

### Tables (11)
`users` · `businesses` · `flash_sales` · `prizes` · `visit_intents` · `billing_events` · `geofence_snapshots` · `truck_location_pings` · `referrals` · `point_transactions` · `notifications`

### Enums (8)
`visit_state` · `sale_status` · `notification_type` · `business_type` · `billing_plan` · `referral_path` · `loyalty_tier` · `business_tier`

### Triggers (5)
- `set_updated_at()` on users, businesses, flash_sales, visit_intents
- `update_loyalty_tier()` — auto-updates tier when consumer_points changes
- `update_business_tier()` — auto-updates tier when business_points changes

### SQL Functions (3)
- `active_sales_near(lat, lng, radius_km)` — geospatial sale discovery
- `user_inside_fence(flash_sale_id, lat, lng)` — geofence check
- `set_updated_at()` — trigger helper

### Row Level Security
- RLS enabled on all tables
- Service role (API server) bypasses all policies
- Consumer users see only their own data
- Business owners manage only their own business
- Active flash sales and prizes are publicly readable

---

## Push to git

```bash
git add -A && git commit -m "Section 2: database schema + Supabase config" && git push
```

---

## Next: Section 3 — Auth (Clerk + 11 social logins)
