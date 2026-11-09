-- f313 C8: indexes for the partner book (BookFactsSource, D1BookFacts + the partner-scoped referral lookup). ADDITIVE only. NOT APPLIED (GATE5).
-- Numbering: 0018 is the highest on obelisk-int3 (f303 generator queue drain). No new table, no column, no data.
CREATE INDEX IF NOT EXISTS idx_referrals_partner ON referrals(partner_id);          -- referralsOfPartner: WHERE partner_id = ?
CREATE INDEX IF NOT EXISTS idx_subscriptions_account ON subscriptions(account_id);  -- plan and status per account
CREATE INDEX IF NOT EXISTS idx_purchases_account ON purchases(account_id);
CREATE INDEX IF NOT EXISTS idx_domains_account ON domains(account_id);
