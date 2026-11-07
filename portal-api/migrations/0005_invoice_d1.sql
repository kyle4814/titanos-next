-- C2 (f192): invoices on D1. ADDITIVE only. NOT applied (GATE5).
-- purchase_id: which purchase an invoice belongs to (nullable: rows written before this carry none). One invoice per (purchase, Stripe event).
-- invoice_seq: gap-free atomic invoice number counter (same definition as web/f13 0004_store_counters; IF NOT EXISTS makes a merge of both safe).
-- (invoices.purchase_id is already added by 0003_enterprise on this line, as a plain nullable TEXT; no second ALTER here.)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_purchase_event ON invoices(purchase_id, stripe_event_id) WHERE purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_account ON invoices(account_id);
CREATE TABLE IF NOT EXISTS invoice_seq (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL);
