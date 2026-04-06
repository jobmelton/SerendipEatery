-- ============================================================
-- First to 2 wins match format + score tracking columns
-- ============================================================

ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_round_wins INTEGER DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS defender_round_wins INTEGER DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS total_draws INTEGER DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS total_rounds_played INTEGER DEFAULT 0;
