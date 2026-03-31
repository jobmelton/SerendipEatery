#!/bin/bash
# ============================================================
# SerendipEatery — Section 2 Push Script
# Run from Git Bash at your repo root:
#   cd "/c/Users/job/Desktop/App projects/Serendipeatery/serendipeatery"
#   bash section2_push.sh
# ============================================================

set -e  # Stop on any error

echo ""
echo "🍊 SerendipEatery — Section 2: Database Schema + Supabase"
echo "============================================================"

# ── Create folder structure ──────────────────────────────────
echo "📁 Creating folders..."
mkdir -p supabase/migrations
mkdir -p packages/shared/src/types
mkdir -p apps/api/src/lib

# ============================================================
# FILE 1 — SQL Migration
# ============================================================
echo "📄 Writing migration SQL..."
cat > supabase/migrations/20240101000000_initial_schema.sql << 'SQLEOF'
-- ============================================================
-- SerendipEatery — Initial Schema Migration
-- PostgreSQL 16 + PostGIS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ENUMS
CREATE TYPE visit_state AS ENUM ('spun_away','inside_fence','confirmed','expired','influenced','passive');
CREATE TYPE sale_status AS ENUM ('scheduled','active','ended','cancelled');
CREATE TYPE notification_type AS ENUM ('sale_live','ending_soon','you_won','winner_reminder','visit_confirmed','truck_moved','new_sale_nearby');
CREATE TYPE business_type AS ENUM ('restaurant','food_truck');
CREATE TYPE billing_plan AS ENUM ('trial','starter','growth','pro');
CREATE TYPE referral_path AS ENUM ('user_user','user_biz','biz_customer','biz_biz');
CREATE TYPE loyalty_tier AS ENUM ('explorer','regular','local_legend','foodie_royale','tastemaker','influencer','food_legend','icon');
CREATE TYPE business_tier AS ENUM ('operator','hustler','grinder','vendor','business_owner','empire');

-- USERS
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id          TEXT UNIQUE NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  display_name      TEXT,
  avatar_url        TEXT,
  phone             TEXT,
  expo_push_token   TEXT,
  fcm_token         TEXT,
  apns_token        TEXT,
  consumer_points   INTEGER NOT NULL DEFAULT 0,
  loyalty_tier      loyalty_tier NOT NULL DEFAULT 'explorer',
  revenue_share_pct NUMERIC(4,2) NOT NULL DEFAULT 0,
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  max_daily_notifs  INTEGER NOT NULL DEFAULT 3,
  notification_radius_km NUMERIC(5,2) NOT NULL DEFAULT 5,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);

-- BUSINESSES
CREATE TABLE businesses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_org_id      TEXT UNIQUE,
  owner_clerk_id    TEXT NOT NULL,
  name              TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  description       TEXT,
  logo_url          TEXT,
  cover_url         TEXT,
  cuisine_tags      TEXT[],
  phone             TEXT,
  website           TEXT,
  business_type     business_type NOT NULL,
  address           TEXT,
  location          GEOMETRY(Point, 4326),
  billing_plan      billing_plan NOT NULL DEFAULT 'trial',
  stripe_customer_id TEXT,
  stripe_sub_id     TEXT,
  billing_cap_cents INTEGER,
  resubscription_price_cents INTEGER,
  plan_started_at   TIMESTAMPTZ,
  plan_ends_at      TIMESTAMPTZ,
  business_points   INTEGER NOT NULL DEFAULT 0,
  business_tier     business_tier NOT NULL DEFAULT 'operator',
  trial_referral_visits     INTEGER NOT NULL DEFAULT 0,
  trial_biz_referrals       INTEGER NOT NULL DEFAULT 0,
  trial_total_sales         INTEGER NOT NULL DEFAULT 0,
  trial_conversion_rate     NUMERIC(5,4) NOT NULL DEFAULT 0,
  trial_repeat_customers    INTEGER NOT NULL DEFAULT 0,
  trial_locked              BOOLEAN NOT NULL DEFAULT FALSE,
  trial_locked_at           TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_businesses_owner ON businesses(owner_clerk_id);
CREATE INDEX idx_businesses_location ON businesses USING GIST(location);
CREATE INDEX idx_businesses_slug ON businesses(slug);

