-- F48: abuse tracing by non-secret key prefix (first 8 chars of api_keys.id) and receipt key-id version.
-- ADDITIVE and idempotent. WRITTEN, NOT APPLIED (applying to the live D1 is GATE5).
CREATE INDEX IF NOT EXISTS api_keys_prefix ON api_keys(substr(id, 1, 8));
CREATE INDEX IF NOT EXISTS agent_receipts_key_at ON agent_receipts(key_id, at);
ALTER TABLE agent_receipts ADD COLUMN kid TEXT; -- receipt secret version; NULL = signed before F48
