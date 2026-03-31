-- ─── Validate Referral Code ────────────────────────────────────────────────
-- Returns referral info if code is valid and available

CREATE OR REPLACE FUNCTION validate_referral_code(p_code text)
RETURNS TABLE (
  id uuid,
  code text,
  referrer_id uuid,
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
      NULL::uuid, p_code, NULL::uuid, NULL::text, NULL::text,
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

CREATE OR REPLACE FUNCTION get_referral_stats(p_user_id uuid)
RETURNS TABLE (
  total_referrals bigint,
  rewarded_referrals bigint,
  pending_referrals bigint,
  points_earned bigint,
  conversion_rate numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::bigint AS total_referrals,
    COUNT(*) FILTER (WHERE r.status = 'rewarded')::bigint AS rewarded_referrals,
    COUNT(*) FILTER (WHERE r.status = 'pending')::bigint AS pending_referrals,
    COALESCE(SUM(r.referrer_pts) FILTER (WHERE r.status = 'rewarded'), 0)::bigint AS points_earned,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE r.status = 'rewarded')::numeric / COUNT(*)::numeric) * 100, 1)
      ELSE 0
    END AS conversion_rate
  FROM referrals r
  WHERE r.referrer_id = p_user_id;
$$;
