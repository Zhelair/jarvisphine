-- JARVISPHINE v5.0 — Supabase Setup
-- Paste this in: Supabase → SQL Editor → Run

CREATE TABLE jarvisphine_kv (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE jarvisphine_kv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open" ON jarvisphine_kv
  FOR ALL USING (true) WITH CHECK (true);
