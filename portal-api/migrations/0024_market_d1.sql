-- C4 marketplace D1 adapter (src/market/d1store.ts, ported from F18 0005_market_d1 and renumbered). ADDITIVE only.
-- claim_deadline mirrors state_json.claimDeadline so a claim-expiry read is an indexed range read; jobsByDomain gets its index.
ALTER TABLE market_jobs ADD COLUMN claim_deadline INTEGER;
CREATE INDEX IF NOT EXISTS idx_market_jobs_claim_deadline ON market_jobs(status, claim_deadline);
CREATE INDEX IF NOT EXISTS idx_market_jobs_domain ON market_jobs(domain_id);
