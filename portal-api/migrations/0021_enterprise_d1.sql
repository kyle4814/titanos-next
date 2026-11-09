-- C8 f315: schema the D1 EntStore and D1ApprovalStore need beyond 0003_enterprise.sql. ADDITIVE, plus a rebuild of the payouts table
-- (SQLite cannot alter a CHECK; the table is empty-by-design until payouts go live). NOT applied (GATE5).
-- Numbered 0021 on purpose: highest on the base is 0019, and web/f312 already claims 0020_graded_run_store.sql.
ALTER TABLE tenants ADD COLUMN brand_public INTEGER NOT NULL DEFAULT 0;
-- (sso_states.client_key moved to 0022_sso_states_client_key.sql by f360: nullable, so pre-migration rows are NULL and never evicted by the per-source rule)
ALTER TABLE partner_ledger ADD COLUMN held INTEGER NOT NULL DEFAULT 0;          -- SELF-DEAL-SUSPECT: not payable until the operator's tap
ALTER TABLE partner_ledger ADD COLUMN hold_reasons TEXT;                         -- JSON array of strings
CREATE TABLE payouts_v2 (
  id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES tenants(id), amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('pending_approval','sending','paid','failed','rejected','approved_retry','held','refunded')),
  created_at INTEGER NOT NULL, provider_ref TEXT, reason TEXT, sending_at INTEGER, attempts INTEGER, held_at INTEGER,
  released_at INTEGER, tick_at INTEGER, refunded_at INTEGER, operator_note TEXT   -- f360: carried over from 0004_payouts_lifecycle so the rebuild does not drop the lifecycle columns
);
INSERT INTO payouts_v2 (id, partner_id, amount_cents, status, created_at, provider_ref, reason, sending_at, attempts, held_at, released_at, tick_at, refunded_at, operator_note) SELECT id, partner_id, amount_cents, status, created_at, provider_ref, reason, sending_at, attempts, held_at, released_at, tick_at, refunded_at, operator_note FROM payouts;
DROP TABLE payouts;
ALTER TABLE payouts_v2 RENAME TO payouts;
CREATE INDEX IF NOT EXISTS idx_payouts_partner ON payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, partner_id);
CREATE INDEX IF NOT EXISTS idx_ledger_partner ON partner_ledger(partner_id, at);
CREATE INDEX IF NOT EXISTS idx_ledger_invoice ON partner_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sso_states_tenant ON sso_states(tenant_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_referrals_partner ON referrals(partner_id);
-- First-writer-wins payout decision record. partner_id is copied from the payout row at insert time, so every read can be partner-scoped.
CREATE TABLE IF NOT EXISTS ent_payout_approvals (
  payout_id TEXT PRIMARY KEY REFERENCES payouts(id), partner_id TEXT NOT NULL REFERENCES tenants(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','deny')), card_id TEXT NOT NULL, decided_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_approvals_partner ON ent_payout_approvals(partner_id);
