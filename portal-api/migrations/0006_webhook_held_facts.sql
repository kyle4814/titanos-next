-- F171: D1 side of the webhook order suite (f92). ADDITIVE only. Written, NOT APPLIED (applying to the live D1 is GATE5).
-- held_facts: an out-of-order webhook fact (an early refund, an early cancel, an early period) waiting for its payment.
-- seq keeps arrival order so takeFacts returns them exactly as MemoryStore does.
CREATE TABLE IF NOT EXISTS held_facts (seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, fact TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_held_facts_key ON held_facts (key);
CREATE INDEX IF NOT EXISTS idx_purchases_payment_intent ON purchases (payment_intent);
