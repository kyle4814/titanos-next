-- Site counters (additive only). STATUS: written, NOT applied. Applying to the live D1 is an owner card (GATE5).
-- One row per (counter name, UTC hour). bucket = floor(epoch_ms / 3600000). No domain, no IP, no person: names and counts only.
CREATE TABLE IF NOT EXISTS counter_buckets (
  name TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (name, bucket)
);
