// C6 concierge router. Code-only, seat-aware, 0 model calls: no fetch, no model SDK, no clock, no random.
import type { Reply, Seat, Shelf, Tap, ConfigStub } from "./types.ts";
import { tokens, normalise, findDomain } from "./text.ts";

export const MIN_SCORE = 3.0;      // below this nothing is real enough to say: unmatched
export const ASK_MARGIN = 0.02;    // top-2 within 2%: ask with tap buttons
export const MAX_UNKNOWN = 0.5;     // half or more of the asker's content words unknown to the catalogue: we do not pretend
const HOME_BOOST = 1.25;
const HIT_IDF = 1.2;               // a lone keyword counts as a deliberate hit only if it is selective

type Doc = { shelf: Shelf; kw: string[][]; title: Set<string>; text: Set<string>; len: number };
export type Index = { docs: Doc[]; idf: Map<string, number>; avgLen: Record<string, number> };

export function buildIndex(shelves: Shelf[]): Index {
  const ids = new Set<string>();
  const docs: Doc[] = shelves.map((shelf) => {
    if (ids.has(shelf.id)) throw new Error("duplicate shelf id " + shelf.id);
    ids.add(shelf.id);
    const kw = shelf.keywords.map((k) => tokens(k)).filter((t) => t.length);
    const title = new Set(tokens(shelf.title));
    const text = new Set(tokens(shelf.text));
    const all = new Set<string>([...title, ...text, ...kw.flat()]);
    return { shelf, kw, title, text, len: all.size };
  });
  const df = new Map<string, number>();
  for (const d of docs) {
    const seen = new Set<string>([...d.title, ...d.text, ...d.kw.flat()]);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const N = docs.length;
  const idf = new Map<string, number>();
  for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  // length normalisation is per shelf kind, so adding portal phrasing cannot shift how offers score
  const avgLen: Record<string, number> = {};
  for (const kind of new Set(docs.map((d) => d.shelf.kind))) { const k = docs.filter((d) => d.shelf.kind === kind); avgLen[kind] = k.reduce((a, d) => a + d.len, 0) / k.length; }
  return { docs, idf, avgLen };
}

function containsRun(q: string[], k: string[]): boolean {
  outer: for (let i = 0; i + k.length <= q.length; i++) {
    for (let j = 0; j < k.length; j++) if (q[i + j] !== k[j]) continue outer;
    return true;
  }
  return false;
}

function score(index: Index, q: string[], d: Doc, seat: Seat): { s: number; hit: boolean; phrase: boolean } {
  if (!q.length) return { s: 0, hit: false, phrase: false };
  let hit = false;
  let phrase = false;
  const qset = new Set(q);
  const kwTokens = new Set(d.kw.flat());
  let s = 0;
  for (const t of qset) {
    const idf = index.idf.get(t);
    if (idf === undefined) continue;
    let w = 0;
    if (kwTokens.has(t)) w += 1.6;
    if (d.title.has(t)) w += 1.4;
    if (d.text.has(t)) w += 0.6;
    s += idf * w;
  }
  s = s / (0.65 + 0.35 * (d.len / index.avgLen[d.shelf.kind]));   // long offer blurbs must not win on vocabulary alone
  for (const k of d.kw) {
    if (k.length < 2) {
      if (k.length === 1 && qset.has(k[0])) { if (d.shelf.kind === "portal" && (index.idf.get(k[0]) ?? 0) >= HIT_IDF) hit = true; if (q.length <= 2) s += 3; }
      continue;
    }
    if (containsRun(q, k)) { s += 3 + 2.2 * k.length; hit = true; phrase = true; }
    else if (k.every((t) => qset.has(t))) { s += 1.5 + 0.8 * k.length; hit = true; }
  }
  const tt = [...d.title];
  if (tt.length >= 2 && tt.every((t) => qset.has(t))) s += 4;
  if (d.shelf.home.includes(seat)) s *= HOME_BOOST;
  return { s, hit, phrase };
}

// Share of the asker's distinct content words the catalogue has never seen. Half or more unknown means the ask is off-topic.
function unknownShare(index: Index, q: string[]): number {
  const u = [...new Set(q)];
  if (!u.length) return 1;
  return u.filter((t) => !index.idf.has(t)).length / u.length;
}

const tap = (s: Shelf): Tap => ({ label: s.title, shelfId: s.id, href: s.href });

export function route(index: Index, ask: string, seat: Seat = "guest"): Reply {
  const raw = String(ask ?? "").slice(0, 500);      // bound the work
  const q = tokens(raw);
  const domain = findDomain(raw);
  const ranked = index.docs.filter((d) => !d.shelf.only || d.shelf.only.includes(seat)).map((d) => { const r = score(index, q, d, seat); return { d, s: r.s, hit: r.hit, phrase: r.phrase }; }).sort((a, b) => b.s - a.s || (a.d.shelf.id < b.d.shelf.id ? -1 : 1));
  const top = ranked[0];
  // A domain with no strong signal is a scan request: the scan box is the front door.
  if (domain && (!top || top.s < MIN_SCORE * 6 || top.d.shelf.kind === "offer")) {
    const scan = index.docs.find((d) => d.shelf.id === "portal:scan");
    if (scan) return { kind: "match", shelf: scan.shelf, score: 99, margin: 1, answer: scan.shelf.answer, slots: { domain }, alternatives: [] };
  }
  if (!top || top.s < MIN_SCORE || (!top.hit && unknownShare(index, q) >= MAX_UNKNOWN)) return unmatched(raw, seat);
  const second = ranked[1];
  const margin = second && top.s > 0 ? (top.s - second.s) / top.s : 1;
  if (second && margin < ASK_MARGIN && second.s >= MIN_SCORE) {
    return { kind: "ask", question: "Which of these is closest to what you need?", taps: ranked.slice(0, 3).filter((r) => r.s >= MIN_SCORE).map((r) => tap(r.d.shelf)), score: top.s };
  }
  const slots: Record<string, string> = domain ? { domain } : {};
  const sh = top.d.shelf;
  const seatNote = sh.kind === "portal" && seat !== "guest" && !sh.home.includes(seat) ? "This part belongs to the " + sh.home[0] + " seat." : undefined;
  return { kind: "match", seatNote, shelf: top.d.shelf, score: top.s, margin, answer: top.d.shelf.answer, slots, alternatives: ranked.slice(1, 3).filter((r) => r.s >= MIN_SCORE).map((r) => tap(r.d.shelf)) };
}

function unmatched(raw: string, seat: Seat): Reply {
  const stub: ConfigStub = { ask: raw, normalised: normalise(raw), seat, status: "LOGGED_FOR_GENERATOR", quote: null };
  return { kind: "unmatched", message: "I do not have that on a shelf yet. I have logged it, and you will get a quote after review. You can also reach a person.", configStub: stub };
}

// Unmatched asks are logged through an interface so a Worker/D1 adapter can replace the in-memory one.
export interface UnmatchedLog { append(stub: ConfigStub): void | Promise<void> }
export class MemoryLog implements UnmatchedLog { rows: ConfigStub[] = []; append(s: ConfigStub) { this.rows.push(s); } }

export function concierge(index: Index, log: UnmatchedLog) {
  return (ask: string, seat: Seat = "guest"): Reply => {
    const r = route(index, ask, seat);
    if (r.kind === "unmatched") void log.append(r.configStub);
    return r;
  };
}

// Display layer: only strings drawn from the catalogue or fixed templates. The asker's free text is never echoed, except a validated domain.
export function say(r: Reply): string {
  if (r.kind === "match") return r.answer + (r.seatNote ? " " + r.seatNote : "") + (r.slots.domain ? " I have your domain ready to scan: " + r.slots.domain + "." : "") + " Open: " + r.shelf.href;
  if (r.kind === "ask") return r.question;
  return r.message;
}
