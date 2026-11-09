-- F58: D1 persistence for the agent door (C7). ADDITIVE only. WRITTEN, NOT APPLIED (applying to the live D1 is GATE5).
-- Builds on 0001 (api_keys), 0003_agent_door (credit_ledger, agent_receipts, agent_calls) and 0014 (kid, prefix index; renumbered from 0005 in the int branch).
-- Tenant key: account_id IS the tenant_id for this door; every agent query filters on it (see src/agent/d1agent.ts).
-- Secrets: api_keys.key_hash is SHA-256 of the tk_ token; the token and the receipt HMAC secret are never stored.
-- Spend caps per key, in credits. NULL = the application default applies, never unlimited.
ALTER TABLE api_keys ADD COLUMN cap_daily INTEGER;
ALTER TABLE api_keys ADD COLUMN cap_total INTEGER;
-- F23: non-secret display handle ("tk_" + 8 hex of the token) for the keys page. Not a secret, not unique, not a lookup key.
ALTER TABLE api_keys ADD COLUMN prefix TEXT;
-- Which key spent it (NULL for top-ups). Lets a per-key spend cap be summed in the same statement as the debit.
ALTER TABLE credit_ledger ADD COLUMN key_id TEXT REFERENCES api_keys(id);
CREATE INDEX IF NOT EXISTS credit_ledger_key_at ON credit_ledger(key_id, at);
-- credit_ledger is APPEND-ONLY. Corrections are new rows (reason 'reversal'), never an edit. The idempotency key is
-- credit_ledger.ref under UNIQUE (reason, ref) from 0003: a replayed top-up or debit inserts nothing.
CREATE TRIGGER IF NOT EXISTS credit_ledger_no_update BEFORE UPDATE ON credit_ledger
BEGIN SELECT RAISE(ABORT, 'credit_ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS credit_ledger_no_delete BEFORE DELETE ON credit_ledger
BEGIN SELECT RAISE(ABORT, 'credit_ledger is append-only'); END;
-- F17 table, identical definition (IF NOT EXISTS), so either order of merge is safe.
CREATE TABLE IF NOT EXISTS idem_reservations (
  key_id TEXT NOT NULL REFERENCES api_keys(id), idem TEXT NOT NULL, rid TEXT NOT NULL, owner TEXT NOT NULL, expires_at INTEGER NOT NULL,
  PRIMARY KEY (key_id, idem)
);
