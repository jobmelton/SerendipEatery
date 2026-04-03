-- ============================================================
-- Realtime P2P Battles — round-by-round play with Supabase Realtime
-- ============================================================

-- Add new columns to battles table for realtime P2P
ALTER TABLE battles ALTER COLUMN defender_id DROP NOT NULL;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_message text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS current_round int DEFAULT 1;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS round_results jsonb DEFAULT '[]'::jsonb;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS challenger_name text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS defender_name text;
ALTER TABLE battles ADD COLUMN IF NOT EXISTS forfeit_timer_start timestamptz;

-- Add 'waiting' and 'expired' and 'forfeit' to status check
ALTER TABLE battles DROP CONSTRAINT IF EXISTS battles_status_check;
ALTER TABLE battles ADD CONSTRAINT battles_status_check
  CHECK (status IN ('waiting', 'pending', 'active', 'completed', 'declined', 'expired', 'forfeit'));

-- Battle moves: individual per-round move submissions
CREATE TABLE IF NOT EXISTS battle_moves (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  round int NOT NULL,
  player_role text NOT NULL CHECK (player_role IN ('challenger', 'defender')),
  move text NOT NULL CHECK (move IN ('rock', 'paper', 'scissors')),
  submitted_at timestamptz DEFAULT now(),
  UNIQUE(battle_id, round, player_role)
);

CREATE INDEX IF NOT EXISTS idx_battle_moves_battle ON battle_moves(battle_id);

-- RLS for battle_moves
ALTER TABLE battle_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full battle_moves access" ON battle_moves
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Participants read own battle moves" ON battle_moves
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM battles b
      WHERE b.id = battle_moves.battle_id
        AND (auth.uid()::text IN (b.challenger_id, b.defender_id)
             OR b.challenger_id LIKE 'guest_%'
             OR b.defender_id LIKE 'guest_%')
    )
  );

-- Enable Realtime on battles and battle_moves
-- Note: This needs to be done via Supabase dashboard or API as well
-- ALTER PUBLICATION supabase_realtime ADD TABLE battles;
-- ALTER PUBLICATION supabase_realtime ADD TABLE battle_moves;

-- Function to auto-expire old waiting battles (run by cron or fix worker)
CREATE OR REPLACE FUNCTION expire_stale_battles() RETURNS void AS $$
BEGIN
  UPDATE battles
  SET status = 'expired', completed_at = now()
  WHERE status = 'waiting'
    AND expires_at IS NOT NULL
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
