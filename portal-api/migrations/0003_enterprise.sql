-- C8: tenants, members, estate assets, SSO, partner ledger and payouts. ADDITIVE only. NOT applied (GATE5).
-- Isolation rule for the D1 adapter: every query on a tenant-owned table carries tenant_id in its WHERE clause.
-- sso_configs.secret must be encrypted with a Worker secret before it is stored (the mock stores it in memory only).
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('enterprise','partner','client')),
  parent_id TEXT REFERENCES tenants(id), created_at INTEGER NOT NULL, deleted_at INTEGER,
  sso_enforced INTEGER NOT NULL DEFAULT 0, partner_access INTEGER NOT NULL DEFAULT 0,
  brand_name TEXT, brand_colour TEXT, brand_tagline TEXT, ref_code TEXT UNIQUE, terms_accepted_at INTEGER, payout_account TEXT
);
CREATE INDEX IF NOT EXISTS idx_tenants_parent ON tenants(parent_id);
CREATE TABLE IF NOT EXISTS tenant_members (tenant_id TEXT NOT NULL REFERENCES tenants(id), account_id TEXT NOT NULL REFERENCES accounts(id), role TEXT NOT NULL CHECK (role IN ('viewer','analyst','admin')), added_at INTEGER NOT NULL, PRIMARY KEY (tenant_id, account_id));
CREATE INDEX IF NOT EXISTS idx_members_account ON tenant_members(account_id);
CREATE TABLE IF NOT EXISTS tenant_invites (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), email TEXT NOT NULL, role TEXT NOT NULL, invited_by TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_invites_email ON tenant_invites(email);
CREATE TABLE IF NOT EXISTS tenant_assets (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), domain TEXT NOT NULL, label TEXT NOT NULL, grp TEXT NOT NULL, token TEXT NOT NULL, verified_at INTEGER, UNIQUE (tenant_id, domain));
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_verified_domain ON tenant_assets(domain) WHERE verified_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS sso_configs (tenant_id TEXT PRIMARY KEY REFERENCES tenants(id), issuer TEXT NOT NULL, client_id TEXT NOT NULL, secret_enc TEXT NOT NULL, allowed_domains TEXT NOT NULL, default_role TEXT NOT NULL, last_success_at INTEGER);
CREATE TABLE IF NOT EXISTS sso_states (hash TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), nonce_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sso_sessions (session_hash TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES tenants(id), PRIMARY KEY (session_hash, tenant_id));
CREATE TABLE IF NOT EXISTS tenant_audit (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON tenant_audit(tenant_id, at);
CREATE TABLE IF NOT EXISTS partner_ledger (
  id TEXT PRIMARY KEY, uniq TEXT NOT NULL, partner_id TEXT NOT NULL REFERENCES tenants(id), kind TEXT NOT NULL CHECK (kind IN ('commission','clawback','payout','payout_reversal')),
  amount_cents INTEGER NOT NULL, at INTEGER NOT NULL, available_at INTEGER NOT NULL, invoice_id TEXT, source_key TEXT, source_label TEXT, rate_bps INTEGER, rate_version TEXT, payout_id TEXT,
  UNIQUE (partner_id, uniq)
);
CREATE TABLE IF NOT EXISTS referrals (account_id TEXT PRIMARY KEY REFERENCES accounts(id), partner_id TEXT NOT NULL REFERENCES tenants(id), claimed_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payouts (id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES tenants(id), amount_cents INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending_approval','paid','failed','rejected')), created_at INTEGER NOT NULL, provider_ref TEXT, reason TEXT);
CREATE TABLE IF NOT EXISTS ent_failures (id INTEGER PRIMARY KEY AUTOINCREMENT, where_ TEXT NOT NULL, detail TEXT NOT NULL, at INTEGER NOT NULL);
ALTER TABLE invoices ADD COLUMN purchase_id TEXT REFERENCES purchases(id); -- f245: carries the FK that f192 0005 used to add (its duplicate ALTER is stripped on this merged line)
