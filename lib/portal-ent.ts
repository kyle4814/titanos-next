// Browser client for the enterprise and partner seats (C8). Pure functions take the Api (fetch + storage) so
// scripts/test_portal_enterprise.mjs can run them without a browser. Preview: not linked from the nav, noindex.
import { ERROR_TEXT, call, type Api, type Json } from "@/lib/portal";
import { PORTAL } from "@/lib/config";

Object.assign(ERROR_TEXT, {
  forbidden: "Your role does not allow that. Ask a tenant admin.",
  sso_required: "This organisation requires single sign-on. Use the SSO button.",
  sso_failed: "Single sign-on did not complete. Start again from the SSO button.",
  sso_email_domain_not_allowed: "That email address is not on a domain this organisation has verified for SSO.",
  allowed_domain_not_verified: "Verify the domain as an asset first. SSO only accepts email domains you have proven you own.",
  sso_not_proven: "Sign in once with SSO before you require it, so you cannot lock yourself out.",
  sign_in_with_sso_first: "Sign in with SSO yourself before you require it.",
  last_admin: "A tenant needs at least one admin.",
  partner_terms_not_accepted: "The partner terms are not signed off yet. Email {EMAIL} to finish setup.",
  payout_account_missing: "No payout account is set yet. Email {EMAIL} and we will set it up.",
  below_minimum: "Nothing is available to pay out yet. Commission is held for 30 days.",
  self_referral: "You cannot refer yourself.",
  referral_after_purchase: "A referral code only applies before a first purchase.",
  already_referred: "A referral code is already attached to this account.",
  unknown_code: "That referral code is not valid.",
  slug_taken: "That address is taken. Choose another.",
  invalid_brand: "Brand name and tagline must be plain text and the colour a hex value like #1a2b3c.",
});

export type Tenant = { id: string; slug: string; name: string; kind: "enterprise" | "partner" | "client"; role: "viewer" | "analyst" | "admin"; brand?: { name: string; colour: string; tagline: string }; refCode?: string };
export const myTenants = (api: Api): Promise<{ tenants: Tenant[] }> => call(api, "GET", "/tenants");
export const estate = (api: Api, tid: string) => call(api, "GET", `/enterprise/${tid}/estate`);
export const assets = (api: Api, tid: string) => call(api, "GET", `/enterprise/${tid}/assets`);
export const addAsset = (api: Api, tid: string, domain: string, label?: string) => call(api, "POST", `/enterprise/${tid}/assets`, { domain, label: label || undefined });
export const verifyAsset = (api: Api, tid: string, aid: string) => call(api, "POST", `/enterprise/${tid}/assets/${aid}/verify`);
export const members = (api: Api, tid: string) => call(api, "GET", `/enterprise/${tid}/members`);
export const invite = (api: Api, tid: string, email: string, role: string) => call(api, "POST", `/enterprise/${tid}/members`, { email, role });
export const myInvites = (api: Api) => call(api, "GET", "/invites");
export const acceptInvite = (api: Api, id: string) => call(api, "POST", `/invites/${id}/accept`);
export const ssoConfig = (api: Api, tid: string) => call(api, "GET", `/enterprise/${tid}/sso`);
export const setPartnerAccess = (api: Api, tid: string, enabled: boolean) => call(api, "POST", `/enterprise/${tid}/partner-access`, { enabled });
export const portals = (api: Api, pid: string) => call(api, "GET", `/partners/${pid}/portals`);
export const createPortal = (api: Api, pid: string, b: Json) => call(api, "POST", `/partners/${pid}/portals`, b);
export const portalEstate = (api: Api, pid: string, cid: string) => call(api, "GET", `/partners/${pid}/portals/${cid}/estate`);
export const ledger = (api: Api, pid: string) => call(api, "GET", `/partners/${pid}/ledger`);
export const requestPayout = (api: Api, pid: string) => call(api, "POST", `/partners/${pid}/payouts`);
export const claimReferral = (api: Api, code: string) => call(api, "POST", "/referrals/claim", { code });

// SSO: start stores the state and nonce for this browser only, then the IdP sends the id_token back in the URL hash.
const SSO_KEY = "titanos_sso_pending";
export async function startSso(api: Api, slug: string, session: Pick<Storage, "setItem">): Promise<string> {
  const r = await call(api, "POST", `/sso/${encodeURIComponent(slug)}/start`, {}, false);
  session.setItem(SSO_KEY, JSON.stringify({ state: r.state, nonce: r.nonce }));
  return r.authorizeUrl as string;
}
export function ssoParamsFromHash(hash: string): { state: string; id_token: string } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const state = p.get("state"), id_token = p.get("id_token");
  return state && id_token ? { state, id_token } : null;
}
export async function finishSso(api: Api, hash: string, session: Pick<Storage, "getItem" | "removeItem">) {
  const h = ssoParamsFromHash(hash), raw = session.getItem(SSO_KEY);
  if (!h || !raw) return null;
  const pending = JSON.parse(raw) as { state: string; nonce: string };
  session.removeItem(SSO_KEY);
  if (pending.state !== h.state) return null;   // a token for someone else's login attempt is ignored
  const r = await call(api, "POST", "/sso/callback", { state: h.state, nonce: pending.nonce, id_token: h.id_token }, false);
  api.storage.setItem(PORTAL.SESSION_KEY, r.session);
  return r as { session: string; tenantId: string };
}
export const aud = (cents: number) => `AU$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
