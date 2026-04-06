-- ============================================================
-- Proximity Rooms + PWA Push Notifications
-- ============================================================

ALTER TABLE battles ADD COLUMN IF NOT EXISTS proximity_cell TEXT;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  guest_id TEXT,
  subscription JSONB NOT NULL,
  proximity_cell TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_cell ON push_subscriptions(proximity_cell);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full push_subs access" ON push_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
