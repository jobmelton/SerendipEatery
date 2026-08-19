-- Official attempt auto-starts at 50,000 verified signups.
-- Friend tournaments carry stakes ("winner picks tonight") and can auto-start when full.

ALTER TABLE record_attempts
  ADD COLUMN IF NOT EXISTS auto_start_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_start_threshold int NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS auto_started_at timestamptz;

UPDATE record_attempts
  SET target_participants = 50000,
      auto_start_threshold = 50000,
      auto_start_enabled = true
  WHERE status IN ('upcoming', 'registration', 'frozen');

-- Organiser Guinness application (filled form)
CREATE TABLE IF NOT EXISTS record_application (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES record_attempts(id) ON DELETE CASCADE,
  organisation_name text NOT NULL DEFAULT 'SerendipEatery',
  contact_name text,
  contact_email text,
  contact_phone text,
  contact_role text DEFAULT 'Record attempt organiser',
  country text DEFAULT 'United States',
  city text,
  address text,
  proposed_title text NOT NULL DEFAULT 'Largest online asynchronous rock-paper-scissors tournament',
  related_title text DEFAULT 'Largest Rock, Paper, Scissors tournament (10,033 — Tianjin Joy City, 2019)',
  witness1_name text,
  witness1_email text,
  witness1_role text,
  witness2_name text,
  witness2_email text,
  witness2_role text,
  livestream_url text,
  extra_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id)
);

ALTER TABLE record_application ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full record_application access" ON record_application
  FOR ALL USING (auth.role() = 'service_role');

-- Friend / "tonight" tournaments
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS stakes text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'social',
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_record boolean NOT NULL DEFAULT true;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_kind_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_kind_check
  CHECK (kind IN ('social', 'record'));