-- FLASH SALES
CREATE TABLE flash_sales (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  status            sale_status NOT NULL DEFAULT 'scheduled',
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  spin_window_mins  INTEGER NOT NULL DEFAULT 60,
  fence_center      GEOMETRY(Point, 4326) NOT NULL,
  fence_radius_m    NUMERIC(8,2) NOT NULL DEFAULT 10,
  total_spins       INTEGER NOT NULL DEFAULT 0,
  confirmed_visits  INTEGER NOT NULL DEFAULT 0,
  influenced_visits INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_flash_sales_business ON flash_sales(business_id);
CREATE INDEX idx_flash_sales_status ON flash_sales(status);
CREATE INDEX idx_flash_sales_starts_at ON flash_sales(starts_at);
CREATE INDEX idx_flash_sales_fence ON flash_sales USING GIST(fence_center);

-- PRIZES
CREATE TABLE prizes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id     UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  description       TEXT,
  emoji             TEXT,
  image_url         TEXT,
  weight            INTEGER NOT NULL DEFAULT 1,
  max_spins         INTEGER NOT NULL DEFAULT 10,
  spins_used        INTEGER NOT NULL DEFAULT 0,
  is_ghost          BOOLEAN NOT NULL DEFAULT FALSE,
  base_weight       INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_prizes_flash_sale ON prizes(flash_sale_id);

-- VISIT INTENTS
CREATE TABLE visit_intents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flash_sale_id     UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  prize_id          UUID REFERENCES prizes(id),
  state             visit_state NOT NULL DEFAULT 'spun_away',
  spun_at           TIMESTAMPTZ,
  spin_location     GEOMETRY(Point, 4326),
  arrived_at        TIMESTAMPTZ,
  arrival_location  GEOMETRY(Point, 4326),
  confirmed_at      TIMESTAMPTZ,
  expired_at        TIMESTAMPTZ,
  spin_expires_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, flash_sale_id)
);
CREATE INDEX idx_visit_intents_user ON visit_intents(user_id);
CREATE INDEX idx_visit_intents_sale ON visit_intents(flash_sale_id);
CREATE INDEX idx_visit_intents_state ON visit_intents(state);
CREATE INDEX idx_visit_intents_spin_location ON visit_intents USING GIST(spin_location);

-- BILLING EVENTS
CREATE TABLE billing_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  visit_intent_id   UUID REFERENCES visit_intents(id),
  flash_sale_id     UUID REFERENCES flash_sales(id),
  event_type        TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  stripe_event_id   TEXT,
  billed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_billing_events_business ON billing_events(business_id);
CREATE INDEX idx_billing_events_billed_at ON billing_events(billed_at);

-- GEOFENCE SNAPSHOTS
CREATE TABLE geofence_snapshots (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id     UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  center            GEOMETRY(Point, 4326) NOT NULL,
  radius_m          NUMERIC(8,2) NOT NULL DEFAULT 10,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_geofence_snapshots_sale ON geofence_snapshots(flash_sale_id);
CREATE INDEX idx_geofence_snapshots_center ON geofence_snapshots USING GIST(center);

-- TRUCK LOCATION PINGS
CREATE TABLE truck_location_pings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  flash_sale_id     UUID REFERENCES flash_sales(id),
  location          GEOMETRY(Point, 4326) NOT NULL,
  accuracy_m        NUMERIC(6,2),
  pinged_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_truck_pings_business ON truck_location_pings(business_id);
CREATE INDEX idx_truck_pings_sale ON truck_location_pings(flash_sale_id);
CREATE INDEX idx_truck_pings_location ON truck_location_pings USING GIST(location);
CREATE INDEX idx_truck_pings_pinged_at ON truck_location_pings(pinged_at DESC);

-- REFERRALS
CREATE TABLE referrals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT UNIQUE NOT NULL,
  path              referral_path NOT NULL,
  referrer_user_id  UUID REFERENCES users(id),
  referrer_biz_id   UUID REFERENCES businesses(id),
  receiver_user_id  UUID REFERENCES users(id),
  receiver_biz_id   UUID REFERENCES businesses(id),
  referrer_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  receiver_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  trigger_event     TEXT,
  triggered_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_referrals_code ON referrals(code);
CREATE INDEX idx_referrals_referrer_user ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_referrer_biz ON referrals(referrer_biz_id);
CREATE INDEX idx_referrals_receiver_user ON referrals(receiver_user_id);

-- POINT TRANSACTIONS
CREATE TABLE point_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id),
  business_id       UUID REFERENCES businesses(id),
  points            INTEGER NOT NULL,
  reason            TEXT NOT NULL,
  reference_id      UUID,
  reference_type    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_point_txns_user ON point_transactions(user_id);
