// C5/C6 shelf search: deterministic catalogue lookup, zero model calls, zero network. Pure functions.
// Only shelves that carry a passing grade AND re-grade clean are indexed. Seat filtering fails closed.
import { gradeShelf } from "./grader.ts";

export type Seat = "guest" | "owner" | "pro" | "agent" | "enterprise" | "partner";
export const SEATS: readonly Seat[] = ["guest", "owner", "pro", "agent", "enterprise", "partner"];
export const MAX_QUERY_CHARS = 120;
export const MAX_QUERY_TOKENS = 12;
export const TYPO_MIN_LEN = 5;

// Optional extras on an input shelf (stripped before grading, since the grader rejects unknown fields).
// seats: who may see it. Missing = guest and every seat. Unknown seat strings never grant access.
export type SearchInput = Record<string, any> & { id: string; seats?: string[]; aliases?: string[] };
type Doc = { id: string; seats: Set<Seat>; title: Map<string, number>; tags: Set<string>; alias: Set<string>; body: Set<string> };
export type ShelfIndex = { docs: Doc[]; vocab: string[]; byToken: Map<string, Set<number>>; skipped: { id: string; why: string }[] };
export type Hit = { id: string; score: number };

export const tokenise = (s: unknown): string[] =>
  typeof s !== "string" ? [] : s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0);

// Edit distance <= 1 (insert, delete, substitute, adjacent transposition counts as 1 for typos).
export function within1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

const W = { title: 10, alias: 8, tag: 6, body: 2 };
const TYPO_FACTOR = 0.5;

export function buildShelfIndex(shelves: SearchInput[]): ShelfIndex {
  const docs: Doc[] = [], skipped: { id: string; why: string }[] = [];
  const byToken = new Map<string, Set<number>>();
  const seen = new Set<string>();
  for (const raw of Array.isArray(shelves) ? shelves : []) {
    const id = raw && typeof raw.id === "string" ? raw.id : "<no id>";
    if (!raw || typeof raw !== "object") { skipped.push({ id, why: "not an object" }); continue; }
    if (!raw.grade || raw.grade.pass !== true) { skipped.push({ id, why: "ungraded or failed" }); continue; }
    const { seats, aliases, ...shelf } = raw as any;
    if (!gradeShelf(shelf).pass) { skipped.push({ id, why: "re-grade failed" }); continue; }
    if (seen.has(id)) { skipped.push({ id, why: "duplicate id" }); continue; }
    seen.add(id);
    const seatSet = new Set<Seat>(Array.isArray(seats) ? (seats.filter((x: unknown) => SEATS.includes(x as Seat)) as Seat[]) : SEATS);
    const title = new Map<string, number>();
    for (const t of tokenise(shelf.name)) title.set(t, 1);
    for (const t of tokenise(shelf.slug)) title.set(t, 1);
    const tags = new Set<string>(shelf.tags.flatMap(tokenise));
    const alias = new Set<string>((Array.isArray(aliases) ? aliases : []).flatMap(tokenise));
    const body = new Set<string>(tokenise(shelf.bluf));
    const d: Doc = { id, seats: seatSet, title, tags, alias, body };
    const n = docs.push(d) - 1;
    for (const t of [...title.keys(), ...tags, ...alias, ...body]) { if (!byToken.has(t)) byToken.set(t, new Set()); byToken.get(t)!.add(n); }
  }
  return { docs, vocab: [...byToken.keys()].sort(), byToken, skipped };
}

function fieldScore(d: Doc, tok: string, mult: number): number {
  let s = 0;
  if (d.title.has(tok)) s = Math.max(s, W.title);
  if (d.alias.has(tok)) s = Math.max(s, W.alias);
  if (d.tags.has(tok)) s = Math.max(s, W.tag);
  if (d.body.has(tok)) s = Math.max(s, W.body);
  return s * mult;
}

export function searchShelves(index: ShelfIndex, query: unknown, opts: { seat?: string; limit?: number } = {}): Hit[] {
  if (!index || !Array.isArray(index.docs) || typeof query !== "string") return [];
  const seat: Seat = SEATS.includes(opts.seat as Seat) ? (opts.seat as Seat) : "guest"; // unknown seat = guest
  const limit = Math.max(1, Math.min(50, Number.isInteger(opts.limit) ? (opts.limit as number) : 10));
  const toks = [...new Set(tokenise(query.slice(0, MAX_QUERY_CHARS)))].slice(0, MAX_QUERY_TOKENS);
  if (!toks.length) return [];
  const scores = new Map<number, number>();
  for (const tok of toks) {
    // candidate vocab words: exact, plus edit-distance-1 neighbours for tokens of 5+ letters
    const cands: [string, number][] = index.byToken.has(tok) ? [[tok, 1]] : [];
    if (tok.length >= TYPO_MIN_LEN) for (const v of index.vocab) if (v !== tok && v.length >= TYPO_MIN_LEN && within1(tok, v)) cands.push([v, TYPO_FACTOR]);
    const best = new Map<number, number>();
    for (const [word, mult] of cands) for (const n of index.byToken.get(word)!) {
      const sc = fieldScore(index.docs[n], word, mult);
      if (sc > (best.get(n) ?? 0)) best.set(n, sc);
    }
    for (const [n, sc] of best) scores.set(n, (scores.get(n) ?? 0) + sc);
  }
  const out: Hit[] = [];
  for (const [n, score] of scores) { const d = index.docs[n]; if (d.seats.has(seat)) out.push({ id: d.id, score }); }
  out.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, limit);
}
