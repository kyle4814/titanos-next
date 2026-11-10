-- C8 f360: SSO start per-source fairness on D1. ADDITIVE and NOT applied anywhere (GATE5: applying to live D1 needs Kyle's card).
-- client_key is NULLABLE on purpose: rows written before this migration stay NULL, still count toward the tenant cap (COUNT by tenant_id),
-- and are never matched by the per-source eviction (client_key = ? never matches NULL). created_at orders same-source oldest-first eviction.
ALTER TABLE sso_states ADD COLUMN client_key TEXT;
ALTER TABLE sso_states ADD COLUMN created_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_sso_states_source ON sso_states(tenant_id, client_key, created_at);
