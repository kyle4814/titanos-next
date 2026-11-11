-- Declaration mailing list (2026-11-10). ADDITIVE only (one new table). NOT applied (GATE5): a deploy applies it.
-- One row per email (lower-cased). tags is a JSON array of short slugs (e.g. "daily-artifacts", "course-trading-app"); a repeat signup merges tags.
-- consent_text is the exact consent line the server recorded at signup. Capture only: nothing in this codebase sends mail to this table.
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  tags TEXT NOT NULL DEFAULT '[]',
  consent_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscribers_created ON subscribers (created_at);
