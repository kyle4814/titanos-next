-- C2: sessions, login tokens, purchases, subscriptions, invoices, review cards. ADDITIVE only. NOT applied (GATE5).
-- Hashes only: login tokens, session tokens and API keys are never stored in the clear.
CREATE TABLE IF NOT EXISTS login_tokens (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS login_requests (email TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_login_requests ON login_requests(email, at);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), product_id TEXT NOT NULL, domain TEXT,
  checkout_id TEXT NOT NULL UNIQUE, payment_intent TEXT, subscription_id TEXT, paid_at INTEGER,
  amount_cents INTEGER NOT NULL, deliverable_issued INTEGER NOT NULL DEFAULT 0, refunded_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','cancelled'))
);
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), purchase_id TEXT NOT NULL REFERENCES purchases(id), product_id TEXT NOT NULL, started_at INTEGER NOT NULL, cancel_at INTEGER, cancelled_at INTEGER);
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), number TEXT NOT NULL UNIQUE, product_id TEXT NOT NULL, amount_cents INTEGER NOT NULL, issued_at INTEGER NOT NULL, stripe_event_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stripe_events (id TEXT PRIMARY KEY, at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS review_cards (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, purchase_id TEXT NOT NULL, kind TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0);
