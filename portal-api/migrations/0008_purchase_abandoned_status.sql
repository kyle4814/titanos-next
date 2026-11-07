-- f234: widen purchases.status to allow 'abandoned' (an unpaid checkout the reconciler gave up on), distinct from 'cancelled' (a genuine customer cancel).
-- SQLite cannot alter a CHECK, so the table is rebuilt: copy aside / drop / create with the new CHECK / copy back / drop the copy. Every column, row id, the UNIQUE
-- checkout_id, the 0007 index and the child links (subscriptions.purchase_id, invoices.purchase_id) are preserved. Old 'cancelled' rows keep their meaning untouched.
-- The copy-back goes into a table that already has the final name: with defer_foreign_keys the DROP's implicit child checks are deferred, and SQLite resolves them as the
-- parent rows are re-inserted (the rename-based variant leaves the deferred counter unresolved and fails at COMMIT; tested). NOT applied (GATE5, PENDING LIVE).
PRAGMA defer_foreign_keys = ON;
CREATE TABLE purchases_f234_copy AS SELECT * FROM purchases;
DROP TABLE purchases;
CREATE TABLE purchases (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), product_id TEXT NOT NULL, domain TEXT,
  checkout_id TEXT NOT NULL UNIQUE, payment_intent TEXT, subscription_id TEXT, paid_at INTEGER,
  amount_cents INTEGER NOT NULL, deliverable_issued INTEGER NOT NULL DEFAULT 0, refunded_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','cancelled','abandoned')),
  created_at INTEGER
);
INSERT INTO purchases (id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status, created_at)
  SELECT id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status, created_at FROM purchases_f234_copy;
DROP TABLE purchases_f234_copy;
CREATE INDEX IF NOT EXISTS purchases_pending ON purchases(status, created_at);
