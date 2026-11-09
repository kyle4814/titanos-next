-- C4 marketplace. ADDITIVE only. NOT applied (GATE5). Supersedes the unused `jobs` table from 0001 (left untouched):
-- the job needs states 0001 does not allow (awaiting_funds, cancelled, refunded) and CHECK constraints cannot be altered in D1.
-- State is one JSON row per job, like the owner seat; status is mirrored in a column so the claim and payout
-- transitions are single compare-and-set statements: UPDATE market_jobs SET status=?, state_json=?, updated_at=? WHERE id=? AND status IN (...).
CREATE TABLE IF NOT EXISTS market_jobs (
  id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES accounts(id),
  pro_account_id TEXT REFERENCES accounts(id),
  domain_id TEXT NOT NULL REFERENCES domains(id),
  check_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('awaiting_funds','open','claimed','delivered','reproved','paid','disputed','cancelled','refunded')),
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_market_jobs_status ON market_jobs(status);
CREATE INDEX IF NOT EXISTS idx_market_jobs_pro ON market_jobs(pro_account_id);
CREATE INDEX IF NOT EXISTS idx_market_jobs_owner ON market_jobs(owner_account_id);
-- One live job per (domain, check): the duplicate guard in code, enforced here too.
CREATE UNIQUE INDEX IF NOT EXISTS uq_market_live_job ON market_jobs(domain_id, check_name) WHERE status IN ('awaiting_funds','open','claimed','delivered','reproved','disputed');
CREATE TABLE IF NOT EXISTS pro_profiles (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  state_json TEXT NOT NULL            -- display name, plan, connect account id, onboarded flag
);
CREATE TABLE IF NOT EXISTS market_cards (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('payout_review','dispute','clawback_review')), job_id TEXT NOT NULL REFERENCES market_jobs(id),
  reason TEXT NOT NULL, created_at INTEGER NOT NULL, resolved INTEGER NOT NULL DEFAULT 0, outcome TEXT
);
