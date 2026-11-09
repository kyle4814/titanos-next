-- f187: durable dispute case (one row per tenant + job). NOT applied to any live D1 (GATE5).
-- tenant_id is the job owner's account id and is in every WHERE the store runs. The hash chain (audit) travels INSIDE case_json, so a case
-- write and its chain append are ONE statement: an INSERT (new case) or an UPDATE guarded by the previous chain head (compare-and-set).
-- head = hash of the last audit entry and audit_len = entry count; the store refuses to read a row whose JSON disagrees with them.
-- The anchors (0006_audit_anchor.sql, f102) stay a separate append-only table; they are what catches a rewritten or truncated case.
CREATE TABLE IF NOT EXISTS dispute_case (
  tenant_id TEXT NOT NULL CHECK (tenant_id <> ''),
  job_id TEXT NOT NULL CHECK (job_id <> ''),
  state TEXT NOT NULL CHECK (state IN ('OPEN','EVIDENCE','RESOLVED_PAID','RESOLVED_REFUNDED','CLAWBACK')),
  head TEXT NOT NULL CHECK (length(head) = 64),
  audit_len INTEGER NOT NULL CHECK (audit_len >= 1),
  case_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, job_id)
);
CREATE TRIGGER IF NOT EXISTS dispute_case_identity_fixed BEFORE UPDATE OF tenant_id, job_id ON dispute_case BEGIN SELECT RAISE(ABORT, 'dispute_case_identity_fixed'); END;
