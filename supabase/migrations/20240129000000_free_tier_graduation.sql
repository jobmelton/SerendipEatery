-- ============================================================
-- Free Tier Graduation — honeymoon → graduated → capped
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS free_tier_graduated BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS peak_monthly_visits INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS free_tier_visits_this_month INTEGER DEFAULT 0;
