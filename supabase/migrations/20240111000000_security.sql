-- ============================================================
-- SerendipEatery — Security: Row-Level Security Policies
-- Service role bypasses all RLS automatically.
-- These policies apply to anon/authenticated Supabase client calls.
-- ============================================================

-- Drop existing policies to avoid conflicts (idempotent)
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ─── USERS ────────────────────────────────────────────────────────────────
-- Users can read/update their own row only

CREATE POLICY "users_select_own"
  ON users FOR SELECT
  USING (clerk_id = current_setting('app.clerk_id', TRUE));

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (clerk_id = current_setting('app.clerk_id', TRUE))
  WITH CHECK (clerk_id = current_setting('app.clerk_id', TRUE));

CREATE POLICY "users_insert_own"
  ON users FOR INSERT
  WITH CHECK (clerk_id = current_setting('app.clerk_id', TRUE));

-- ─── BUSINESSES ───────────────────────────────────────────────────────────
-- Owners can CRUD their own businesses. Public read for basic info.

CREATE POLICY "businesses_owner_all"
  ON businesses FOR ALL
  USING (owner_clerk_id = current_setting('app.clerk_id', TRUE));

CREATE POLICY "businesses_public_read"
  ON businesses FOR SELECT
  USING (is_active = TRUE);

-- ─── FLASH SALES ──────────────────────────────────────────────────────────
-- Public can read active/scheduled sales. Owners can manage their own.

CREATE POLICY "flash_sales_public_read"
  ON flash_sales FOR SELECT
  USING (status IN ('active', 'scheduled', 'live'));

CREATE POLICY "flash_sales_owner_all"
  ON flash_sales FOR ALL
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── PRIZES ───────────────────────────────────────────────────────────────
-- Public read (needed for spin wheel display). Owner manage via sale.

CREATE POLICY "prizes_public_read"
  ON prizes FOR SELECT
  USING (TRUE);

CREATE POLICY "prizes_owner_manage"
  ON prizes FOR ALL
  USING (
    flash_sale_id IN (
      SELECT fs.id FROM flash_sales fs
      JOIN businesses b ON b.id = fs.business_id
      WHERE b.owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── VISIT INTENTS ────────────────────────────────────────────────────────
-- Users can read their own visits. Businesses can read visits to their sales.

CREATE POLICY "visit_intents_user_read"
  ON visit_intents FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

CREATE POLICY "visit_intents_user_insert"
  ON visit_intents FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

CREATE POLICY "visit_intents_business_read"
  ON visit_intents FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── BILLING EVENTS ──────────────────────────────────────────────────────
-- Businesses can only read their own billing events

CREATE POLICY "billing_events_owner_read"
  ON billing_events FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- Insert is service-role only (API server creates billing events)

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────
-- Users can only read their own notifications

CREATE POLICY "notifications_user_read"
  ON notifications FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── POINT TRANSACTIONS ──────────────────────────────────────────────────
-- Users can read their own point history

CREATE POLICY "point_transactions_user_read"
  ON point_transactions FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- Businesses can read their own point history
CREATE POLICY "point_transactions_biz_read"
  ON point_transactions FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── REFERRALS ────────────────────────────────────────────────────────────
-- Users can read referrals they created or received

CREATE POLICY "referrals_own_read"
  ON referrals FOR SELECT
  USING (
    referrer_user_id IN (
      SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
    OR receiver_user_id IN (
      SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── GEOFENCE SNAPSHOTS ──────────────────────────────────────────────────
-- Business owners can read their own snapshots

CREATE POLICY "geofence_snapshots_owner_read"
  ON geofence_snapshots FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );

-- ─── TRUCK LOCATION PINGS ────────────────────────────────────────────────
-- Business owners can read their own pings

CREATE POLICY "truck_pings_owner_read"
  ON truck_location_pings FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses
      WHERE owner_clerk_id = current_setting('app.clerk_id', TRUE)
    )
  );
