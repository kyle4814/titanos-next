// Read-only digest of the unmatched log: clusters near-identical asks and emits generator config stubs
// (quote null, status LOGGED_FOR_GENERATOR). Pure and deterministic: the same entries in ANY order give the same bytes.
// It takes entries (already read) and never touches a store, so it cannot write.
import { tokens } from "./text.ts";
import type { ConfigStub, Seat } from "./types.ts";
import type { LogEntry } from "./unmatched.ts";

export const JACCARD = 0.6;   // token-set overlap that counts as near-identical
export type GeneratorStub = ConfigStub & { id: string; count: number; variants: number; firstDay: string; lastDay: string };

const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };
const jac = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u === 0 ? 0 : i / u; };
// Token key: first 5 characters, so the router's stemmer quirks (website / websit) cannot split one ask in two.
const key = (t: string) => t.slice(0, 5);
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function digest(entries: LogEntry[], threshold = JACCARD): GeneratorStub[] {
  // Merge the same line across days first, so ordering of days cannot matter.
  const merged = new Map<string, { seat: Seat; line: string; count: number; first: string; last: string }>();
  for (const e of entries) {
    const k = e.seat + "\u0000" + e.normalised;
    const m = merged.get(k);
    if (m) { m.count += e.count; if (e.day < m.first) m.first = e.day; if (e.day > m.last) m.last = e.day; }
    else merged.set(k, { seat: e.seat, line: e.normalised, count: e.count, first: e.day, last: e.day });
  }
  const rows = [...merged.values()].sort((a, b) => b.count - a.count || cmp(a.seat, b.seat) || cmp(a.line, b.line));
  type Cl = { rep: typeof rows[number]; set: Set<string>; count: number; variants: number; first: string; last: string };
  const clusters: Cl[] = [];
  for (const r of rows) {
    const set = new Set(tokens(r.line).map(key));
    if (set.size === 0) continue;
    const home = clusters.find((c) => c.rep.seat === r.seat && jac(c.set, set) >= threshold);   // clusters stay inside a seat
    if (home) { home.count += r.count; home.variants++; if (r.first < home.first) home.first = r.first; if (r.last > home.last) home.last = r.last; }
    else clusters.push({ rep: r, set, count: r.count, variants: 1, first: r.first, last: r.last });
  }
  return clusters
    .sort((a, b) => b.count - a.count || cmp(a.rep.seat, b.rep.seat) || cmp(a.rep.line, b.rep.line))
    .map((c) => ({ id: "ug-" + fnv(c.rep.seat + "|" + c.rep.line), ask: c.rep.line, normalised: c.rep.line, seat: c.rep.seat, status: "LOGGED_FOR_GENERATOR" as const, quote: null, count: c.count, variants: c.variants, firstDay: c.first, lastDay: c.last }));
}
