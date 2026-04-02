-- ============================================================
-- Social Profile Fields — for battle identity
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_username text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_profile_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_tagline text CHECK (char_length(battle_tagline) <= 50);
