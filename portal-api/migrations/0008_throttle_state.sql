-- F206 shared throttle state for the C2 auth/checkout failure throttle (src/d1throttle.ts). ADDITIVE only. NOT applied (GATE5).
-- One row per hashed throttle key (scope:sha256-prefix, never a raw email or IP). Window count and lockout are advanced by ONE
-- INSERT ... ON CONFLICT DO UPDATE ... WHERE ... RETURNING statement, so concurrent isolates cannot read-then-write past N.
-- expires_at = last write + max(windowMs, lockoutMs): after it the row is semantically absent (window over, lock over), so the
-- sweep (DELETE WHERE expires_at <= now) never changes behaviour and rows stay bounded by keys touched in the last horizon.
-- Numbered 0008: the highest prefix on any pushed web/* branch is 0007 (0005..0007 are siblings still to merge).
CREATE TABLE IF NOT EXISTS throttle_state (
  key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  locked_until INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_throttle_expires ON throttle_state(expires_at);