CREATE INDEX idx_point_txns_business ON point_transactions(business_id);
CREATE INDEX idx_point_txns_created_at ON point_transactions(created_at DESC);

-- NOTIFICATIONS
CREATE TABLE notifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              notification_type NOT NULL,
  title             TEXT NOT NULL,
  body              TEXT NOT NULL,
  data              JSONB,
  flash_sale_id     UUID REFERENCES flash_sales(id),
  business_id       UUID REFERENCES businesses(id),
  sent_at           TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  failed            BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reason    TEXT,
  dedup_key         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);
CREATE INDEX idx_notifications_dedup ON notifications(dedup_key);

-- UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_flash_sales_updated_at BEFORE UPDATE ON flash_sales FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_visit_intents_updated_at BEFORE UPDATE ON visit_intents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- LOYALTY TIER AUTO-UPDATE
CREATE OR REPLACE FUNCTION update_loyalty_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.loyalty_tier := CASE
    WHEN NEW.consumer_points >= 150000 THEN 'icon'
    WHEN NEW.consumer_points >= 60000  THEN 'food_legend'
    WHEN NEW.consumer_points >= 25000  THEN 'influencer'
    WHEN NEW.consumer_points >= 10000  THEN 'tastemaker'
    WHEN NEW.consumer_points >= 4000   THEN 'foodie_royale'
    WHEN NEW.consumer_points >= 1500   THEN 'local_legend'
    WHEN NEW.consumer_points >= 500    THEN 'regular'
    ELSE 'explorer'
  END;
  NEW.revenue_share_pct := CASE
    WHEN NEW.consumer_points >= 150000 THEN 10
    WHEN NEW.consumer_points >= 60000  THEN 5
    WHEN NEW.consumer_points >= 25000  THEN 2
    ELSE 0
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_users_loyalty_tier BEFORE INSERT OR UPDATE OF consumer_points ON users FOR EACH ROW EXECUTE FUNCTION update_loyalty_tier();

-- BUSINESS TIER AUTO-UPDATE
CREATE OR REPLACE FUNCTION update_business_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.business_tier := CASE
    WHEN NEW.business_points >= 50000 THEN 'empire'
    WHEN NEW.business_points >= 20000 THEN 'business_owner'
    WHEN NEW.business_points >= 8000  THEN 'vendor'
    WHEN NEW.business_points >= 3000  THEN 'grinder'
    WHEN NEW.business_points >= 1000  THEN 'hustler'
    ELSE 'operator'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_business_tier BEFORE INSERT OR UPDATE OF business_points ON businesses FOR EACH ROW EXECUTE FUNCTION update_business_tier();

-- GEOSPATIAL HELPERS
CREATE OR REPLACE FUNCTION active_sales_near(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius_km DOUBLE PRECISION DEFAULT 5)
RETURNS TABLE (sale_id UUID, business_id UUID, business_name TEXT, distance_m DOUBLE PRECISION) AS $$
BEGIN
  RETURN QUERY
  SELECT fs.id, b.id, b.name,
    ST_Distance(fs.fence_center::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) AS distance_m
  FROM flash_sales fs
  JOIN businesses b ON b.id = fs.business_id
  WHERE fs.status = 'active'
    AND ST_DWithin(fs.fence_center::geography, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography, radius_km * 1000)
  ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_inside_fence(p_flash_sale_id UUID, user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION)
RETURNS BOOLEAN AS $$
DECLARE v_center GEOMETRY; v_radius NUMERIC; v_distance DOUBLE PRECISION;
BEGIN
  SELECT fence_center, fence_radius_m INTO v_center, v_radius FROM flash_sales WHERE id = p_flash_sale_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  v_distance := ST_Distance(v_center::geography, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography);
  RETURN v_distance <= v_radius;
END;
$$ LANGUAGE plpgsql;

