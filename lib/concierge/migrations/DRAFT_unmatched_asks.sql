-- DRAFT ONLY. NOT APPLIED. Applying it to any D1 database is GATE5 (see the f67 receipt, CARD NEEDED).
-- Number it after the highest migration on the branch that ships the portal (0007 or later) when it is merged.
-- No visitor identifier, no IP, no user agent, no session, no raw ask: those columns do not exist, on purpose.
CREATE TABLE IF NOT EXISTS unmatched_asks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,   -- insertion order; eviction is oldest id first
  day        TEXT    NOT NULL CHECK (day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  seat       TEXT    NOT NULL CHECK (seat IN ('guest','owner','pro','agent','enterprise','partner')),
  normalised TEXT    NOT NULL CHECK (length(normalised) BETWEEN 1 AND 200),
  count      INTEGER NOT NULL DEFAULT 1 CHECK (count >= 1),
  UNIQUE (day, seat, normalised)
);
