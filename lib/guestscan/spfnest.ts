// F35 nested SPF lookup walk (RFC 7208 section 4.6.4: at most 10 DNS-querying terms per check,
// counted across the whole include/redirect tree, and at most 2 "void" lookups).
// Pure TypeScript, injected resolver, ZERO live DNS in tests, ZERO model calls.
//
// The count is the WORST CASE (every term evaluated). A real check can stop early on a match, so
// OVER_LIMIT means "a receiver that evaluates the whole record would hit permerror".
// Rule kept from SpoofGuard: a failed read is UNKNOWN with a reason, never a guess.
import { isSpfRecord, spfInfo } from "./scan.ts";
import type { DohFetch } from "./scan.ts";

export type SpfNestState = "WITHIN_LIMIT" | "OVER_LIMIT" | "UNKNOWN";
export type SpfLookupType = "TXT" | "A" | "MX";
export interface SpfLookupResult { status: "ok" | "void" | "error"; records?: string[] }
// The only seam. status "void" = NXDOMAIN or NOERROR with no data; "error" = SERVFAIL, timeout, etc.
export type SpfResolver = (type: SpfLookupType, name: string) => Promise<SpfLookupResult>;

export interface SpfNestOptions { limit?: number; maxDepth?: number; maxResolverCalls?: number }
export interface SpfNestResult {
  state: SpfNestState;
  lookups: number; // DNS-querying terms counted across the tree (lower bound when UNKNOWN or stopped early)
  voidLookups: number;
  voidOver: boolean; // more than 2 void lookups (RFC 7208 4.6.4 SHOULD permerror)
  resolverCalls: number;
  maxDepthSeen: number;
  cycle: boolean;
  reasons: string[]; // why UNKNOWN, or what pushed OVER_LIMIT; empty on a clean WITHIN_LIMIT
}

export const SPF_NEST_DEFAULTS = { limit: 10, maxDepth: 10, maxResolverCalls: 40 } as const;
const MACRO = /%[{%_-]/;

class Stop extends Error {}

export async function spfNestedLookups(domain: string, resolve: SpfResolver, opts: SpfNestOptions = {}): Promise<SpfNestResult> {
  const limit = opts.limit ?? SPF_NEST_DEFAULTS.limit;
  const maxDepth = opts.maxDepth ?? SPF_NEST_DEFAULTS.maxDepth;
  const budget = opts.maxResolverCalls ?? SPF_NEST_DEFAULTS.maxResolverCalls;
  const r: SpfNestResult = { state: "WITHIN_LIMIT", lookups: 0, voidLookups: 0, voidOver: false, resolverCalls: 0, maxDepthSeen: 0, cycle: false, reasons: [] };
  let unknown = false;
  const unk = (why: string) => { unknown = true; if (!r.reasons.includes(why)) r.reasons.push(why); };

  const call = async (type: SpfLookupType, name: string): Promise<SpfLookupResult | undefined> => {
    if (r.resolverCalls >= budget) { unk(`resolver call budget of ${budget} reached before ${type} ${name}`); throw new Stop(); }
    r.resolverCalls++;
    try {
      const x = await resolve(type, name);
      if (!x || (x.status !== "ok" && x.status !== "void" && x.status !== "error")) { unk(`unreadable resolver answer for ${type} ${name}`); return undefined; }
      if (x.status === "error") { unk(`lookup failed for ${type} ${name}`); return undefined; }
      return x;
    } catch { unk(`lookup failed for ${type} ${name}`); return undefined; }
  };
  const count = () => {
    r.lookups++;
    if (r.lookups > limit) { r.reasons.push(`${r.lookups} DNS-querying terms counted, over the limit of ${limit}`); throw new Stop(); }
  };
  const voided = () => { r.voidLookups++; if (r.voidLookups > 2) r.voidOver = true; };

  const walk = async (name: string, depth: number, path: string[]): Promise<void> => {
    r.maxDepthSeen = Math.max(r.maxDepthSeen, depth);
    const t = await call("TXT", name);
    if (!t) return;
    const spf = (t.records ?? []).filter(isSpfRecord);
    if (t.status === "void" || spf.length === 0) { voided(); r.reasons.push(`no SPF record at ${name}`); return; }
    if (spf.length > 1) { r.reasons.push(`multiple SPF records at ${name}`); return; }
    for (const term of spfInfo(spf[0]).terms) {
      const m = term.toLowerCase().replace(/^[+\-~?]/, "");
      const isInc = m.startsWith("include:"), isRed = m.startsWith("redirect=");
      const isA = m === "a" || m.startsWith("a:") || m.startsWith("a/");
      const isMx = m === "mx" || m.startsWith("mx:") || m.startsWith("mx/");
      const isEx = m.startsWith("exists:"), isPtr = m === "ptr" || m.startsWith("ptr:");
      if (!(isInc || isRed || isA || isMx || isEx || isPtr)) continue;
      count();
      const arg = isInc ? m.slice(8) : isRed ? m.slice(9) : isEx ? m.slice(7) : m.includes(":") ? m.slice(m.indexOf(":") + 1).replace(/\/.*$/, "") : name;
      if (isPtr) continue; // counted, deprecated, no void semantics worth a query
      if (MACRO.test(arg)) { unk(`macro in ${m.split(/[:=]/)[0]} target at ${name} cannot be resolved without a sender`); continue; }
      if (isInc || isRed) {
        const key = arg.replace(/\.$/, "");
        if (depth + 1 > maxDepth) { unk(`depth cap of ${maxDepth} reached at ${key}`); continue; }
        if (path.includes(key)) { r.cycle = true; r.reasons.push(`include cycle through ${key}`); throw new Stop(); }
        await walk(key, depth + 1, [...path, key]);
      } else {
        const x = await call(isMx ? "MX" : "A", arg.replace(/\.$/, ""));
        if (x && x.status === "void") voided();
      }
    }
  };

  const root = domain.trim().toLowerCase().replace(/\.$/, "");
  try { await walk(root, 0, [root]); } catch (e) { if (!(e instanceof Stop)) throw e; }
  // A cycle evaluates forever, so receivers hit the limit: that is OVER_LIMIT, known.
  if (r.lookups > limit || r.cycle) r.state = "OVER_LIMIT";
  else if (unknown) r.state = "UNKNOWN";
  else r.state = "WITHIN_LIMIT";
  if (r.voidOver) r.reasons.push(`${r.voidLookups} void lookups, over the RFC 7208 limit of 2`);
  return r;
}

// Adapter: the browser/live resolver over the existing DoH seam. Not used by tests against real DNS.
export function dohSpfResolver(f: DohFetch): SpfResolver {
  return async (type, name) => {
    let d;
    try { d = await f(name, type); } catch { return { status: "error" }; }
    if (!d || typeof d !== "object") return { status: "error" };
    if (d.Status !== undefined && d.Status !== 0 && d.Status !== 3) return { status: "error" };
    const want = type === "TXT" ? 16 : type === "A" ? 1 : 15;
    const ans = (d.Answer ?? []).filter((a) => a.type === undefined || a.type === want);
    if (d.Status === 3 || ans.length === 0) return { status: "void" };
    return { status: "ok", records: ans.map((a) => String(a.data ?? "").replace(/" "/g, "").replace(/^"|"$/g, "").trim()).filter(Boolean) };
  };
}
