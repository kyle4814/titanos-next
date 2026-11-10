-- f312 C5: the graded run per cluster_id, persisted after drainQueue so the build step can call promoteDrained and
-- assertCatalogueAllGraded from stored data. NOT APPLIED (GATE5). Number 0020: 0016 f285, 0017 f301, 0019 generator_shelves (other branch).
-- checks and shelf are JSON TEXT. content_hash binds the run to the exact shelf content that was graded. Synthetic rows only until a live gate opens.
CREATE TABLE IF NOT EXISTS graded_run (
  cluster_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  pass INTEGER NOT NULL CHECK (pass IN (0, 1)),
  checks TEXT NOT NULL,
  shelf TEXT NOT NULL,
  graded_at TEXT NOT NULL
);
