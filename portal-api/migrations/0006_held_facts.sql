-- C2 (f194): held webhook facts on D1 (cancel, Stripe period, refund waiting for their payment). ADDITIVE only. NOT applied (GATE5).
-- seq is the hold order (AUTOINCREMENT: never reused, so a taken row's number never comes back). takeFacts is ONE statement,
-- DELETE ... RETURNING, so two concurrent takers cannot both receive a row. No FK: a fact is held precisely because its purchase/subscription has not arrived yet.
CREATE TABLE IF NOT EXISTS held_facts (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_key TEXT NOT NULL,
  fact_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS held_facts_key ON held_facts(fact_key, seq);
