-- f102: append-only anchor of dispute audit head hashes. NOT applied to any live D1 (GATE5).
-- One row per (job_id, seq). UPDATE and DELETE are aborted by trigger, so the anchor history can only grow.
CREATE TABLE IF NOT EXISTS audit_anchor (
  job_id TEXT NOT NULL,
  seq INTEGER NOT NULL CHECK (seq >= 1),
  head TEXT NOT NULL CHECK (length(head) = 64),
  anchored_at INTEGER NOT NULL,
  PRIMARY KEY (job_id, seq)
);
CREATE TRIGGER IF NOT EXISTS audit_anchor_no_update BEFORE UPDATE ON audit_anchor BEGIN SELECT RAISE(ABORT, 'audit_anchor_append_only'); END;
CREATE TRIGGER IF NOT EXISTS audit_anchor_no_delete BEFORE DELETE ON audit_anchor BEGIN SELECT RAISE(ABORT, 'audit_anchor_append_only'); END;
