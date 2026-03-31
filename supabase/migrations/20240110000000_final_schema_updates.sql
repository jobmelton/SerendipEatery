-- ============================================================
-- SerendipEatery — Final Schema Updates
-- Adds columns referenced in app code but missing from initial schema.
-- Bridges column-name differences between schema and Supabase JS queries.
-- ============================================================

-- ─── USERS: add columns referenced by app code ───────────────────────────

-- Code references users.points (schema has consumer_points)
ALTER TABLE users ADD COLUMN IF NOT EXISTS points INTEGER GENERATED ALWAYS AS (consumer_points) STORED;
-- Code references users.consumer_tier (schema has loyalty_tier)
-- We add a real column so Supabase client can query it
ALTER TABLE users ADD COLUMN IF NOT EXISTS consumer_tier TEXT;
-- Sync consumer_tier from loyalty_tier on insert/update
CREATE OR REPLACE FUNCTION sync_consumer_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.consumer_tier := NEW.loyalty_tier::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_consumer_tier
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_consumer_tier();

-- Additional columns referenced in code
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code_biz TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_business_id UUID REFERENCES businesses(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_offset INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referral_code_biz ON users(referral_code_biz);

-- ─── BUSINESSES: add columns referenced by app code ──────────────────────

-- Code references businesses.owner_id (schema has owner_clerk_id)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_id TEXT;
-- Sync owner_id from owner_clerk_id
CREATE OR REPLACE FUNCTION sync_owner_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.owner_id := NEW.owner_clerk_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_owner_id
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION sync_owner_id();

-- Code references businesses.plan (schema has billing_plan)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS plan TEXT;
CREATE OR REPLACE FUNCTION sync_biz_plan()
RETURNS TRIGGER AS $$
BEGIN
  NEW.plan := NEW.billing_plan::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_biz_plan
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION sync_biz_plan();

-- Code references businesses.biz_points / biz_tier
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS biz_points INTEGER;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS biz_tier TEXT;
CREATE OR REPLACE FUNCTION sync_biz_tier_points()
RETURNS TRIGGER AS $$
BEGIN
  NEW.biz_points := NEW.business_points;
  NEW.biz_tier := NEW.business_tier::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_biz_tier_points
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION sync_biz_tier_points();

-- Code references lat/lng (schema uses location geometry)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
-- Sync lat/lng from/to location geometry
CREATE OR REPLACE FUNCTION sync_biz_latlng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  ELSIF NEW.location IS NOT NULL THEN
    NEW.lat := ST_Y(NEW.location);
    NEW.lng := ST_X(NEW.location);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_biz_latlng
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION sync_biz_latlng();

-- Additional columns
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cuisine TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address_line TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_evidence_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS payment_status TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS owner_email TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_businesses_referral_code ON businesses(referral_code);
CREATE INDEX IF NOT EXISTS idx_businesses_plan ON businesses(plan);

-- ─── FLASH SALES: add columns referenced by app code ─────────────────────

ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS radius_m NUMERIC(8,2);
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS max_spins_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS spins_used INTEGER NOT NULL DEFAULT 0;

-- Sync radius_m from fence_radius_m
CREATE OR REPLACE FUNCTION sync_sale_radius()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.radius_m IS NOT NULL THEN
    NEW.fence_radius_m := NEW.radius_m;
  ELSE
    NEW.radius_m := NEW.fence_radius_m;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_sale_radius
  BEFORE INSERT OR UPDATE ON flash_sales
  FOR EACH ROW EXECUTE FUNCTION sync_sale_radius();

-- ─── PRIZES: add columns referenced by app code ──────────────────────────

-- Code references prizes.sale_id (schema has flash_sale_id)
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS sale_id UUID;
CREATE OR REPLACE FUNCTION sync_prize_sale_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_id IS NOT NULL THEN
    NEW.flash_sale_id := NEW.sale_id;
  ELSE
    NEW.sale_id := NEW.flash_sale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_prize_sale_id
  BEFORE INSERT OR UPDATE ON prizes
  FOR EACH ROW EXECUTE FUNCTION sync_prize_sale_id();

-- Code references prizes.name (schema has label)
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS name TEXT;
CREATE OR REPLACE FUNCTION sync_prize_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.label := NEW.name;
  ELSE
    NEW.name := NEW.label;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_prize_name
  BEFORE INSERT OR UPDATE ON prizes
  FOR EACH ROW EXECUTE FUNCTION sync_prize_name();

ALTER TABLE prizes ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS value NUMERIC(10,2);
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS arrival_rate NUMERIC(5,4) NOT NULL DEFAULT 0;

-- ─── VISIT INTENTS: add columns referenced by app code ───────────────────

ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS sale_id UUID;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS prize_won TEXT;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS prize_code TEXT;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS spin_lat DOUBLE PRECISION;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS spin_lng DOUBLE PRECISION;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS spun_at TIMESTAMPTZ;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS entered_fence_at TIMESTAMPTZ;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE visit_intents ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Sync sale_id/flash_sale_id
CREATE OR REPLACE FUNCTION sync_visit_sale_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_id IS NOT NULL THEN
    NEW.flash_sale_id := NEW.sale_id;
  ELSE
    NEW.sale_id := NEW.flash_sale_id;
  END IF;
  -- Sync spin location
  IF NEW.spin_lat IS NOT NULL AND NEW.spin_lng IS NOT NULL THEN
    NEW.spin_location := ST_SetSRID(ST_MakePoint(NEW.spin_lng, NEW.spin_lat), 4326);
  END IF;
  -- Sync expires_at
  IF NEW.expires_at IS NOT NULL THEN
    NEW.spin_expires_at := NEW.expires_at;
  ELSIF NEW.spin_expires_at IS NOT NULL THEN
    NEW.expires_at := NEW.spin_expires_at;
  END IF;
  -- Sync entered_fence_at / arrived_at
  IF NEW.entered_fence_at IS NOT NULL THEN
    NEW.arrived_at := NEW.entered_fence_at;
  END IF;
  -- Sync spun_at
  IF NEW.spun_at IS NULL AND NEW.spin_location IS NOT NULL THEN
    NEW.spun_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_visit_ids
  BEFORE INSERT OR UPDATE ON visit_intents
  FOR EACH ROW EXECUTE FUNCTION sync_visit_sale_id();

CREATE INDEX IF NOT EXISTS idx_visit_intents_business ON visit_intents(business_id);
CREATE INDEX IF NOT EXISTS idx_visit_intents_expires ON visit_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_visit_intents_prize_code ON visit_intents(prize_code);

-- ─── BILLING EVENTS: add columns referenced by app code ──────────────────

-- Code references billing_events.type (schema has event_type)
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS type TEXT;
CREATE OR REPLACE FUNCTION sync_billing_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IS NOT NULL THEN
    NEW.event_type := NEW.type;
  ELSE
    NEW.type := NEW.event_type;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_billing_type
  BEFORE INSERT OR UPDATE ON billing_events
  FOR EACH ROW EXECUTE FUNCTION sync_billing_type();

ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN;

-- ─── REFERRALS: add columns for code compatibility ───────────────────────

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_type TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_id TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_type TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_pts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referee_pts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS rewarded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- ─── GEOFENCE SNAPSHOTS: add lat/lng columns ─────────────────────────────

ALTER TABLE geofence_snapshots ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE geofence_snapshots ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE geofence_snapshots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION sync_geofence_latlng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.center := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  ELSIF NEW.center IS NOT NULL THEN
    NEW.lat := ST_Y(NEW.center);
    NEW.lng := ST_X(NEW.center);
  END IF;
  NEW.created_at := COALESCE(NEW.created_at, NEW.recorded_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_geofence_latlng
  BEFORE INSERT OR UPDATE ON geofence_snapshots
  FOR EACH ROW EXECUTE FUNCTION sync_geofence_latlng();

-- ─── TRUCK LOCATION PINGS: add lat/lng columns ──────────────────────────

ALTER TABLE truck_location_pings ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE truck_location_pings ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE truck_location_pings ADD COLUMN IF NOT EXISTS distance_from_last_m DOUBLE PRECISION;

CREATE OR REPLACE FUNCTION sync_truck_ping_latlng()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  ELSIF NEW.location IS NOT NULL THEN
    NEW.lat := ST_Y(NEW.location);
    NEW.lng := ST_X(NEW.location);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_truck_ping_latlng
  BEFORE INSERT OR UPDATE ON truck_location_pings
  FOR EACH ROW EXECUTE FUNCTION sync_truck_ping_latlng();

-- ─── NOTIFICATIONS: add sale_id alias ────────────────────────────────────

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sale_id UUID;
CREATE OR REPLACE FUNCTION sync_notif_sale_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sale_id IS NOT NULL THEN
    NEW.flash_sale_id := NEW.sale_id;
  ELSE
    NEW.sale_id := NEW.flash_sale_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_notif_sale_id
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION sync_notif_sale_id();

-- ─── POINT TRANSACTIONS: add code-compatible columns ─────────────────────

ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS reference_id_text TEXT;
ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION sync_point_txn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount IS NOT NULL THEN
    NEW.points := NEW.amount;
  ELSE
    NEW.amount := NEW.points;
  END IF;
  IF NEW.type IS NOT NULL THEN
    NEW.reason := NEW.type;
  ELSE
    NEW.type := NEW.reason;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_sync_point_txn
  BEFORE INSERT OR UPDATE ON point_transactions
  FOR EACH ROW EXECUTE FUNCTION sync_point_txn();

-- ─── HELPER RPC: increment_spins ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_spins(p_sale_id UUID, p_prize_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE flash_sales SET spins_used = spins_used + 1, total_spins = total_spins + 1 WHERE id = p_sale_id;
  UPDATE prizes SET spins_used = spins_used + 1 WHERE id = p_prize_id;
END;
$$ LANGUAGE plpgsql;

-- ─── HELPER RPC: award_points ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION award_points(p_user_id UUID, p_points INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET consumer_points = consumer_points + p_points WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ─── HELPER RPC: truck_distance_from_last ────────────────────────────────

CREATE OR REPLACE FUNCTION truck_distance_from_last(p_business_id UUID, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  v_last_center GEOMETRY;
  v_distance DOUBLE PRECISION;
BEGIN
  SELECT center INTO v_last_center
  FROM geofence_snapshots
  WHERE business_id = p_business_id
  ORDER BY recorded_at DESC
  LIMIT 1;

  IF v_last_center IS NULL THEN
    RETURN 999999;
  END IF;

  v_distance := ST_Distance(
    v_last_center::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  );

  RETURN v_distance;
END;
$$ LANGUAGE plpgsql;

-- ─── PERFORMANCE INDEXES ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_flash_sales_business_status ON flash_sales(business_id, status);
CREATE INDEX IF NOT EXISTS idx_visit_intents_user_sale ON visit_intents(user_id, flash_sale_id);
CREATE INDEX IF NOT EXISTS idx_visit_intents_state_expires ON visit_intents(state, expires_at);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_txns_user_created ON point_transactions(user_id, created_at DESC);
