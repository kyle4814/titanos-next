-- C2 plan state (f172): the f96 PlanState (tier, billed periods, pending change, period grid, ledger, outcomes) persisted as JSON on the subscription row.
-- ADDITIVE only (one nullable column). STATUS: written, NOT APPLIED. Applying it to any D1 is an owner card (GATE5).
-- Numbering: the web/f13_c2_d1store stack also carries a 0004_store_counters.sql; whoever merges both renumbers one (wrangler orders by filename).
-- ALTER ... ADD COLUMN is not re-runnable: it relies on wrangler's applied-migrations table, unlike the IF NOT EXISTS files above.
ALTER TABLE subscriptions ADD COLUMN plan_json TEXT;
