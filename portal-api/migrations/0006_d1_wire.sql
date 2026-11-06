-- D1 wire (x1_d1_worker_local). ADDITIVE except two tables that no database holds yet (every earlier migration is NOT applied, GATE5):
-- payouts and market_cards are rebuilt because a CHECK constraint cannot be altered in D1, and the code uses states the originals reject
-- ('sending' on a payout, 'clawback_review' on a market card). Do not apply this to a database that already holds rows in those two tables.
ALTER TABLE sso_states ADD COLUMN client_key TEXT NOT NULL DEFAULT '';
ALTER TABLE partner_ledger ADD COLUMN held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE partner_ledger ADD COLUMN hold_reasons TEXT;
ALTER TABLE tenants ADD COLUMN brand_public INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sso_states_tenant ON sso_states(tenant_id, client_key);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_partner ON partner_ledger(partner_id, at);
DROP TABLE IF EXISTS payouts;
CREATE TABLE payouts (id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES tenants(id), amount_cents INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending_approval','sending','paid','failed','rejected')), created_at INTEGER NOT NULL, provider_ref TEXT, reason TEXT);
CREATE INDEX idx_payouts_partner ON payouts(partner_id);
DROP TABLE IF EXISTS market_cards;
CREATE TABLE market_cards (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('payout_review','dispute','clawback_review')), job_id TEXT NOT NULL REFERENCES market_jobs(id),
  reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, outcome TEXT
);
