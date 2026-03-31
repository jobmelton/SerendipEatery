-- ─── Leaderboard Function ──────────────────────────────────────────────────
-- Returns top 20 users by points with anonymized names (first name + last initial)

CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (
  rank bigint,
  display_name text,
  points integer,
  tier text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ROW_NUMBER() OVER (ORDER BY u.points DESC) AS rank,
    CASE
      WHEN u.display_name IS NULL OR u.display_name = '' THEN 'Anonymous'
      WHEN POSITION(' ' IN u.display_name) > 0 THEN
        SPLIT_PART(u.display_name, ' ', 1) || ' ' ||
        LEFT(SPLIT_PART(u.display_name, ' ', 2), 1) || '.'
      ELSE u.display_name
    END AS display_name,
    u.points,
    u.consumer_tier AS tier
  FROM users u
  ORDER BY u.points DESC
  LIMIT 20;
$$;

-- ─── Tier Progress Function ───────────────────────────────────────────────
-- Returns tier progress for a given user

CREATE OR REPLACE FUNCTION get_tier_progress(p_user_id uuid)
RETURNS TABLE (
  current_tier text,
  current_threshold integer,
  next_tier text,
  next_threshold integer,
  points integer,
  points_to_next integer,
  progress_pct numeric
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_points integer;
  v_tiers jsonb := '[
    {"tier": "explorer", "threshold": 0},
    {"tier": "regular", "threshold": 500},
    {"tier": "local_legend", "threshold": 1500},
    {"tier": "foodie_royale", "threshold": 4000},
    {"tier": "tastemaker", "threshold": 10000},
    {"tier": "influencer", "threshold": 25000},
    {"tier": "food_legend", "threshold": 60000},
    {"tier": "icon", "threshold": 150000}
  ]';
  v_current_idx integer := 0;
  v_tier_count integer;
  v_current jsonb;
  v_next jsonb;
BEGIN
  -- Get user points
  SELECT u.points INTO v_points FROM users u WHERE u.id = p_user_id;
  IF v_points IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_tier_count := jsonb_array_length(v_tiers);

  -- Find current tier index
  FOR i IN 0..v_tier_count - 1 LOOP
    IF v_points >= (v_tiers->i->>'threshold')::integer THEN
      v_current_idx := i;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  v_current := v_tiers->v_current_idx;

  IF v_current_idx < v_tier_count - 1 THEN
    v_next := v_tiers->(v_current_idx + 1);

    RETURN QUERY SELECT
      (v_current->>'tier')::text,
      (v_current->>'threshold')::integer,
      (v_next->>'tier')::text,
      (v_next->>'threshold')::integer,
      v_points,
      (v_next->>'threshold')::integer - v_points,
      LEAST(GREATEST(
        ((v_points - (v_current->>'threshold')::integer)::numeric /
         NULLIF((v_next->>'threshold')::integer - (v_current->>'threshold')::integer, 0)::numeric) * 100,
        0), 100);
  ELSE
    RETURN QUERY SELECT
      (v_current->>'tier')::text,
      (v_current->>'threshold')::integer,
      NULL::text,
      NULL::integer,
      v_points,
      NULL::integer,
      100::numeric;
  END IF;
END;
$$;
