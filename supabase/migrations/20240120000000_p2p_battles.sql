-- ============================================================
-- P2P Battle System — V2 Feature
-- ============================================================

-- Wallet: stores won coupons / prizes
CREATE TABLE IF NOT EXISTS wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  prize_name text NOT NULL,
  business_name text,
  business_id uuid REFERENCES businesses(id),
  coupon_code text,
  expires_at timestamptz,
  is_long_term boolean DEFAULT false,
  is_lootable boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- Battles: tracks each P2P challenge
CREATE TABLE IF NOT EXISTS battles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id text NOT NULL,
  defender_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'completed', 'declined')),
  challenger_moves text[],
  defender_moves text[],
  winner_id text,
  loot_type text CHECK (loot_type IN ('points', 'coupon')),
  loot_amount int,
  loot_coupon_id uuid REFERENCES wallets(id),
  rounds_played int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_battles_challenger ON battles(challenger_id);
CREATE INDEX idx_battles_defender ON battles(defender_id);
CREATE INDEX idx_battles_status ON battles(status);

-- Battle rounds: individual round outcomes
CREATE TABLE IF NOT EXISTS battle_rounds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  challenger_move text NOT NULL CHECK (challenger_move IN ('rock', 'paper', 'scissors')),
  defender_move text NOT NULL CHECK (defender_move IN ('rock', 'paper', 'scissors')),
  winner_id text
);

CREATE INDEX idx_battle_rounds_battle ON battle_rounds(battle_id);

-- Add battle mode toggle to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_mode_enabled boolean DEFAULT true;

-- Add GPS columns for nearby-user lookup
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat double precision;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng double precision;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

-- Add long-term coupon flag to prizes
ALTER TABLE prizes ADD COLUMN IF NOT EXISTS is_long_term_coupon boolean DEFAULT false;

-- RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE battle_rounds ENABLE ROW LEVEL SECURITY;

-- Wallets: users see their own
CREATE POLICY "Users read own wallet" ON wallets
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Service role full wallet access" ON wallets
  FOR ALL USING (auth.role() = 'service_role');

-- Battles: participants can see their own battles
CREATE POLICY "Users read own battles" ON battles
  FOR SELECT USING (auth.uid()::text IN (challenger_id, defender_id));
CREATE POLICY "Service role full battle access" ON battles
  FOR ALL USING (auth.role() = 'service_role');

-- Battle rounds: readable by battle participants
CREATE POLICY "Users read own battle rounds" ON battle_rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM battles b
      WHERE b.id = battle_rounds.battle_id
        AND auth.uid()::text IN (b.challenger_id, b.defender_id)
    )
  );
CREATE POLICY "Service role full round access" ON battle_rounds
  FOR ALL USING (auth.role() = 'service_role');
