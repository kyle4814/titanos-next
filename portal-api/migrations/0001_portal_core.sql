-- Portal core (additive only; the live D1 already holds orders, scan_requests, subscribers: never alter those here).
-- STATUS: written, NOT applied. Applying to the live D1 is an owner card (GATE5).
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  seat TEXT NOT NULL DEFAULT 'owner' CHECK (seat IN ('owner','pro','agent','enterprise','partner')),
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  domain TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  verified_at TEXT,
  UNIQUE (account_id, domain)
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  key_hash TEXT NOT NULL UNIQUE,   -- SHA-256 of the key; the key itself is shown once and never stored
  scopes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  pro_account_id TEXT REFERENCES accounts(id),
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','delivered','reproved','paid','disputed')),
  fee_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
