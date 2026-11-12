-- Own booking system (2026-11-12): a visitor books a 20 minute call with Kyle through POST /api/book.
-- slot_start is epoch milliseconds (UTC) of the slot start. The partial unique index is what refuses a double booking:
-- two concurrent inserts for the same slot cannot both succeed, whatever the application code does first.
-- A cancelled row (status 'cancelled') frees its slot. notified_at is set once the Telegram alert to Kyle went out.
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  slot_start INTEGER NOT NULL,
  slot_end INTEGER NOT NULL,
  name TEXT NOT NULL,
  business TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  eats_week TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at INTEGER NOT NULL,
  notified_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_slot_confirmed ON bookings(slot_start) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_bookings_created ON bookings(created_at);
