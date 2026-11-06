// C8 Enterprise and partner: tenancy types. A tenant is the isolation boundary. Every tenant-scoped read in the
// store takes the tenant id, so a guessed id from another tenant returns nothing (isolation by construction),
// and every route checks membership before it touches anything.
export type TenantKind = "enterprise" | "partner" | "client";
export type Role = "viewer" | "analyst" | "admin";
export const ROLE_RANK: Record<Role, number> = { viewer: 1, analyst: 2, admin: 3 };
export const ROLES = Object.keys(ROLE_RANK) as Role[];

export interface Brand { name: string; colour: string; tagline: string }
export interface Tenant {
  id: string; slug: string; name: string; kind: TenantKind; parentId?: string; createdAt: number; deletedAt?: number;
  ssoEnforced: boolean; partnerAccess: boolean;   // partnerAccess: a client tenant consents to its partner reading its estate
  brand?: Brand; brandPublic?: boolean;          // a client portal brand is served publicly only after its partner publishes it
  refCode?: string;                               // partners only: the referral code
  termsAcceptedAt?: number;                       // partners only: set by the operator after the partner terms are signed (GATE3)
  payoutAccount?: string;                         // partners only: opaque payout-provider reference, never returned to a client
}
export interface Member { tenantId: string; accountId: string; role: Role; addedAt: number }
export interface Invite { id: string; tenantId: string; email: string; role: Role; invitedBy: string; createdAt: number; expiresAt: number }
export interface Asset { id: string; tenantId: string; domain: string; label: string; group: string; token: string; verifiedAt?: number }
export interface SsoConfig { tenantId: string; issuer: string; clientId: string; secret: string; allowedDomains: string[]; defaultRole: Exclude<Role, "admin">; lastSuccessAt?: number }
export interface SsoState { hash: string; tenantId: string; clientKey: string; nonceHash: string; expiresAt: number; used: boolean }
export interface AuditEntry { id: string; tenantId: string; actor: string; action: string; target: string; at: number }

export type LedgerKind = "commission" | "clawback" | "payout" | "payout_reversal";
export interface LedgerEntry {
  id: string; uniq: string; partnerId: string; kind: LedgerKind; amountCents: number; at: number; availableAt: number;
  invoiceId?: string; sourceKey?: string; sourceLabel?: string; rateBps?: number; rateVersion?: string; payoutId?: string;
}
export interface Referral { accountId: string; partnerId: string; claimedAt: number }
export type PayoutStatus = "pending_approval" | "sending" | "paid" | "failed" | "rejected" | "approved_retry" | "held";
export interface Payout { id: string; partnerId: string; amountCents: number; status: PayoutStatus; createdAt: number; providerRef?: string; reason?: string; sendingAt?: number }

export interface RateTable { version: string; baseBps: number; tiers: { minActive: number; bps: number }[] }
export interface PayoutProvider { transfer(p: { partnerId: string; accountRef: string; amountCents: number; idempotencyKey: string }): Promise<{ ref: string }> }
export interface IdpClaims { iss: string; aud: string; sub: string; email: string; email_verified: boolean; nonce: string; exp: number; iat: number }
export interface IdpVerifier { verify(cfg: SsoConfig, idToken: string, nowMs: number): Promise<IdpClaims> }
export interface ScanFinding { id: string; severity: "critical" | "high" | "medium" | "low"; title: string }
export interface ScanProvider { source: string; scan(domain: string): Promise<ScanFinding[]> }
