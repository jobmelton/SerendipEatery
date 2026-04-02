-- ============================================================
-- Business Identity Verification (Stripe Identity)
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_identity_session_id text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ein text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_phone text;
