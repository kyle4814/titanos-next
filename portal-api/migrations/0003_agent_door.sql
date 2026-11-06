-- C7 agent door. ADDITIVE only. Written, NOT applied (applying to the live D1 is GATE5).
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  delta INTEGER NOT NULL,                 -- credits; 1 credit = AU$0.01 (EXAMPLE rate until Kyle fixes it)
  reason TEXT NOT NULL CHECK (reason IN ('topup','debit','reversal')),
  ref TEXT NOT NULL,                      -- stripe event / receipt id; UNIQUE per (reason, ref) keeps top-ups idempotent
  at INTEGER NOT NULL,
  UNIQUE (reason, ref)
);
CREATE INDEX IF NOT EXISTS credit_ledger_account ON credit_ledger(account_id);
CREATE TABLE IF NOT EXISTS credit_orders (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), checkout_id TEXT NOT NULL UNIQUE,
  pack_id TEXT NOT NULL, credits INTEGER NOT NULL, paid INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS agent_receipts (
  id TEXT PRIMARY KEY, tool TEXT NOT NULL, key_id TEXT NOT NULL REFERENCES api_keys(id), account_id TEXT NOT NULL REFERENCES accounts(id),
  at INTEGER NOT NULL, input_sha TEXT NOT NULL, output_sha TEXT NOT NULL, credits INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('free','prepaid','byok')), sig TEXT NOT NULL, idem TEXT,
  UNIQUE (key_id, idem)
);
CREATE TABLE IF NOT EXISTS agent_calls (key_id TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS agent_calls_key ON agent_calls(key_id, at);
