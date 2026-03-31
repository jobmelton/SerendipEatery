-- ============================================================
-- SerendipEatery — Initial Schema Migration
-- PostgreSQL 16 + PostGIS
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE visit_state AS ENUM (
  'spun_away',
  'inside_fence',
  'confirmed',
  'expired',
  'influenced',
  'passive'
);

CREATE TYPE sale_status AS ENUM (
  'scheduled',
  'active',
  'ended',
  'cancelled'
);

CREATE TYPE notification_type AS ENUM (
  'sale_live',
  'ending_soon',
  'you_won',
  'winner_reminder',
  'visit_confirmed',
  'truck_moved',
  'new_sale_nearby'
);

CREATE TYPE business_type AS ENUM (
  'restaurant',
  'food_truck'
);

CREATE TYPE billing_plan AS ENUM (
  'trial',
  'starter',
  'growth',
  'pro'
);

CREATE TYPE referral_path AS ENUM (
  'user_user',
  'user_biz',
  'biz_customer',
  'biz_biz'
);

CREATE TYPE loyalty_tier AS ENUM (
  'explorer',
  'regular',
  'local_legend',
  'foodie_royale',
  'tastemaker',
  'influencer',
  'food_legend',
  'icon'
);

CREATE TYPE business_tier AS ENUM (
  'operator',
  'hustler',
  'grinder',
  'vendor',
  'business_owner',
  'empire'
);

-- ============================================================
-- USERS
-- ============================================================

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

  -- Loyalty
  consumer_points   INTEGER NOT NULL DEFAULT 0,
  loyalty_tier      loyalty_tier NOT NULL DEFAULT 'explorer',
  revenue_share_pct NUMERIC(4,2) NOT NULL DEFAULT 0,

  -- Preferences
  quiet_hours_start TIME,
  quiet_hours_end   TIME,
  max_daily_notifs  INTEGER NOT NULL DEFAULT 3,
  notification_radius_km NUMERIC(5,2) NOT NULL DEFAULT 5,

  -- Meta
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- BUSINESSES
-- ============================================================

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

  -- Fixed location (restaurants only)
  address           TEXT,
  location          GEOMETRY(Point, 4326),

  -- Billing
  billing_plan      billing_plan NOT NULL DEFAULT 'trial',
  stripe_customer_id TEXT,
  stripe_sub_id     TEXT,
  billing_cap_cents INTEGER,
  resubscription_price_cents INTEGER,
  plan_started_at   TIMESTAMPTZ,
  plan_ends_at      TIMESTAMPTZ,

  -- Business loyalty
  business_points   INTEGER NOT NULL DEFAULT 0,
  business_tier     business_tier NOT NULL DEFAULT 'operator',

  -- Trial evidence counters
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

-- ============================================================
-- FLASH SALES
-- ============================================================

CREATE TABLE flash_sales (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  title             TEXT NOT NULL,
  description       TEXT,
  status            sale_status NOT NULL DEFAULT 'scheduled',

  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  spin_window_mins  INTEGER NOT NULL DEFAULT 60,

  -- Geofence at time of creation (snapshot)
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

-- ============================================================
-- PRIZES
-- ============================================================

CREATE TABLE prizes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flash_sale_id     UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,

  label             TEXT NOT NULL,
  description       TEXT,
  emoji             TEXT,
  image_url         TEXT,

  -- Spin wheel config
  weight            INTEGER NOT NULL DEFAULT 1,   -- relative probability
  max_spins         INTEGER NOT NULL DEFAULT 10,  -- max winners
  spins_used        INTEGER NOT NULL DEFAULT 0,
  is_ghost          BOOLEAN NOT NULL DEFAULT FALSE, -- exhausted, stays visible

  -- Loyalty boost multiplier applied at spin time
  base_weight       INTEGER NOT NULL DEFAULT 1,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prizes_flash_sale ON prizes(flash_sale_id);

-- ============================================================
-- VISIT INTENTS (state machine)
-- ============================================================

CREATE TABLE visit_intents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flash_sale_id     UUID NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  prize_id          UUID REFERENCES prizes(id),

  state             visit_state NOT NULL DEFAULT 'spun_away',

  -- Spin result
  spun_at           TIMESTAMPTZ,
  spin_location     GEOMETRY(Point, 4326),

  -- Arrival
  arrived_at        TIMESTAMPTZ,
  arrival_location  GEOMETRY(Point, 4326),

  -- Confirmation
  confirmed_at      TIMESTAMPTZ,
  expired_at        TIMESTAMPTZ,

  -- Window
  spin_expires_at   TIMESTAMPTZ,  -- spun_at + 60 min

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, flash_sale_id)
);

CREATE INDEX idx_visit_intents_user ON visit_intents(user_id);
CREATE INDEX idx_visit_intents_sale ON visit_intents(flash_sale_id);
CREATE INDEX idx_visit_intents_state ON visit_intents(state);
CREATE INDEX idx_visit_intents_spin_location ON visit_intents USING GIST(spin_location);

-- ============================================================
-- BILLING EVENTS
-- ============================================================

