-- C2 plan write concurrency (f175): a per-row version for compare-and-set on subscriptions (same idea as f13's credits).
-- ADDITIVE only (one NOT NULL column with a default, so existing rows start at 0). STATUS: written, NOT APPLIED. Applying it to any D1 is an owner card (GATE5).
-- Every write path bumps it: the upsert (version + 1) and the CAS UPDATE (WHERE version = ?). ALTER ADD COLUMN is not re-runnable (wrangler's applied-migrations table).
ALTER TABLE subscriptions ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
