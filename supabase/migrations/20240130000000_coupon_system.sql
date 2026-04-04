-- ============================================================
-- Coupon System — flash, high_value, long_term coupon types
-- ============================================================

-- Wallets: coupon lifecycle columns
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'flash';
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS auto_delete_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS redeem_started_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS redeem_expires_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS redeem_window_minutes INTEGER DEFAULT 15;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN DEFAULT false;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_tradeable BOOLEAN DEFAULT true;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS loot_protected_until TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS original_owner_id TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS current_owner_id TEXT;

-- Prizes: coupon config columns
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS coupon_type TEXT DEFAULT 'flash';
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS redeem_window_minutes INTEGER DEFAULT 15;
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS is_high_value BOOLEAN DEFAULT false;
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS daily_redemption_cap INTEGER;
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS daily_redemptions_today INTEGER DEFAULT 0;