-- ROW LEVEL SECURITY
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own" ON users FOR ALL USING (clerk_id = current_setting('app.clerk_id', TRUE));
CREATE POLICY "visit_intents_own" ON visit_intents FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', TRUE)));
CREATE POLICY "notifications_own" ON notifications FOR SELECT USING (user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', TRUE)));
CREATE POLICY "flash_sales_public_read" ON flash_sales FOR SELECT USING (status = 'active');
CREATE POLICY "prizes_public_read" ON prizes FOR SELECT USING (TRUE);
CREATE POLICY "businesses_owner" ON businesses FOR ALL USING (owner_clerk_id = current_setting('app.clerk_id', TRUE));
SQLEOF

# ============================================================
# FILE 2 — Seed SQL
# ============================================================
echo "📄 Writing seed SQL..."
cat > supabase/seed.sql << 'SQLEOF'
-- SerendipEatery — Seed Data (development only)

INSERT INTO businesses (id, owner_clerk_id, name, slug, description, business_type, address, location, billing_plan) VALUES
  ('b1000000-0000-0000-0000-000000000001','user_seed_clerk_biz_01','Fuego Tacos','fuego-tacos','The hottest tacos in town. Flash sales every Friday.','restaurant','1234 Main St, Sacramento, CA 95814',ST_SetSRID(ST_MakePoint(-121.4944, 38.5816), 4326),'trial'),
  ('b1000000-0000-0000-0000-000000000002','user_seed_clerk_biz_02','Maya''s Rolling Kitchen','mayas-rolling-kitchen','Fusion street food. Follow the truck.','food_truck',NULL,NULL,'trial');

INSERT INTO users (id, clerk_id, email, display_name, consumer_points) VALUES
  ('u1000000-0000-0000-0000-000000000001','user_seed_clerk_consumer_01','alex@example.com','Alex Dev',0);

INSERT INTO flash_sales (id, business_id, title, description, status, starts_at, ends_at, spin_window_mins, fence_center, fence_radius_m) VALUES
  ('f1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Friday Fuego Flash','Spin to win free tacos and drinks!','active',NOW() - INTERVAL '10 minutes',NOW() + INTERVAL '50 minutes',60,ST_SetSRID(ST_MakePoint(-121.4944, 38.5816), 4326),10);

INSERT INTO prizes (flash_sale_id, label, emoji, weight, max_spins, base_weight) VALUES
  ('f1000000-0000-0000-0000-000000000001','Free Taco','🌮',40,20,40),
  ('f1000000-0000-0000-0000-000000000001','Free Drink','🥤',30,15,30),
  ('f1000000-0000-0000-0000-000000000001','10% Off','💸',20,50,20),
  ('f1000000-0000-0000-0000-000000000001','Free Guac','🥑',8,10,8),
  ('f1000000-0000-0000-0000-000000000001','Full Meal Free','🎉',2,3,2);

INSERT INTO referrals (code, path, referrer_user_id) VALUES ('ALEX-U01','user_user','u1000000-0000-0000-0000-000000000001');
INSERT INTO referrals (code, path, referrer_biz_id) VALUES ('FUEGO-C','biz_customer','b1000000-0000-0000-0000-000000000001'),('FUEGO-B','biz_biz','b1000000-0000-0000-0000-000000000001');
SQLEOF

# ============================================================
# FILE 3 — Supabase config
# ============================================================
echo "📄 Writing supabase config..."
cat > supabase/config.toml << 'EOF'
[api]
port = 54321
schemas = ["public", "storage"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 16

[studio]
port = 54323
api_url = "http://localhost"

[inbucket]
port = 54324

[storage]
enabled = true

[auth]
enabled = false
EOF

# ============================================================
# FILE 4 — Shared TypeScript types
# ============================================================
echo "📄 Writing shared TypeScript types..."
cat > packages/shared/src/types/database.ts << 'EOF'
// packages/shared/src/types/database.ts

export type VisitState = 'spun_away' | 'inside_fence' | 'confirmed' | 'expired' | 'influenced' | 'passive';
export type SaleStatus = 'scheduled' | 'active' | 'ended' | 'cancelled';
export type NotificationType = 'sale_live' | 'ending_soon' | 'you_won' | 'winner_reminder' | 'visit_confirmed' | 'truck_moved' | 'new_sale_nearby';
export type BusinessType = 'restaurant' | 'food_truck';
export type BillingPlan = 'trial' | 'starter' | 'growth' | 'pro';
export type ReferralPath = 'user_user' | 'user_biz' | 'biz_customer' | 'biz_biz';
export type LoyaltyTier = 'explorer' | 'regular' | 'local_legend' | 'foodie_royale' | 'tastemaker' | 'influencer' | 'food_legend' | 'icon';
export type BusinessTier = 'operator' | 'hustler' | 'grinder' | 'vendor' | 'business_owner' | 'empire';

export interface LoyaltyTierConfig {
  tier: LoyaltyTier;
  minPoints: number;
  maxPoints: number | null;
  boostPct: number;
  revenueSharePct: number;
  perks: string[];
}

export const LOYALTY_TIERS: LoyaltyTierConfig[] = [
  { tier: 'explorer',      minPoints: 0,      maxPoints: 499,    boostPct: 0,  revenueSharePct: 0,  perks: [] },
  { tier: 'regular',       minPoints: 500,    maxPoints: 1499,   boostPct: 5,  revenueSharePct: 0,  perks: [] },
  { tier: 'local_legend',  minPoints: 1500,   maxPoints: 3999,   boostPct: 12, revenueSharePct: 0,  perks: [] },
  { tier: 'foodie_royale', minPoints: 4000,   maxPoints: 9999,   boostPct: 20, revenueSharePct: 0,  perks: [] },
  { tier: 'tastemaker',    minPoints: 10000,  maxPoints: 24999,  boostPct: 30, revenueSharePct: 0,  perks: [] },
  { tier: 'influencer',    minPoints: 25000,  maxPoints: 59999,  boostPct: 40, revenueSharePct: 2,  perks: ['2% revenue share'] },
  { tier: 'food_legend',   minPoints: 60000,  maxPoints: 149999, boostPct: 50, revenueSharePct: 5,  perks: ['5% revenue share', 'co-brand'] },
  { tier: 'icon',          minPoints: 150000, maxPoints: null,   boostPct: 65, revenueSharePct: 10, perks: ['10% revenue share', 'free Pro', 'co-brand'] },
];

export interface GeoPoint { type: 'Point'; coordinates: [longitude: number, latitude: number]; }
export interface LatLng { lat: number; lng: number; }
export function geoPointToLatLng(p: GeoPoint): LatLng { return { lat: p.coordinates[1], lng: p.coordinates[0] }; }
export function latLngToGeoPoint(ll: LatLng): GeoPoint { return { type: 'Point', coordinates: [ll.lng, ll.lat] }; }

export interface User {
  id: string; clerk_id: string; email: string; display_name: string | null;
  avatar_url: string | null; phone: string | null; expo_push_token: string | null;
  fcm_token: string | null; apns_token: string | null; consumer_points: number;
  loyalty_tier: LoyaltyTier; revenue_share_pct: number; quiet_hours_start: string | null;
  quiet_hours_end: string | null; max_daily_notifs: number; notification_radius_km: number;
  is_active: boolean; created_at: string; updated_at: string;
}

export interface Business {
  id: string; clerk_org_id: string | null; owner_clerk_id: string; name: string;
  slug: string; description: string | null; logo_url: string | null; cover_url: string | null;
  cuisine_tags: string[]; phone: string | null; website: string | null;
  business_type: BusinessType; address: string | null; location: GeoPoint | null;
  billing_plan: BillingPlan; stripe_customer_id: string | null; stripe_sub_id: string | null;
  billing_cap_cents: number | null; plan_started_at: string | null; plan_ends_at: string | null;
  business_points: number; business_tier: BusinessTier;
  trial_referral_visits: number; trial_biz_referrals: number; trial_total_sales: number;
  trial_conversion_rate: number; trial_repeat_customers: number;
  trial_locked: boolean; trial_locked_at: string | null;
  is_active: boolean; created_at: string; updated_at: string;
}

export interface FlashSale {
  id: string; business_id: string; title: string; description: string | null;
  status: SaleStatus; starts_at: string; ends_at: string; spin_window_mins: number;
  fence_center: GeoPoint; fence_radius_m: number; total_spins: number;
  confirmed_visits: number; influenced_visits: number; created_at: string; updated_at: string;
}

export interface Prize {
  id: string; flash_sale_id: string; label: string; description: string | null;
  emoji: string | null; image_url: string | null; weight: number; max_spins: number;
  spins_used: number; is_ghost: boolean; base_weight: number; created_at: string;
}

export interface VisitIntent {
  id: string; user_id: string; flash_sale_id: string; prize_id: string | null;
  state: VisitState; spun_at: string | null; spin_location: GeoPoint | null;
  arrived_at: string | null; arrival_location: GeoPoint | null;
  confirmed_at: string | null; expired_at: string | null; spin_expires_at: string | null;
  created_at: string; updated_at: string;
}

export interface Referral {
  id: string; code: string; path: ReferralPath;
  referrer_user_id: string | null; referrer_biz_id: string | null;
  receiver_user_id: string | null; receiver_biz_id: string | null;
  referrer_rewarded: boolean; receiver_rewarded: boolean;
  trigger_event: string | null; triggered_at: string | null; created_at: string;
}

export interface Notification {
  id: string; user_id: string; type: NotificationType; title: string; body: string;
  data: Record<string, unknown> | null; flash_sale_id: string | null; business_id: string | null;
  sent_at: string | null; read_at: string | null; failed: boolean;
  failure_reason: string | null; dedup_key: string | null; created_at: string;
}

export interface SpinRequest { flash_sale_id: string; user_lat: number; user_lng: number; }
export interface SpinResult { visit_intent_id: string; prize: Prize; state: VisitState; spin_expires_at: string; loyalty_boost_applied: number; }

export interface ApiResponse<T> { data: T; error: null; }
export interface ApiError { data: null; error: { code: string; message: string; statusCode: number; }; }
export type ApiResult<T> = ApiResponse<T> | ApiError;

export const BILLING_PLANS = [
  { plan: 'trial'   as BillingPlan, monthly_cents: 0,    per_visit_cents: 0,   per_influenced_cents: 0,  monthly_cap_cents: null,  resubscription_cents: null },
  { plan: 'starter' as BillingPlan, monthly_cents: 2900, per_visit_cents: 150, per_influenced_cents: 0,  monthly_cap_cents: 15000, resubscription_cents: 3900 },
  { plan: 'growth'  as BillingPlan, monthly_cents: 7900, per_visit_cents: 100, per_influenced_cents: 25, monthly_cap_cents: 30000, resubscription_cents: 8900 },
  { plan: 'pro'     as BillingPlan, monthly_cents: 9900, per_visit_cents: 0,   per_influenced_cents: 0,  monthly_cap_cents: null,  resubscription_cents: null },
];

export const TRIAL_THRESHOLDS = {
  referral_visits: 10, biz_referrals: 3, total_sales: 5,
  conversion_rate: 0.15, repeat_customers: 5,
} as const;
EOF

# ============================================================
# FILE 5 — Supabase client utility
# ============================================================
echo "📄 Writing Supabase client..."
cat > apps/api/src/lib/supabase.ts << 'EOF'
// apps/api/src/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function supabaseForUser(clerkId: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-clerk-user-id': clerkId } },
  });
}

