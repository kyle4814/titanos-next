-- f378: pro seat entitlement records (src/market/d1seats.ts). ADDITIVE only. NOT applied to live D1 (GATE5).
-- One row per account, the shape of SeatSubscription in src/market/entitlements.ts. The claim-fee discount is decided from this row
-- server-side; nothing a client sends is stored here. paid_through_ms is the end of the last period actually paid for.
-- Written by the (not yet built) Stripe-webhook feed; the discount read is a single indexed primary-key lookup.
CREATE TABLE IF NOT EXISTS seat_subscriptions (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  status TEXT NOT NULL CHECK (status IN ('active','past_due','cancelled')),
  paid_through_ms INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