CREATE TABLE billing_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  visit_intent_id   UUID REFERENCES visit_intents(id),
  flash_sale_id     UUID REFERENCES flash_sales(id),

  event_type        TEXT NOT NULL,  -- 'confirmed_visit', 'influenced_visit', 'subscription'
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  stripe_event_id   TEXT,

  billed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_events_business ON billing_events(business_id);
CREATE INDEX idx_billing_events_billed_at ON billing_events(billed_at);

-- ============================================================
-- GEOFENCE SNAPSHOTS (food trucks)
-- ============================================================

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

-- ============================================================
-- TRUCK LOCATION PINGS
-- ============================================================

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

-- ============================================================
-- REFERRALS
-- ============================================================

CREATE TABLE referrals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              TEXT UNIQUE NOT NULL,
  path              referral_path NOT NULL,

  -- Referrer (user or business)
  referrer_user_id  UUID REFERENCES users(id),
  referrer_biz_id   UUID REFERENCES businesses(id),

  -- Receiver (user or business)
  receiver_user_id  UUID REFERENCES users(id),
  receiver_biz_id   UUID REFERENCES businesses(id),

  -- Reward state
  referrer_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  receiver_rewarded BOOLEAN NOT NULL DEFAULT FALSE,
  trigger_event     TEXT,           -- 'first_spin', 'first_sale', 'first_visit'
  triggered_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referrals_code ON referrals(code);
CREATE INDEX idx_referrals_referrer_user ON referrals(referrer_user_id);
CREATE INDEX idx_referrals_referrer_biz ON referrals(referrer_biz_id);
CREATE INDEX idx_referrals_receiver_user ON referrals(receiver_user_id);

-- ============================================================
-- POINT TRANSACTIONS
-- ============================================================

CREATE TABLE point_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id),
  business_id       UUID REFERENCES businesses(id),

  points            INTEGER NOT NULL,  -- positive = earn, negative = spend
  reason            TEXT NOT NULL,
  reference_id      UUID,             -- visit_intent, referral, etc.
  reference_type    TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_point_txns_user ON point_transactions(user_id);
CREATE INDEX idx_point_txns_business ON point_transactions(business_id);
CREATE INDEX idx_point_txns_created_at ON point_transactions(created_at DESC);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

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

  -- Dedup key (Redis mirrors this, but stored for audit)
  dedup_key         TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at DESC);
CREATE INDEX idx_notifications_dedup ON notifications(dedup_key);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_flash_sales_updated_at
  BEFORE UPDATE ON flash_sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_visit_intents_updated_at
  BEFORE UPDATE ON visit_intents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- LOYALTY TIER AUTO-UPDATE FUNCTION
-- ============================================================

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

CREATE TRIGGER trg_users_loyalty_tier
  BEFORE INSERT OR UPDATE OF consumer_points ON users
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_tier();

-- ============================================================
-- BUSINESS TIER AUTO-UPDATE FUNCTION
-- ============================================================

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

CREATE TRIGGER trg_business_tier
  BEFORE INSERT OR UPDATE OF business_points ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_business_tier();

-- ============================================================
-- HELPER: find active sales near a point
-- ============================================================

CREATE OR REPLACE FUNCTION active_sales_near(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5
)
RETURNS TABLE (
  sale_id UUID,
  business_id UUID,
  business_name TEXT,
  distance_m DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fs.id,
    b.id,
    b.name,
    ST_Distance(
      fs.fence_center::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) AS distance_m
  FROM flash_sales fs
  JOIN businesses b ON b.id = fs.business_id
  WHERE fs.status = 'active'
    AND ST_DWithin(
      fs.fence_center::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HELPER: check if user is inside geofence
-- ============================================================

CREATE OR REPLACE FUNCTION user_inside_fence(
  p_flash_sale_id UUID,
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION
)
RETURNS BOOLEAN AS $$
DECLARE
  v_center GEOMETRY;
  v_radius NUMERIC;
  v_distance DOUBLE PRECISION;
BEGIN
  SELECT fence_center, fence_radius_m
  INTO v_center, v_radius
  FROM flash_sales
  WHERE id = p_flash_sale_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  v_distance := ST_Distance(
    v_center::geography,
    ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
  );

  RETURN v_distance <= v_radius;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Service role bypasses all RLS (used by API server)
-- Consumer can read their own data
CREATE POLICY "users_own" ON users
  FOR ALL USING (clerk_id = current_setting('app.clerk_id', TRUE));

CREATE POLICY "visit_intents_own" ON visit_intents
  FOR ALL USING (
    user_id = (
      SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

CREATE POLICY "notifications_own" ON notifications
  FOR SELECT USING (
    user_id = (
      SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- Public read: active flash sales and prizes
CREATE POLICY "flash_sales_public_read" ON flash_sales
  FOR SELECT USING (status = 'active');

CREATE POLICY "prizes_public_read" ON prizes
  FOR SELECT USING (TRUE);

-- Business owners can manage their own business
CREATE POLICY "businesses_owner" ON businesses
  FOR ALL USING (owner_clerk_id = current_setting('app.clerk_id', TRUE));
