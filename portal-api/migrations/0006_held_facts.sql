-- C2 (f194): held webhook facts on D1 (cancel, Stripe period, refund waiting for their payment). ADDITIVE only. NOT applied (GATE5).
-- The table and index DDL below is BYTE-IDENTICAL to web/f171 0006_webhook_held_facts.sql (same names, same columns), so merging both stacks is safe (IF NOT EXISTS).
-- seq is the hold order (AUTOINCREMENT: never reused). takeFacts is ONE statement, DELETE ... RETURNING, so two concurrent takers cannot both receive a row.
-- No FK: a fact is held precisely because its purchase/subscription has not arrived yet.
CREATE TABLE IF NOT EXISTS held_facts (seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL, fact TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_held_facts_key ON held_facts (key);
