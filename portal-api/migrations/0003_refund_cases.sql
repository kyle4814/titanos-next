-- C2 refund wire: refund_cases beside review_cards (kept in step by the service). ADDITIVE only. NOT applied (GATE5).
CREATE TABLE IF NOT EXISTS refund_cases (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, purchase_id TEXT NOT NULL, product_name TEXT NOT NULL, amount_cents INTEGER NOT NULL, reason TEXT NOT NULL, in_policy INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK (status IN ('pending_review','approved','denied')), created_at INTEGER NOT NULL, decided_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_refund_cases_purchase ON refund_cases (purchase_id);
