-- ============================================================
-- House Bot — always-available opponent for RPS battles
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_type TEXT;

-- Create the house bot user
INSERT INTO users (
  id, clerk_id, email, display_name,
  account_mode, battle_mode_enabled,
  is_bot, bot_type
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'bot_house',
  'house@serendipeatery.com',
  'The House',
  'consumer', true, true, 'house'
) ON CONFLICT DO NOTHING;

-- Bot lootbox — replenishes from active sales
CREATE TABLE IF NOT EXISTS bot_lootbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id),
  flash_sale_id UUID REFERENCES flash_sales(id),
  coupon_type TEXT DEFAULT 'flash',
  added_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bot_lootbox_expires ON bot_lootbox(expires_at);

ALTER TABLE bot_lootbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full bot_lootbox access" ON bot_lootbox
  FOR ALL USING (auth.role() = 'service_role');
