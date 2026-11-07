-- C5 (f301): the unmatched-demand log and the generator queue as D1 tables. ADDITIVE only (two new tables). NOT applied (GATE5).
-- Number note: 0016 is taken by the unmerged web/f285 branch (0016_purchase_refunded_at.sql), so this is 0017; checked with portal-api/scripts/migration_collisions.mjs (f297).
-- unmatched_log: ONE row per (normalised ask, asker). A repeat by the same asker is an upsert: seen_count + 1, first_seen_at keeps the earliest, last_seen_at moves to the latest.
-- Distinct askers for a cluster = COUNT of rows with different asker_id; a missing asker is the single 'anon' asker. Times are caller-supplied ISO-8601 text (no clock in the adapter).
CREATE TABLE IF NOT EXISTS unmatched_log (
  normalised TEXT NOT NULL,
  asker_id TEXT NOT NULL DEFAULT 'anon',
  ask TEXT NOT NULL,
  seat TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'LOGGED_FOR_GENERATOR',
  seen_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT,
  last_seen_at TEXT,
  PRIMARY KEY (normalised, asker_id)
);
CREATE INDEX IF NOT EXISTS idx_unmatched_log_last_seen ON unmatched_log (last_seen_at);
-- generator_queue: a snapshot of ranked demand clusters (status QUEUED_FOR_GENERATOR). No grade, no price, no URL: a queue row can never be shown or sold.
CREATE TABLE IF NOT EXISTS generator_queue (
  cluster_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  ask_count INTEGER NOT NULL,
  distinct_askers INTEGER NOT NULL,
  first_seen TEXT,
  last_seen TEXT,
  sample_asks_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'QUEUED_FOR_GENERATOR'
);
