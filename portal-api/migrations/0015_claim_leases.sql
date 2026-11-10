-- C2 (f245): the claim lease as a D1 row. ADDITIVE only (one new table). NOT applied (GATE5).
-- One row per lease key (claim:<purchaseId>). expires_at is epoch ms. A holder takes it with
--   INSERT ... ON CONFLICT(key) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE claim_leases.expires_at <= ? OR claim_leases.owner = excluded.owner
-- and changes() === 1 is the win signal; a live lease held by someone else changes nothing. Release is DELETE ... WHERE key = ? AND owner = ?.
CREATE TABLE IF NOT EXISTS claim_leases (key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL);
