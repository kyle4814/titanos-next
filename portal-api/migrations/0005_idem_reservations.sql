-- F17: idempotency reservation for the agent door. ADDITIVE only. Written, NOT applied (applying to the live D1 is GATE5).
-- One row per (api key, Idempotency-Key): inserted BEFORE the debit so two concurrent calls with the same key cannot both debit.
-- rid = the receipt id / ledger ref this call will use (kept across a takeover so a crashed owner's debit is found, not repeated).
-- expires_at = epoch ms; a claim past it may be taken over (crash recovery). Rows are deleted on a failed call (retryable).
CREATE TABLE IF NOT EXISTS idem_reservations (
  key_id TEXT NOT NULL REFERENCES api_keys(id), idem TEXT NOT NULL, rid TEXT NOT NULL, owner TEXT NOT NULL, expires_at INTEGER NOT NULL,
  PRIMARY KEY (key_id, idem)
);
