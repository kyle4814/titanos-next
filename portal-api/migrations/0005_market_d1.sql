-- C4 marketplace D1 adapter support. ADDITIVE only. NOT applied (GATE5). Needs 0004_market.sql first.
-- (The f13 D1Store branch also carries a 0004_store_counters.sql: the two 0004 files sort together; apply order is by
-- filename, both are independent, 0005 here only touches market_jobs. Renumber on merge if wrangler complains.)
-- claim_deadline mirrors state_json.claimDeadline so the claim-expiry sweep is an indexed range read, not a full scan.
ALTER TABLE market_jobs ADD COLUMN claim_deadline INTEGER;
CREATE INDEX IF NOT EXISTS idx_market_jobs_claim_deadline ON market_jobs(status, claim_deadline);
