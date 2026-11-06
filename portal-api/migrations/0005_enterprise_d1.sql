-- C8 EntD1 (f16): schema gaps the EntStore needs that 0003_enterprise.sql (w8) left out. ADDITIVE / rebuild of an empty-by-design
-- table only. NOT applied (GATE5). Numbered above 0004 on purpose: the w8 branch's 0003_enterprise.sql clashes in number with the w7
-- branch's 0003_agent_door.sql; that clash is flagged in the receipt, not renamed here.
-- Order on a database that already has 0001/0002: 0003_agent_door, 0003_enterprise (renumber one), 0004_store_counters, then this file.
ALTER TABLE tenants ADD COLUMN brand_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sso_states ADD COLUMN client_key TEXT NOT NULL DEFAULT '';
-- 0003 payouts CHECK omits 'sending' (a small payout is 'sending' until the provider answers); SQLite cannot alter a CHECK, so rebuild.
CREATE TABLE payouts_v2 (id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES tenants(id), amount_cents INTEGER NOT NULL CHECK (amount_cents > 0), status TEXT NOT NULL CHECK (status IN ('pending_approval','sending','paid','failed','rejected')), created_at INTEGER NOT NULL, provider_ref TEXT, reason TEXT);
INSERT INTO payouts_v2 (id, partner_id, amount_cents, status, created_at, provider_ref, reason) SELECT id, partner_id, amount_cents, status, created_at, provider_ref, reason FROM payouts;
DROP TABLE payouts;
ALTER TABLE payouts_v2 RENAME TO payouts;
CREATE INDEX IF NOT EXISTS idx_payouts_partner ON payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_ledger_partner ON partner_ledger(partner_id, at);
CREATE INDEX IF NOT EXISTS idx_ledger_invoice ON partner_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sso_states_tenant ON sso_states(tenant_id, expires_at);
-- One payout reservation per ledger row id is enforced by partner_ledger UNIQUE(partner_id, uniq) with uniq = payout:<id>.
