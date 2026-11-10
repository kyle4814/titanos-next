-- D1Store support (F13). ADDITIVE only. NOT applied (GATE5).
-- nextInvoiceNumber() needs a gap-free atomic counter; the invoices table alone cannot give one under concurrency.
CREATE TABLE IF NOT EXISTS invoice_seq (id INTEGER PRIMARY KEY CHECK (id = 1), n INTEGER NOT NULL);
