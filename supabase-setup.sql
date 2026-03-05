-- JARVISPHINE v5.0 — Supabase Setup
-- Run this entire script in your Supabase SQL Editor
-- Project: aufkmpzzxbdzhnodrpkd

-- Drop table if exists (clean slate)
DROP TABLE IF EXISTS jarvisphine_kv;

-- Key-value store (single-user, simple)
CREATE TABLE jarvisphine_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_updated_at
BEFORE UPDATE ON jarvisphine_kv
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE jarvisphine_kv ENABLE ROW LEVEL SECURITY;

-- Open policy (single-user app, protected by app-level passphrase)
CREATE POLICY "anon_full_access" ON jarvisphine_kv
  FOR ALL TO anon
  USING (true)
  WITH CHECK (true);

-- Seed keys (initial empty state)
INSERT INTO jarvisphine_kv (key, value) VALUES
  ('memory',       '{"today":{"drinks":null,"sport":null,"mood":null,"water":null,"journal":"","wake":null,"outdoor":null},"streaks":{"sober_days":0,"sport_days":0,"sober_best":0,"sport_best":0},"goals":{"weekly":[],"monthly":[],"quarterly":[]},"history":[],"lastDate":null,"debriefs":[]}'),
  ('settings',     '{"userName":"Friend","provider":"claude","personality":"sharp"}'),
  ('chat_history', '[]'),
  ('save_states',  '[]'),
  ('telegram_config', '{"chatId":null,"checkins_sent":{}}')
ON CONFLICT (key) DO NOTHING;
