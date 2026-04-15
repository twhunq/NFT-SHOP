-- =============================================
-- Google OAuth only authentication migration
-- Run in Supabase SQL Editor
-- =============================================

-- 1) Extend users table for Google profile mapping
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'google';

-- 2) Unique indexes for account identity
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique ON public.users(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON public.users(email) WHERE email IS NOT NULL;

-- 3) Backfill legacy users to keep compatibility
UPDATE public.users
SET auth_provider = COALESCE(NULLIF(auth_provider, ''), 'legacy')
WHERE auth_provider IS NULL OR auth_provider = '';

-- 4) Refresh public view (không expose password)
CREATE OR REPLACE VIEW public.users_public AS
SELECT
  username,
  display_name,
  balance,
  total_deposit,
  last_login_at,
  created_at,
  email,
  avatar_url,
  auth_provider
FROM public.users;
