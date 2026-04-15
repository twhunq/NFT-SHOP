-- =============================================
-- Add app_settings table for global admin config
-- Run in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_text TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and allow frontend anon key to read/write settings.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app_settings select" ON app_settings;
DROP POLICY IF EXISTS "Allow app_settings insert" ON app_settings;
DROP POLICY IF EXISTS "Allow app_settings update" ON app_settings;
DROP POLICY IF EXISTS "Block app_settings delete" ON app_settings;

CREATE POLICY "Allow app_settings select" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Allow app_settings insert" ON app_settings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow app_settings update" ON app_settings
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Block app_settings delete" ON app_settings
  FOR DELETE USING (false);

-- Seed default key for claim code if missing.
INSERT INTO app_settings (key, value_text)
VALUES ('claim_code', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value_text)
VALUES ('announcement_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value_text)
VALUES ('announcement_content', '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value_text)
VALUES ('facebook_group_url', '')
ON CONFLICT (key) DO NOTHING;
