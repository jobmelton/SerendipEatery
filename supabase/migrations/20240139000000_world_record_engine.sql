-- ============================================================
-- World-record async RPS engine
-- Extends 20240138000000_guinness.sql
-- ============================================================

-- ─── record_attempts ────────────────────────────────────────
ALTER TABLE record_attempts
  ADD COLUMN IF NOT EXISTS rules_version text NOT NULL DEFAULT 'rps-async-v1',
  ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS match_deadline_hours int NOT NULL DEFAULT 48,
  ADD COLUMN IF NOT EXISTS min_age int NOT NULL DEFAULT 13,
  ADD COLUMN IF NOT EXISTS freeze_seed text,
  ADD COLUMN IF NOT EXISTS roster_hash text,
  ADD COLUMN IF NOT EXISTS bracket_hash text,
  ADD COLUMN IF NOT EXISTS bracket_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_round int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winner_participant_id uuid,
  ADD COLUMN IF NOT EXISTS official_count int,
  ADD COLUMN IF NOT EXISTS verified_count int;

ALTER TABLE record_attempts DROP CONSTRAINT IF EXISTS record_attempts_status_check;
ALTER TABLE record_attempts ADD CONSTRAINT record_attempts_status_check
  CHECK (status IN (
    'upcoming', 'registration', 'frozen', 'active',
    'pending_verification', 'verified', 'failed'
  ));

-- ─── record_participants ────────────────────────────────────
ALTER TABLE record_participants
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'registered',
  ADD COLUMN IF NOT EXISTS seed int,
  ADD COLUMN IF NOT EXISTS current_match_id uuid,
  ADD COLUMN IF NOT EXISTS eliminated_at timestamptz,
  ADD COLUMN IF NOT EXISTS eliminated_round int,
  ADD COLUMN IF NOT EXISTS first_throw_at timestamptz,
  ADD COLUMN IF NOT EXISTS official_participant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlock_cta_seen_at timestamptz;

ALTER TABLE record_participants DROP CONSTRAINT IF EXISTS record_participants_status_check;
ALTER TABLE record_participants ADD CONSTRAINT record_participants_status_check
  CHECK (status IN (
    'registered', 'verified', 'active', 'eliminated',
    'withdrawn', 'forfeited', 'no_show', 'champion'
  ));

UPDATE record_participants
  SET legal_name = participant_name
  WHERE legal_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_record_participants_phone
  ON record_participants (attempt_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_record_participants_user
  ON record_participants (attempt_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_record_participants_status
  ON record_participants (attempt_id, status);

-- PII: drop public read. API uses the service role.
DROP POLICY IF EXISTS "Anyone can read record_participants" ON record_participants;

-- ─── OTP codes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES record_attempts(id) ON DELETE CASCADE,
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_otp_phone
  ON record_otp_codes (attempt_id, phone_e164, created_at DESC);

ALTER TABLE record_otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full record_otp access" ON record_otp_codes
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Matches ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES record_attempts(id) ON DELETE CASCADE,
  round int NOT NULL,
  match_index int NOT NULL,
  player1_id uuid REFERENCES record_participants(id),
  player2_id uuid REFERENCES record_participants(id),
  player1_name text,
  player2_name text,
  battle_id uuid REFERENCES battles(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'active', 'completed', 'bye', 'forfeit')),
  winner_id uuid,
  loser_id uuid,
  forfeit_reason text,
  deadline_at timestamptz,
  player1_notified_at timestamptz,
  player2_notified_at timestamptz,
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  player1_locked_at timestamptz,
  player2_locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, round, match_index)
);

CREATE INDEX IF NOT EXISTS idx_record_matches_attempt ON record_matches (attempt_id, round, match_index);
CREATE INDEX IF NOT EXISTS idx_record_matches_status ON record_matches (attempt_id, status);
CREATE INDEX IF NOT EXISTS idx_record_matches_deadline ON record_matches (status, deadline_at);
CREATE INDEX IF NOT EXISTS idx_record_matches_player1 ON record_matches (player1_id);
CREATE INDEX IF NOT EXISTS idx_record_matches_player2 ON record_matches (player2_id);
CREATE INDEX IF NOT EXISTS idx_record_matches_battle ON record_matches (battle_id);

ALTER TABLE record_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full record_matches access" ON record_matches
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read record_matches public fields" ON record_matches
  FOR SELECT USING (true);

ALTER TABLE record_participants
  ADD CONSTRAINT record_participants_current_match_fk
  FOREIGN KEY (current_match_id) REFERENCES record_matches(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ─── Hash-chained event log ─────────────────────────────────
CREATE TABLE IF NOT EXISTS record_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES record_attempts(id) ON DELETE CASCADE,
  seq bigint NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_hash text,
  hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_record_event_log_attempt
  ON record_event_log (attempt_id, seq);

ALTER TABLE record_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full record_event_log access" ON record_event_log
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read record_event_log" ON record_event_log
  FOR SELECT USING (true);

-- ─── SMS log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS record_sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES record_attempts(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES record_participants(id) ON DELETE SET NULL,
  to_e164 text NOT NULL,
  template text NOT NULL,
  body text NOT NULL,
  provider_id text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_sms_attempt ON record_sms_log (attempt_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_record_sms_participant ON record_sms_log (participant_id);

ALTER TABLE record_sms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full record_sms_log access" ON record_sms_log
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Seed the first attempt if none exists ──────────────────
INSERT INTO record_attempts (record_name, target_participants, status, match_deadline_hours, min_age, rules_version)
SELECT
  'Largest Asynchronous Rock Paper Scissors Tournament',
  16384,
  'upcoming',
  48,
  13,
  'rps-async-v1'
WHERE NOT EXISTS (SELECT 1 FROM record_attempts);
