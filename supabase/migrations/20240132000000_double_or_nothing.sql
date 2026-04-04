-- ============================================================
-- Double or Nothing + Bot Battle Probabilities
-- ============================================================

ALTER TABLE battles ADD COLUMN IF NOT EXISTS double_or_nothing_count INTEGER DEFAULT 0;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS stake_multiplier INTEGER DEFAULT 1;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS is_bot_battle BOOLEAN DEFAULT false;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS player_win_probability NUMERIC DEFAULT 0.5;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS parent_battle_id UUID REFERENCES battles(id);
