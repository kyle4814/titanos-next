// Signed-in API keys page (C7 follow-up, f23). Pure controller: no React, no "@/" imports, so portal-api/test can drive it
// against the real handler. It talks to the existing C2/F19 /keys API through the same `call` shape lib/portal.ts uses
// (browser: portal `call` over fetch; tests: the Worker handler behind a fetch adapter; preview: MemoryKeysCall).
//
// Secret handling: the one-time secret exists in `state.fresh` only, from create until dismiss() or the next action.
// It is never put in the key list, never written to storage, never logged, never rebuilt from the server (which has only a hash).

export type CallFn = (method: string, path: string, body?: Record<string, unknown>) => Promise<any>;
export interface KeyRow { id: string; prefix: string | null; scopes: string[]; createdAt: number; revoked: boolean; capDaily: number; capTotal: number; spentToday: number; spentTotal: number }
export interface FreshKey { id: string; secret: string; prefix: string; scopes: string[]; capDaily: number; capTotal: number }
export type Status = "idle" | "loading" | "ready" | "closed" | "signedout" | "error";
export interface KeysState { status: Status; keys: KeyRow[]; fresh: FreshKey | null; message: string }

// Mirrors portal-api/src/agent/tools.ts SCOPES (a test fails on drift).
export const SCOPE_LABELS: Record<string, string> = {
  "catalogue:read": "Read the catalogue and prices",
  "scan:read": "Run passive domain checks (uses credits)",
  "account:read": "Read my domains",
  "credits:read": "Read my credit balance",
  "explain:model": "Explain a finding (model-backed)",
  "receipt:verify": "Verify receipts",
};
export const SCOPE_IDS = Object.keys(SCOPE_LABELS);
// Mirrors the server defaults and limits in portal-api/src/agent/caps.ts (credits; 1 credit = AU$0.01, example rate).
export const CAP_DEFAULTS = { daily: 500, total: 2000 };
export const CAP_MAX = { daily: 100000, total: 1000000 };

export const KEYS_TEXT: Record<string, string> = {
  store_unavailable: "API keys are not open yet. Email {EMAIL} and we will set you up by hand.",
  unauthenticated: "Please sign in again.",
  key_limit: "You already have 10 active keys. Revoke one first.",
  invalid_capDaily: "The daily cap must be a whole number of credits from 0 to 100000.",
  invalid_capTotal: "The total cap must be a whole number of credits from 0 to 1000000.",
  no_caps: "Enter a cap to change.",
  not_found: "That key was not found.",
};
const FALLBACK = "Something went wrong. Try again or email {EMAIL}.";
export function keysErrorText(e: unknown, email: string): string {
  const code = (e as { code?: string })?.code;
  const t = typeof code === "string" ? KEYS_TEXT[code] ?? FALLBACK : "Could not reach the server. Try again or email {EMAIL}.";
  return t.replace("{EMAIL}", email);
}
// The store being down is the 503 store_unavailable answer, or a 404 from a host with no API behind it (lib/portal.ts maps that to the same code).
const isClosed = (e: unknown) => { const x = e as { status?: number; code?: string }; return x?.status === 503 || x?.code === "store_unavailable"; };
const isSignedOut = (e: unknown) => (e as { status?: number })?.status === 401;

const toRow = (k: any): KeyRow => ({
  id: String(k.id), prefix: typeof k.prefix === "string" ? k.prefix : null, scopes: Array.isArray(k.scopes) ? k.scopes.map(String) : [],
  createdAt: Number(k.createdAt) || 0, revoked: !!k.revoked, capDaily: Number(k.capDaily) || 0, capTotal: Number(k.capTotal) || 0,
  spentToday: Number(k.spentToday) || 0, spentTotal: Number(k.spentTotal) || 0,
});

export class KeysController {
  state: KeysState = { status: "idle", keys: [], fresh: null, message: "" };
  private subs = new Set<() => void>();
  private call: CallFn; private email: string; private signedIn: () => boolean;
  constructor(call: CallFn, email: string, signedIn: () => boolean) { this.call = call; this.email = email; this.signedIn = signedIn; }
  subscribe = (fn: () => void) => { this.subs.add(fn); return () => { this.subs.delete(fn); }; };
  getState = () => this.state;
  private set(p: Partial<KeysState>) { this.state = { ...this.state, ...p }; this.subs.forEach((f) => f()); }
  private fail(e: unknown) {
    if (isClosed(e)) return this.set({ status: "closed", keys: [], fresh: null, message: keysErrorText({ code: "store_unavailable" }, this.email) });
    if (isSignedOut(e)) return this.set({ status: "signedout", keys: [], fresh: null, message: "" });
    this.set({ message: keysErrorText(e, this.email), status: this.state.status === "loading" ? "error" : this.state.status });
  }

