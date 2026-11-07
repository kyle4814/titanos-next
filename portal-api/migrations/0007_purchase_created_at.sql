-- f210: when a purchase row was created, so the pending reconciler can tell "checkout just started" from "past grace". ADDITIVE only. NOT applied (GATE5).
-- Rows written before this column carry NULL, which the reconciler treats as oldest (a Stripe lookup is read-only, so over-eager is safe).
ALTER TABLE purchases ADD COLUMN created_at INTEGER;
CREATE INDEX IF NOT EXISTS purchases_pending ON purchases(status, created_at);
