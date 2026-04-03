-- ============================================================
-- Plan Commitment Terms — Growth (12mo) and Pro (60mo)
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS commitment_start_date TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS commitment_months INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS early_termination_fee NUMERIC;

-- ETF calculation function for Growth and Pro plans
CREATE OR REPLACE FUNCTION calculate_etf(p_business_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_months_elapsed INTEGER;
  v_months_remaining INTEGER;
  v_plan TEXT;
  v_monthly_rate NUMERIC;
  v_commitment INTEGER;
BEGIN
  SELECT commitment_start_date, billing_plan, commitment_months
  INTO v_start, v_plan, v_commitment
  FROM businesses WHERE id = p_business_id;

  IF v_start IS NULL OR v_commitment IS NULL OR v_commitment = 0 THEN
    RETURN 0;
  END IF;

  v_monthly_rate := CASE v_plan
    WHEN 'pro' THEN 99
    WHEN 'growth' THEN 79
    ELSE 0
  END;

  v_months_elapsed := GREATEST(0, EXTRACT(MONTH FROM AGE(NOW(), v_start))::INTEGER);
  v_months_remaining := GREATEST(0, v_commitment - v_months_elapsed);
  RETURN v_months_remaining * v_monthly_rate;
END;
$$ LANGUAGE plpgsql;
