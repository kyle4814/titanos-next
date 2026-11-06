-- C3 owner seat. ADDITIVE only. NOT applied (GATE5). One JSON state row per verified domain: findings with proof state,
-- fixes with their exact undo records, badge history, events. The engine in src/owner/engine.ts reads and writes the whole row.
CREATE TABLE IF NOT EXISTS owner_state (
  domain_id TEXT PRIMARY KEY REFERENCES domains(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  state_json TEXT NOT NULL,
  next_scan_at INTEGER,           -- monitor: epoch ms of the next scheduled scan, NULL when the monitor is off
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_owner_state_due ON owner_state(next_scan_at);
CREATE INDEX IF NOT EXISTS idx_owner_state_account ON owner_state(account_id);
