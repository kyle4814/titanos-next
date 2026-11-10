// C5 DemandReport (plan ch.6 C5, line 1497: "unmatched asks go to the generator"). Pure, code-only: no model call, no network,
// no clock, no random, no file or env access. Input: unmatched-ask records from ANY UnmatchedLog adapter (MemoryLog rows, the D1 adapter).
// Output: the top N proposed shelf stubs. A stub is status UNGRADED_PROPOSAL and has no shelf shape, so it can never reach the
// shelf renderer or the sitemap; the only door to a live shelf stays lib/shop/grader.ts (gradeAll + visibleShelves).
import { tokens } from "./text.ts";
import { OFFTOPIC_CUES } from "./offtopic.ts";

// An UnmatchedLog row (ConfigStub) plus an optional asker id. Missing id = one shared "anon" bucket (conservative: anon spam counts once).
export type AskRecord = { ask: string; askerId?: string | null; seat?: string; seenAt?: string | null };   // seenAt: caller-supplied ISO-8601 (this module reads no clock)
export type ShelfStub = {
  cluster_id: string; label: string; ask_count: number; distinct_askers: number;
  sample_asks: string[]; status: "UNGRADED_PROPOSAL"; first_seen: string | null; last_seen: string | null;
};
export type DemandOpts = { topN?: number; minAskers?: number; jac?: number; offTopic?: (toks: string[]) => boolean };

export const CLUSTER_JAC = 0.6;   // near-duplicate threshold on the token sets from text.ts (same Jaccard measure as f80 askguard.ts)
const SAMPLE_MAX = 3, SAMPLE_LEN = 160;
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g;
const URL_ = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|au|co|app|dev|tech|info|biz|us|uk|nz)\b(?:\/\S*)?/gi;
const PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/g;

export function stripPii(text: string): string {
  return String(text ?? "").replace(EMAIL, " ").replace(URL_, " ").replace(PHONE, " ").replace(/\s+/g, " ").trim();
}

const jaccard = (a: Set<string>, b: Set<string>) => { let i = 0; for (const t of a) if (b.has(t)) i++; return i / (a.size + b.size - i || 1); };
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function fnv1a(s: string): string { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
const defaultOffTopic = (toks: string[]) => toks.some((t) => OFFTOPIC_CUES.has(t));

type Item = { clean: string; key: string; set: Set<string>; toks: string[]; asker: string; seen: string | null };
type Cluster = { rep: Item; items: Item[] };

export function demandReport(records: AskRecord[], opts: DemandOpts = {}): ShelfStub[] {
  const topN = opts.topN ?? 10, minAskers = opts.minAskers ?? 1, jac = opts.jac ?? CLUSTER_JAC, off = opts.offTopic ?? defaultOffTopic;
  const items: Item[] = [];
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r.ask !== "string") continue;
    const clean = stripPii(r.ask);
    const toks = tokens(clean);
    if (!toks.length) continue;
    const uniq = [...new Set(toks)].sort(cmp);
    items.push({ clean, key: uniq.join(" "), set: new Set(uniq), toks: uniq, asker: r.askerId ? String(r.askerId) : "anon", seen: typeof r.seenAt === "string" && r.seenAt ? r.seenAt : null });
  }
  // Input order must not matter: sort by key, then asker, then text, before the greedy pass.
  items.sort((a, b) => cmp(a.key, b.key) || cmp(a.asker, b.asker) || cmp(a.clean, b.clean));
  const clusters: Cluster[] = [];
  for (const it of items) {
    const home = clusters.find((c) => jaccard(c.rep.set, it.set) >= jac);
    if (home) home.items.push(it); else clusters.push({ rep: it, items: [it] });
  }
  const stubs: ShelfStub[] = [];
  for (const c of clusters) {
    if (c.items.some((i) => off(i.toks))) continue;   // f66 guard: any off-topic member sinks the cluster
    const askers = new Set(c.items.map((i) => i.asker));
    if (askers.size < minAskers) continue;
    const samples = [...new Set(c.items.map((i) => i.clean.slice(0, SAMPLE_LEN)))].sort((a, b) => a.length - b.length || cmp(a, b)).slice(0, SAMPLE_MAX);
    const seen = c.items.map((i) => i.seen).filter((x): x is string => !!x).sort();
    stubs.push({ cluster_id: "dc-" + fnv1a(c.rep.key), label: c.rep.key, ask_count: c.items.length, distinct_askers: askers.size, sample_asks: samples, status: "UNGRADED_PROPOSAL", first_seen: seen[0] ?? null, last_seen: seen[seen.length - 1] ?? null });
  }
  stubs.sort((a, b) => b.distinct_askers - a.distinct_askers || b.ask_count - a.ask_count || cmp(a.label, b.label) || cmp(a.cluster_id, b.cluster_id));
  return stubs.slice(0, Math.max(0, topN));
}
