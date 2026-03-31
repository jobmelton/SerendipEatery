-- ─── Check Evidence Thresholds ─────────────────────────────────────────────
-- Returns the current evidence score for a business

CREATE OR REPLACE FUNCTION check_evidence_thresholds(p_business_id uuid)
RETURNS TABLE (
  referral_visits bigint,
  biz_referrals bigint,
  total_sales bigint,
  conversion_rate numeric,
  repeat_customers bigint,
  thresholds_met integer,
  all_met boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_referral_visits bigint;
  v_biz_referrals bigint;
  v_total_sales bigint;
  v_total_spins bigint;
  v_confirmed_visits bigint;
  v_conversion_rate numeric;
  v_repeat_customers bigint;
  v_met integer := 0;
BEGIN
  -- 1. Referral visits (confirmed visits from referred users)
  SELECT COUNT(*) INTO v_referral_visits
  FROM visit_intents vi
  WHERE vi.business_id = p_business_id
    AND vi.state = 'confirmed';
  -- Simplified: count all confirmed visits as potential referral visits
  -- In production, join with referrals table for exact count

  -- 2. Business referrals
  SELECT COUNT(*) INTO v_biz_referrals
  FROM referrals r
  WHERE r.referrer_id = p_business_id::text
    AND r.referrer_type = 'business'
    AND r.type = 'biz_to_biz'
    AND r.status = 'rewarded';

  -- 3. Total completed sales
  SELECT COUNT(*) INTO v_total_sales
  FROM flash_sales fs
  WHERE fs.business_id = p_business_id
    AND fs.status = 'ended';

  -- 4. Conversion rate
  SELECT COALESCE(SUM(fs.spins_used), 0) INTO v_total_spins
  FROM flash_sales fs
  WHERE fs.business_id = p_business_id
    AND fs.status = 'ended';

  SELECT COUNT(*) INTO v_confirmed_visits
  FROM visit_intents vi
  WHERE vi.business_id = p_business_id
    AND vi.state = 'confirmed';

  IF v_total_spins > 0 THEN
    v_conversion_rate := ROUND((v_confirmed_visits::numeric / v_total_spins::numeric) * 100, 1);
  ELSE
    v_conversion_rate := 0;
  END IF;

  -- 5. Repeat customers
  SELECT COUNT(*) INTO v_repeat_customers
  FROM (
    SELECT vi.user_id
    FROM visit_intents vi
    WHERE vi.business_id = p_business_id
      AND vi.state = 'confirmed'
    GROUP BY vi.user_id
    HAVING COUNT(*) > 1
  ) repeats;

  -- Count thresholds met
  IF v_referral_visits >= 3 THEN v_met := v_met + 1; END IF;
  IF v_biz_referrals >= 1 THEN v_met := v_met + 1; END IF;
  IF v_total_sales >= 5 THEN v_met := v_met + 1; END IF;
  IF v_conversion_rate >= 20 THEN v_met := v_met + 1; END IF;
  IF v_repeat_customers >= 3 THEN v_met := v_met + 1; END IF;

  RETURN QUERY SELECT
    v_referral_visits,
    v_biz_referrals,
    v_total_sales,
    v_conversion_rate,
    v_repeat_customers,
    v_met,
    (v_met >= 5);
END;
$$;

-- ─── Get Evidence Progress ────────────────────────────────────────────────
-- Returns individual threshold progress for dashboard display

CREATE OR REPLACE FUNCTION get_evidence_progress(p_business_id uuid)
RETURNS TABLE (
  referral_visits bigint,
  biz_referrals bigint,
  total_sales bigint,
  conversion_rate numeric,
  repeat_customers bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_referral_visits bigint;
  v_biz_referrals bigint;
  v_total_sales bigint;
  v_total_spins bigint;
  v_confirmed_visits bigint;
  v_conversion_rate numeric;
  v_repeat_customers bigint;
BEGIN
  SELECT COUNT(*) INTO v_referral_visits
  FROM visit_intents vi
  WHERE vi.business_id = p_business_id
    AND vi.state = 'confirmed';

  SELECT COUNT(*) INTO v_biz_referrals
  FROM referrals r
  WHERE r.referrer_id = p_business_id::text
    AND r.referrer_type = 'business'
    AND r.type = 'biz_to_biz'
    AND r.status = 'rewarded';

  SELECT COUNT(*) INTO v_total_sales
  FROM flash_sales fs
  WHERE fs.business_id = p_business_id
    AND fs.status = 'ended';

  SELECT COALESCE(SUM(fs.spins_used), 0) INTO v_total_spins
  FROM flash_sales fs
  WHERE fs.business_id = p_business_id
    AND fs.status = 'ended';

  SELECT COUNT(*) INTO v_confirmed_visits
  FROM visit_intents vi
  WHERE vi.business_id = p_business_id
    AND vi.state = 'confirmed';

  IF v_total_spins > 0 THEN
    v_conversion_rate := ROUND((v_confirmed_visits::numeric / v_total_spins::numeric) * 100, 1);
  ELSE
    v_conversion_rate := 0;
  END IF;

  SELECT COUNT(*) INTO v_repeat_customers
  FROM (
    SELECT vi.user_id
    FROM visit_intents vi
    WHERE vi.business_id = p_business_id
      AND vi.state = 'confirmed'
    GROUP BY vi.user_id
    HAVING COUNT(*) > 1
  ) repeats;

  RETURN QUERY SELECT
    v_referral_visits,
    v_biz_referrals,
    v_total_sales,
    v_conversion_rate,
    v_repeat_customers;
END;
$$;
