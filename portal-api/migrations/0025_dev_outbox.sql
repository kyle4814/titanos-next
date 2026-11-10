-- TEST MODE ONLY: the dev outbox. With DEV_OUTBOX="1" and a non-live Stripe mode, the Worker's mailer writes each message here
-- instead of sending it (no mail transport is bound yet). Read only by the operator through wrangler (D1 access); no HTTP route
-- serves it. buildDeps refuses the dev outbox when STRIPE_MODE is "live", so a live deploy can never park login links here.
CREATE TABLE IF NOT EXISTS dev_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_addr TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dev_outbox_created ON dev_outbox(created_at);
