-- C8 f59: widen payouts for the full payout lifecycle (f42 sweep, f46 retry, f51 permanent error, f54 release/refund, f57 tick).
-- NOT APPLIED (GATE5). 0003 created payouts with a CHECK of only 4 statuses and no lifecycle columns; SQLite cannot alter a
-- CHECK in place, so the table is rebuilt (create new, copy, drop old, rename). Existing rows keep their values; new columns are NULL.
-- ledger rows reference payouts by payout_id with no FK, so the drop is safe. Run inside the migration transaction D1 provides.
CREATE TABLE payouts_new (
  id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL REFERENCES tenants(id),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval','sending','paid','failed','rejected','approved_retry','held','refunded')),
  created_at INTEGER NOT NULL,
  provider_ref TEXT,
  reason TEXT,
  sending_at INTEGER,
  attempts INTEGER,
  held_at INTEGER,
  released_at INTEGER,
  tick_at INTEGER,
  refunded_at INTEGER,
  operator_note TEXT
);
INSERT INTO payouts_new (id, partner_id, amount_cents, status, created_at, provider_ref, reason)
  SELECT id, partner_id, amount_cents, status, created_at, provider_ref, reason FROM payouts;
DROP TABLE payouts;
ALTER TABLE payouts_new RENAME TO payouts;
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payouts_partner ON payouts(partner_id, status);
