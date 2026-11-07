-- f303 C5: drain state for the generator queue. NOT APPLIED (GATE5). Numbering: 0016 is f285 (unmerged), 0017 is f301 (unmerged, creates generator_queue).
-- If f301 merges first this file only adds the drain columns; if this lands alone it creates the table. Written create-if-absent, then additive.
-- Columns follow lib/shop/drain.ts DrainEntry. failed_checks is a JSON array of check ids (TEXT). Synthetic rows only until a live gate opens.
CREATE TABLE IF NOT EXISTS generator_queue (
  cluster_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  first_seen TEXT,
  status TEXT NOT NULL CHECK (status IN ('QUEUED','QUEUED_FOR_GENERATOR','GRADED_PASS','GRADED_FAIL','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  failed_checks TEXT NOT NULL DEFAULT '[]',
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_generator_queue_status ON generator_queue (status, first_seen);
