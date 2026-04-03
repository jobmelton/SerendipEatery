-- ============================================================
-- Dual Accounts — users can be both consumer and business owner
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_business_owner boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_business_id uuid REFERENCES businesses(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_mode text DEFAULT 'consumer';

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS linked_user_id uuid;
