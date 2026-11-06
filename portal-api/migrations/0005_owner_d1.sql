-- F15 D1OwnerStore. ADDITIVE only. NOT applied (GATE5). Numbered above 0004_store_counters (f13) and both 0003s (w3/w7/w8).
-- Partial index for the due-domain query: rows with the monitor off (next_scan_at NULL) are not in it, and the sort key
-- (next_scan_at, domain_id) matches ORDER BY so the cron's "longest overdue first" read is an index range scan, no sort.
CREATE INDEX IF NOT EXISTS idx_owner_state_due2 ON owner_state(next_scan_at, domain_id) WHERE next_scan_at IS NOT NULL;
-- Owner-seat rows are keyed (account_id, domain_id) in every account-scoped read; this covers anonymise and allFor.
CREATE INDEX IF NOT EXISTS idx_owner_state_acct_dom ON owner_state(account_id, domain_id);
