-- ============================================================
-- Traveling Badges — live records with full lineage history
-- ============================================================

-- Badge definitions
CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  badge_category TEXT NOT NULL, -- 'traveling' | 'permanent' | 'milestone'
  traveling BOOLEAN DEFAULT false,
  trigger_type TEXT, -- 'draw_streak' | 'tournament_size' | 'battle_wins' etc
  trigger_value INTEGER,
  flavor_text TEXT
);

-- Badge holders (current and historical)
CREATE TABLE IF NOT EXISTS badge_holders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id TEXT REFERENCES badge_definitions(id),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  held_from TIMESTAMPTZ DEFAULT now(),
  held_until TIMESTAMPTZ, -- null = currently held
  is_current BOOLEAN DEFAULT true,
  trigger_context JSONB, -- what triggered the badge (match id, streak count etc)
  superseded_by TEXT -- user_id of who took it
);

-- Draw streak tracking
CREATE TABLE IF NOT EXISTS draw_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id TEXT NOT NULL,
  player2_id TEXT NOT NULL,
  battle_id UUID REFERENCES battles(id),
  streak_count INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_badge_holders_current ON badge_holders(badge_id, is_current);
CREATE INDEX IF NOT EXISTS idx_badge_holders_user ON badge_holders(user_id);
CREATE INDEX IF NOT EXISTS idx_draw_streaks_players ON draw_streaks(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_draw_streaks_active ON draw_streaks(is_active);

-- RLS
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full badge_definitions access" ON badge_definitions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read badge_definitions" ON badge_definitions
  FOR SELECT USING (true);

CREATE POLICY "Service role full badge_holders access" ON badge_holders
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read badge_holders" ON badge_holders
  FOR SELECT USING (true);

CREATE POLICY "Service role full draw_streaks access" ON draw_streaks
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read draw_streaks" ON draw_streaks
  FOR SELECT USING (true);

-- Seed traveling badge definitions
INSERT INTO badge_definitions VALUES
  ('largest_tournament', 'Tournament Titan', 'Hosted the largest RPS tournament ever', '👑', 'traveling', true, 'tournament_size', 1, 'Fate bends to those who gather the masses.'),
  ('longest_draw_streak', 'Fate Defier', 'Achieved the longest draw streak in battle history', '🤝', 'traveling', true, 'draw_streak', 1, 'When fate cannot decide, legends are made.'),
  ('most_battles_won', 'Warlord', 'Most total battle wins ever', '⚔️', 'traveling', true, 'battle_wins', 1, 'Fate favors the relentless.'),
  ('highest_points', 'Icon', 'Highest total points ever accumulated', '🌟', 'traveling', true, 'points', 1, 'Some are chosen. You earned it.'),
  ('fastest_tournament_win', 'Swift Fate', 'Won a tournament without losing a single round', '⚡', 'traveling', true, 'perfect_tournament', 1, 'Fate moved through you like lightning.')
ON CONFLICT (id) DO NOTHING;
