-- ============================================================
-- Guinness World Record Attempt Infrastructure
-- ============================================================

CREATE TABLE IF NOT EXISTS record_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_name TEXT NOT NULL DEFAULT 'Largest Online RPS Tournament',
  target_date TIMESTAMPTZ,
  target_participants INTEGER DEFAULT 10000,
  status TEXT DEFAULT 'upcoming', -- upcoming | active | pending_verification | verified | failed
  official_count INTEGER,
  guinness_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS record_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES record_attempts(id),
  user_id TEXT,
  guest_id TEXT,
  participant_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  tournament_id UUID REFERENCES tournaments(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  certificate_sent BOOLEAN DEFAULT false,
  consent_given BOOLEAN DEFAULT false,
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS record_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID REFERENCES record_attempts(id),
  evidence_type TEXT, -- 'participant_count' | 'timestamp' | 'match_result' | 'snapshot'
  data JSONB,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_record_participants_attempt ON record_participants(attempt_id);
CREATE INDEX IF NOT EXISTS idx_record_participants_email ON record_participants(email);
CREATE INDEX IF NOT EXISTS idx_record_participants_guest ON record_participants(guest_id);
CREATE INDEX IF NOT EXISTS idx_record_evidence_attempt ON record_evidence(attempt_id);
CREATE INDEX IF NOT EXISTS idx_record_attempts_status ON record_attempts(status);

-- RLS
ALTER TABLE record_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full record_attempts access" ON record_attempts
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read record_attempts" ON record_attempts
  FOR SELECT USING (true);

CREATE POLICY "Service role full record_participants access" ON record_participants
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Anyone can read record_participants" ON record_participants
  FOR SELECT USING (true);

CREATE POLICY "Service role full record_evidence access" ON record_evidence
  FOR ALL USING (auth.role() = 'service_role');
