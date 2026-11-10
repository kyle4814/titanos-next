// Browser client for the portal API (checkout, login, billing). Pure functions take fetch and storage as arguments so
// scripts/test_portal_checkout.mjs can run them without a browser.
import { PORTAL, SITE } from "@/lib/config";

export type Json = Record<string, unknown>;
export interface Api { fetchFn: typeof fetch; base: string; storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> }
export const browserApi = (): Api => ({ fetchFn: (...a) => fetch(...a), base: PORTAL.API_BASE, storage: window.localStorage });

export class ApiError extends Error {
  status: number; code: string; body: Json | null;
  constructor(status: number, code: string, body: Json | null = null) { super(code); this.status = status; this.code = code; this.body = body; }
}
// {EMAIL} is replaced with the site contact address at render time.
export const ERROR_TEXT: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  too_many_requests: "Too many login links requested. Try again in an hour.",
  token_invalid_or_used: "That login link has expired or was already used. Request a new one.",
  invalid_domain: "Enter a domain like yourbusiness.com.au.",
  txt_record_not_found: "We could not see the TXT record yet. DNS can take a few minutes. Try again shortly.",
  dns_lookup_failed: "The DNS lookup failed. Try again in a minute.",
  domain_already_verified_by_another_account: "That domain is already verified by another account. Email {EMAIL} and we will sort it out.",
  verified_domain_required: "Verify the domain first. It proves the site is yours before we monitor or assess it.",
  store_unavailable: "Online checkout is not open yet. Email {EMAIL} and we will set you up by hand.",
  not_found: "Not found.",
  unauthenticated: "Please sign in again.",
};
export function errorText(e: unknown): string {
  const t = e instanceof ApiError ? ERROR_TEXT[e.code] ?? "Something went wrong. Try again or email {EMAIL}." : "Could not reach the server. Try again or email {EMAIL}.";
  return t.replace("{EMAIL}", SITE.KYLE_EMAIL);
}

export async function call(api: Api, method: string, path: string, body?: Json, auth = true): Promise<any> {
  const headers: Record<string, string> = {};
  if (body) headers["content-type"] = "application/json";
  const s = api.storage.getItem(PORTAL.SESSION_KEY);
  if (auth && s) headers.authorization = `Bearer ${s}`;
  const r = await api.fetchFn(api.base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let j: any = null; try { j = text ? JSON.parse(text) : null; } catch { /* plain text body (invoice) */ }
  if (!r.ok) throw new ApiError(r.status, j?.error ?? (r.status === 404 ? "store_unavailable" : "error"), j && typeof j === "object" ? j : null);
  return j ?? text;
}
export const requestLogin = (api: Api, email: string) => call(api, "POST", "/auth/request", { email }, false);
export async function completeLogin(api: Api, token: string) {
  const r = await call(api, "POST", "/auth/verify", { token }, false);
  api.storage.setItem(PORTAL.SESSION_KEY, r.session);
  return r.account as { id: string; email: string; seat: string };
}
export const signedIn = (api: Api) => !!api.storage.getItem(PORTAL.SESSION_KEY);
export const signOut = (api: Api) => api.storage.removeItem(PORTAL.SESSION_KEY);
export const addDomain = (api: Api, domain: string) => call(api, "POST", "/domains", { domain });
export const verifyDomain = (api: Api, id: string) => call(api, "POST", `/domains/${id}/verify`);
export const startCheckout = (api: Api, product: string, domain?: string) => call(api, "POST", "/checkout", { product, domain });
export const loginTokenFromHash = (hash: string) => hash.match(/token=(ll_[0-9a-f]+)/)?.[1] ?? null;
