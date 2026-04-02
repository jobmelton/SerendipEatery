-- Waitlist table for app launch email signups
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (email signup from public page)
CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Only service role can read
CREATE POLICY "Service role can read waitlist" ON waitlist
  FOR SELECT USING (auth.role() = 'service_role');
