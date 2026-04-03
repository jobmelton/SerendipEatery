-- ============================================================
-- Missed Opportunities — passive data collection for shadow mode
-- ============================================================

CREATE TABLE IF NOT EXISTS missed_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_id UUID REFERENCES flash_sales(id),
  business_id UUID,
  user_id TEXT,
  opportunity_type TEXT NOT NULL CHECK (opportunity_type IN ('notification_blocked', 'spin_blocked', 'geofence_entry')),
  would_have_notified BOOLEAN DEFAULT true,
  user_tier TEXT,
  distance_meters NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_missed_opportunities_sale ON missed_opportunities(flash_sale_id);
CREATE INDEX idx_missed_opportunities_biz ON missed_opportunities(business_id);

-- Notification tracking log
CREATE TABLE IF NOT EXISTS sale_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  flash_sale_id UUID REFERENCES flash_sales(id),
  business_id UUID,
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ
);

CREATE INDEX idx_notif_log_sale ON sale_notification_log(flash_sale_id);
CREATE INDEX idx_notif_log_user ON sale_notification_log(user_id);

-- RLS
ALTER TABLE missed_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full missed_opportunities access" ON missed_opportunities
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full notif_log access" ON sale_notification_log
  FOR ALL USING (auth.role() = 'service_role');
