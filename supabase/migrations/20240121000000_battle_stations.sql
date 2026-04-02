-- ============================================================
-- Business Battle Stations — V2 Feature
-- ============================================================

-- Battle station config per business
CREATE TABLE IF NOT EXISTS business_battle_stations (
  business_id uuid PRIMARY KEY REFERENCES businesses(id),
  is_enabled boolean DEFAULT true,
  win_probability int DEFAULT 60 CHECK (win_probability BETWEEN 0 AND 100),
  prize_id uuid,
  total_scans int DEFAULT 0,
  total_plays int DEFAULT 0,
  total_wins int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Guest battle plays (no auth required)
CREATE TABLE IF NOT EXISTS guest_battles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  session_id text NOT NULL,
  player_moves text[] NOT NULL,
  house_moves text[] NOT NULL,
  winner text NOT NULL CHECK (winner IN ('player', 'house', 'draw')),
  prize_code text,
  app_download_prompted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_guest_battles_business ON guest_battles(business_id);
CREATE INDEX idx_guest_battles_session ON guest_battles(session_id);

-- RLS
ALTER TABLE business_battle_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full station access" ON business_battle_stations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can insert guest battles" ON guest_battles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full guest battle access" ON guest_battles
  FOR ALL USING (auth.role() = 'service_role');