export function makePoint(lng: number, lat: number): string {
  return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

export async function checkInsideFence(flashSaleId: string, userLat: number, userLng: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('user_inside_fence', {
    p_flash_sale_id: flashSaleId, user_lat: userLat, user_lng: userLng,
  });
  if (error) throw error;
  return data as boolean;
}

export async function activeSalesNear(lat: number, lng: number, radiusKm = 5) {
  const { data, error } = await supabase.rpc('active_sales_near', { lat, lng, radius_km: radiusKm });
  if (error) throw error;
  return data ?? [];
}
EOF

# ============================================================
# FILE 6 — .env.example (only if it doesn't exist)
# ============================================================
if [ ! -f .env.example ]; then
  echo "📄 Writing .env.example..."
  cat > .env.example << 'EOF'
# Supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Redis
REDIS_URL=redis://localhost:6379

# Firebase (FCM)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# APNs
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_KEY_PATH=./certs/apns.p8

# Branch.io
BRANCH_KEY=key_live_...

# OpenAI
OPENAI_API_KEY=sk-...

# Google Vision
GOOGLE_CLOUD_API_KEY=

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
API_URL=http://localhost:3001
EOF
fi

# ============================================================
# Install Supabase JS client
# ============================================================
echo ""
echo "📦 Installing @supabase/supabase-js..."
cd apps/api && npm install @supabase/supabase-js --save 2>/dev/null || echo "⚠️  npm install skipped (run manually if needed)"
cd ../web && npm install @supabase/supabase-js --save 2>/dev/null || echo "⚠️  npm install skipped in web (run manually if needed)"
cd ../..

# ============================================================
# Git commit + push
# ============================================================
echo ""
echo "🚀 Committing and pushing to GitHub..."
git add -A
git commit -m "Section 2: database schema, PostGIS migrations, Supabase config, shared types"
git push

echo ""
echo "✅ Section 2 complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NEXT STEP: Set up Supabase"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Go to https://supabase.com → New project"
echo "     Name: SerendipEatery"
echo "     Region: US West (N. California)"
echo ""
echo "  2. Dashboard → Database → Extensions → Enable postgis"
echo ""
echo "  3. SQL Editor → paste supabase/migrations/20240101000000_initial_schema.sql → Run"
echo ""
echo "  4. SQL Editor → paste supabase/seed.sql → Run"
echo ""
echo "  5. Settings → API → copy URL + keys into .env files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
