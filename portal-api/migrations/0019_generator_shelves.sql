-- f305 C5: the graded shelf body + grader run per cluster, read by the catalogue build step. NOT APPLIED (GATE5). Synthetic rows only until a live gate opens.
-- Written by the drain step after gradeAll (runFromGraded(g) -> run_json). The build reads it, never writes it.
CREATE TABLE IF NOT EXISTS generator_shelves (
  cluster_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  shelf_json TEXT NOT NULL,
  run_json TEXT
);
