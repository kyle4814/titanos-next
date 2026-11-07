-- C2 invoice wire (f285): when a refund was recorded, so a credit note can be dated. NULL until a refund exists.
-- Additive and nullable: safe on a live table, no backfill (refunds before this migration have no recorded date; the credit note route 404s for them).
ALTER TABLE purchases ADD COLUMN refunded_at INTEGER;
