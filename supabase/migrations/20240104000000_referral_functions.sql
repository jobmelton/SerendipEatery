-- ─── Add columns needed by functions below ─────────────────────────────────
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_id TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_type TEXT;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS referrer_pts INTEGER NOT NULL DEFAULT 0;

-- ─── Validate Referral Code ────────────────────────────────────────────────
-- Returns referral info if code is valid and available

CREATE OR REPLACE FUNCTION validate_referral_code(p_code text)
RETURNS TABLE (
  id uuid,
  code text,
  referrer_id text,
  referrer_type text,
  type text,
  status text,
  is_valid boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_referral record;
BEGIN
  SELECT r.* INTO v_referral
  FROM referrals r
  WHERE UPPER(r.code) = UPPER(p_code)
  LIMIT 1;

  IF v_referral IS NULL THEN
    RETURN QUERY SELECT
      NULL::uuid, p_code, NULL::text, NULL::text, NULL::text,
      NULL::text, false, 'Code not found'::text;
    RETURN;
  END IF;

  IF v_referral.status = 'rewarded' THEN
    RETURN QUERY SELECT
      v_referral.id, v_referral.code, v_referral.referrer_id,
      v_referral.referrer_type, v_referral.type, v_referral.status,
      false, 'Code already redeemed'::text;
    RETURN;
  END IF;

  IF v_referral.status = 'expired' THEN
    RETURN QUERY SELECT
      v_referral.id, v_referral.code, v_referral.referrer_id,
      v_referral.referrer_type, v_referral.type, v_referral.status,
      false, 'Code has expired'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_referral.id, v_referral.code, v_referral.referrer_id,
    v_referral.referrer_type, v_referral.type, v_referral.status,
    true, 'Valid'::text;
END;
$$;

-- ─── Get Referral Stats ───────────────────────────────────────────────────
-- Returns referral performance stats for a user

CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id UUID)
RETURNS TABLE (
  total_referrals BIGINT,
  points_earned BIGINT,
  conversion_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_referrals,
    COALESCE(SUM(pt.amount), 0)::bigint AS points_earned,
    CASE WHEN COUNT(*) > 0 THEN 1.0 ELSE 0.0 END AS conversion_rate
  FROM referrals r
  LEFT JOIN point_transactions pt ON pt.reference_id = r.id::text
  WHERE r.referrer_user_id = p_user_id
     OR r.referrer_biz_id IN (
       SELECT id FROM businesses WHERE clerk_id = p_user_id::text
     );
END;
$$ LANGUAGE plpgsql STABLE;
