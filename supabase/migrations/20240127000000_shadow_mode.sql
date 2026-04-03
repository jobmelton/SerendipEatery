-- ============================================================
-- Shadow Mode — tier-based visit limits and passive tracking
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shadow_mode BOOLEAN DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shadow_mode_reason TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shadow_mode_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS monthly_visit_count INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS monthly_visit_reset_at TIMESTAMPTZ;

-- Add billing_plan column (mirrors plan but explicit for billing logic)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_plan TEXT DEFAULT 'trial'
  CHECK (billing_plan IN ('trial', 'starter', 'growth', 'pro'));
