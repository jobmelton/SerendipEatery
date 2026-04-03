-- ============================================================
-- Self-Attestation Verification (replaces Stripe Identity)
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS id_document_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS agreement_accepted_at timestamptz;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS agreement_ip text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz;

-- Drop stripe identity column if exists (no longer needed)
ALTER TABLE businesses DROP COLUMN IF EXISTS stripe_identity_session_id;
