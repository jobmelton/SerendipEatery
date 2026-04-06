-- ============================================================
-- RPS Tournament System — brackets, lobbies, real-time play
-- ============================================================

-- Tournament types: single_elimination, double_elimination
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id text NOT NULL,
  host_name text NOT NULL DEFAULT 'Host',
  name text NOT NULL DEFAULT 'RPS Tournament',
  join_code text NOT NULL UNIQUE,
  format text NOT NULL DEFAULT 'single_elimination'
    CHECK (format IN ('single_elimination', 'double_elimination')),
  status text NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'active', 'completed', 'cancelled')),
  max_players int NOT NULL DEFAULT 16
    CHECK (max_players >= 2 AND max_players <= 64),
  min_players int NOT NULL DEFAULT 2,
  current_round int DEFAULT 0,
  winner_id text,
  winner_name text,
  bracket jsonb DEFAULT '[]'::jsonb,
  losers_bracket jsonb DEFAULT '[]'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_join_code ON tournaments(join_code);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_host ON tournaments(host_id);

-- Tournament players
CREATE TABLE IF NOT EXISTS tournament_players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL DEFAULT 'Player',
  seed int,
  is_eliminated boolean DEFAULT false,
  is_in_losers boolean DEFAULT false,
  wins int DEFAULT 0,
  losses int DEFAULT 0,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_player ON tournament_players(player_id);

-- Tournament matches (each match = one RPS battle)
CREATE TABLE IF NOT EXISTS tournament_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round int NOT NULL,
  match_index int NOT NULL DEFAULT 0,
  bracket_type text NOT NULL DEFAULT 'winners'
    CHECK (bracket_type IN ('winners', 'losers', 'grand_final')),
  player1_id text,
  player1_name text,
  player2_id text,
  player2_name text,
  battle_id uuid REFERENCES battles(id),
  winner_id text,
  loser_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'active', 'completed', 'bye')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tournament_id, round, match_index, bracket_type)
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_battle ON tournament_matches(battle_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(status);

-- RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full tournaments access" ON tournaments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full tournament_players access" ON tournament_players
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full tournament_matches access" ON tournament_matches
  FOR ALL USING (auth.role() = 'service_role');

-- Public read for guests (tournament data is not sensitive)
CREATE POLICY "Anyone can read tournaments" ON tournaments
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read tournament_players" ON tournament_players
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read tournament_matches" ON tournament_matches
  FOR SELECT USING (true);

-- Enable Realtime
-- ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
-- ALTER PUBLICATION supabase_realtime ADD TABLE tournament_players;
-- ALTER PUBLICATION supabase_realtime ADD TABLE tournament_matches;

-- Function to generate a short join code
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text := '';
  i int;
BEGIN
  -- Format: FATE + 2 random chars
  code := 'FATE';
  FOR i IN 1..2 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;
