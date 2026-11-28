-- TITANOS digital products: order log, webhook idempotency, refund-before-payment holds, checkout rate limit, test outbox.
-- Apply with: wrangler d1 migrations apply titanos-digital --remote   (a GATE: Kyle's tap, see docs/ops/DIGITAL_PRODUCTS_GO_LIVE_2026-11-28.md)
-- Times are epoch milliseconds unless the column says _sec.

-- One row per Stripe event id that finished processing. A duplicate delivery is answered "duplicate" and does nothing.
CREATE TABLE IF NOT EXISTS digital_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

-- The order log. session_id is UNIQUE so a replayed completion can never create a second order.
-- downloads / max_downloads and token_exp_sec are enforced atomically in consumeDownload (a conditional UPDATE).
-- status 'revoked' = a refund or dispute took the link away. email_lease_at guards against two concurrent sends.
CREATE TABLE IF NOT EXISTS digital_orders (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  payment_intent TEXT,
  slug TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'revoked')),
  downloads INTEGER NOT NULL DEFAULT 0,
  max_downloads INTEGER NOT NULL DEFAULT 5,
  token_exp_sec INTEGER NOT NULL,
  email_lease_at INTEGER,
  emailed_at INTEGER,
  revoked_at INTEGER,
  revoke_reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_digital_orders_pi ON digital_orders(payment_intent);
CREATE INDEX IF NOT EXISTS idx_digital_orders_created ON digital_orders(created_at);

-- A refund or dispute that arrived BEFORE its payment completed. Applied when the order is created.
CREATE TABLE IF NOT EXISTS digital_pending_revocations (
  payment_intent TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Every download attempt, success or refusal (order log, no IP stored).
CREATE TABLE IF NOT EXISTS digital_download_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  result TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_digital_download_log_order ON digital_download_log(order_id);

-- Per-IP-hash hourly counter for POST /digital/checkout (k = "<hour bucket>:<sha256 of ip>").
CREATE TABLE IF NOT EXISTS digital_rate (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL
);

-- TEST MODE ONLY: with DIGITAL_DEV_OUTBOX="1" and DIGITAL_STRIPE_MODE="test" the mailer parks messages here instead of sending.
CREATE TABLE IF NOT EXISTS digital_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