  async load(keepFresh = false) {
    if (!this.signedIn()) return this.set({ status: "signedout", keys: [], fresh: null, message: "" });
    this.set({ status: "loading", ...(keepFresh ? {} : { fresh: null }) });
    try { const r = await this.call("GET", "/keys"); this.set({ status: "ready", keys: (r.keys as any[]).map(toRow), message: "" }); }
    catch (e) { this.fail(e); }
  }
  dismissFresh() { this.set({ fresh: null }); }

  async create(scopes: string[], caps: { capDaily?: number; capTotal?: number } = {}) {
    if (this.state.status === "closed") return;
    const clean = scopes.filter((s) => SCOPE_IDS.includes(s));
    if (clean.length === 0) return this.set({ message: "Choose at least one permission for the key." });
    this.set({ fresh: null, message: "" });
    try {
      const r = await this.call("POST", "/keys", { scopes: clean, ...(caps.capDaily !== undefined ? { capDaily: caps.capDaily } : {}), ...(caps.capTotal !== undefined ? { capTotal: caps.capTotal } : {}) });
      this.set({ fresh: { id: r.id, secret: r.key, prefix: r.prefix, scopes: r.scopes, capDaily: r.capDaily, capTotal: r.capTotal }, message: "Key created. Copy it now: it is shown once." });
      await this.load(true); // list comes from the server and never carries the secret
    } catch (e) { this.fail(e); }
  }
  async revoke(id: string) {
    if (this.state.status === "closed") return;
    this.set({ message: "" });
    try {
      await this.call("DELETE", `/keys/${encodeURIComponent(id)}`);
      // UI state drops the access at once; the reload then confirms it from the server.
      this.set({ keys: this.state.keys.map((k) => (k.id === id ? { ...k, revoked: true } : k)), fresh: this.state.fresh?.id === id ? null : this.state.fresh, message: "Key revoked. It stops working now." });
      await this.load(true);
    } catch (e) { this.fail(e); }
  }
  async setCaps(id: string, caps: { capDaily?: number; capTotal?: number }) {
    if (this.state.status === "closed") return;
    this.set({ message: "" });
    try { await this.call("PATCH", `/keys/${encodeURIComponent(id)}`, caps); this.set({ message: "Caps saved." }); await this.load(true); }
    catch (e) { this.fail(e); }
  }
}

// Preview/test adapter: same contract as the Worker's /keys routes, in memory, synthetic. Not a security boundary.
export class MemoryKeysCall {
  rows: (KeyRow & { secret: string })[] = []; down = false; calls: string[] = [];
  private n = 0;
  call: CallFn = async (method, path, body) => {
    this.calls.push(`${method} ${path}`);
    if (this.down) throw Object.assign(new Error("store_unavailable"), { status: 503, code: "store_unavailable" });
    const id = path.split("/")[2];
    if (path === "/keys" && method === "GET") return { keys: this.rows.map(({ secret: _s, ...k }) => k) };
    if (path === "/keys" && method === "POST") {
      if (this.rows.filter((k) => !k.revoked).length >= 10) throw Object.assign(new Error("key_limit"), { status: 409, code: "key_limit" });
      const hex = (this.n++).toString(16).padStart(8, "0"); const secret = `tk_${hex}${"0".repeat(40)}`;
      const row = { id: `key_${this.n}`, prefix: `tk_${hex}`, scopes: (body?.scopes as string[]) ?? [], createdAt: 0, revoked: false, capDaily: (body?.capDaily as number) ?? CAP_DEFAULTS.daily, capTotal: (body?.capTotal as number) ?? CAP_DEFAULTS.total, spentToday: 0, spentTotal: 0, secret };
      this.rows.push(row); return { id: row.id, key: secret, prefix: row.prefix, scopes: row.scopes, capDaily: row.capDaily, capTotal: row.capTotal, note: "Shown once. Store it now." };
    }
    const row = this.rows.find((k) => k.id === id);
    if (!row) throw Object.assign(new Error("not_found"), { status: 404, code: "not_found" });
    if (method === "DELETE") { row.revoked = true; return { ok: true }; }
    if (method === "PATCH") { if (body?.capDaily !== undefined) row.capDaily = body.capDaily as number; if (body?.capTotal !== undefined) row.capTotal = body.capTotal as number; return row; }
    throw Object.assign(new Error("error"), { status: 400, code: "error" });
  };
}

