// C5 hop 6 (plan ch.6 C5, kill test "1,000 shelves live, 0 ungraded"): the catalogue CONSUMER. Pure and server-free: it is handed a text source
// (the published lib/shop/shelf_catalogue.json, or null when absent) and a fallback shelf list (the current synthetic source) and exposes
// listShelves / getShelf / searchShelves. No model call, no network, no clock.
// Rules: absent or empty catalogue => fallback (nothing regresses); malformed or ungraded catalogue => THROW at construction, never a partial shelf.
import { assertCatalogueAllGraded } from "./publish_gate.ts";
import type { Catalogue, CatalogueEntry } from "./publish_gate";
import { buildShelfIndex, searchShelves as runSearch } from "./search.ts";
import type { ShelfIndex, Hit } from "./search";
import type { GradedShelf } from "./types";

export type CatalogueSource = () => string | null; // null = file absent
export type ReaderOpts = { seat?: string; limit?: number };
export interface CatalogueReader {
  readonly from: "catalogue" | "fallback";
  readonly retractionError: string | null; // non-null = retractions.json present but bad: the reader serves nothing (fail closed)
  readonly closed: boolean;
  retracted(): RetractionNote[]; // every withdrawn id with its reason (empty when the sidecar is absent or bad)
  getWithdrawn(key: string): RetractionNote | undefined; // cluster_id, shelf id or slug of a withdrawn shelf: render withdrawnLine(), never a 404 or a re-listing
  listShelves(): GradedShelf[];
  getShelf(slug: string): GradedShelf | undefined;
  searchShelves(q: string, opts?: ReaderOpts): GradedShelf[];
}

const byClusterId = <T extends { cluster_id: string }>(a: T, b: T) => (a.cluster_id < b.cluster_id ? -1 : a.cluster_id > b.cluster_id ? 1 : 0);

// Parse + validate. Returns the shelves in cluster_id order, or null when the file is absent/empty (caller falls back). Throws on anything else.
export function readCatalogue(text: string | null): GradedShelf[] | null {
  const es = readCatalogueEntries(text);
  return es ? es.map((e) => e.shelf) : null;
}

// Same validation, but keeps the cluster_id (the retraction sidecar keys on it).
export function readCatalogueEntries(text: string | null): CatalogueEntry[] | null {
  if (text === null || text.trim() === "") return null;
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (e) { throw new Error("shelf_catalogue.json is not valid JSON: " + (e instanceof Error ? e.message : String(e))); }
  const entries = (parsed as { entries?: unknown } | null)?.entries;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(entries)) throw new Error("shelf_catalogue.json must be an object with an entries array");
  if (entries.length === 0) return null;
  const cat = parsed as Catalogue;
  assertCatalogueAllGraded(cat); // throws listing every ungraded cluster_id
  const sorted = [...cat.entries].sort(byClusterId);
  const ids = new Set<string>(), slugs = new Set<string>(), dup: string[] = [];
  for (const e of sorted) {
    if (ids.has(e.cluster_id) || slugs.has(e.shelf.slug)) dup.push(e.cluster_id);
    ids.add(e.cluster_id); slugs.add(e.shelf.slug);
  }
  if (dup.length) throw new Error("shelf_catalogue.json has duplicate cluster_id or slug: " + dup.join(", "));
  return sorted;
}

// ---- f332: the READ side of the retraction loop. The build (f317) writes retractions.json next to shelf_catalogue.json. ----
export const RETRACT_REASONS = ["cluster removed", "regrade failed", "content_hash mismatch", "grade too old"] as const;
export type RetractionNote = { id: string; reason: string; detail: string };
export type RetractionSource = () => string | null; // null = sidecar absent (the ONLY fallback-to-catalogue case)

// Labelled PLACEHOLDER line for a withdrawn shelf URL. Not final client copy; no CTA, no dashes.
export function withdrawnLine(r: RetractionNote): string {
  return "PLACEHOLDER (not final copy): this shelf has been withdrawn (" + r.reason + ") and is no longer listed.";
}

// Parse + validate the sidecar. Absent/blank => ok with null (caller serves the catalogue as is). ANYTHING else wrong => { error }, never ignored.
export function readRetractions(text: string | null): { notes: RetractionNote[] | null; error: string | null } {
  if (text === null) return { notes: null, error: null }; // a blank or truncated file is PRESENT, so it falls through to the parse error
  const bad = (m: string) => ({ notes: null, error: "retractions.json " + m });
  let p: unknown;
  try { p = JSON.parse(text); } catch (e) { return bad("is not valid JSON: " + (e instanceof Error ? e.message : String(e))); }
  if (!p || typeof p !== "object" || Array.isArray(p)) return bad("must be a JSON object");
  const o = p as Record<string, unknown>;
  if (!Array.isArray(o.retractions)) return bad("has no retractions array");
  if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 0) return bad("has no integer count");
  if (!o.policy || typeof o.policy !== "object" || Array.isArray(o.policy)) return bad("has no policy object");
  if (o.count !== o.retractions.length) return bad(`count ${o.count} disagrees with ${o.retractions.length} entries`);
  const seen = new Set<string>(), notes: RetractionNote[] = [];
  for (const r of o.retractions as unknown[]) {
    const x = r as Record<string, unknown> | null;
    if (!x || typeof x !== "object" || typeof x.id !== "string" || x.id === "") return bad("has an entry with no id");
    if (typeof x.reason !== "string" || !(RETRACT_REASONS as readonly string[]).includes(x.reason)) return bad(`entry ${x.id} has an unknown reason`);
    if (typeof x.detail !== "string") return bad(`entry ${x.id} has no detail`);
    if (seen.has(x.id)) return bad(`lists ${x.id} twice`);
    seen.add(x.id); notes.push({ id: x.id, reason: x.reason, detail: x.detail });
  }
  return { notes: notes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), error: null };
}

export function createCatalogueReader(source: CatalogueSource, fallback: GradedShelf[], retractionSource: RetractionSource = () => null): CatalogueReader {
  const entries = readCatalogueEntries(source());
  const { notes, error } = readRetractions(retractionSource());
  // key (cluster_id, shelf id or slug) -> the shelf it names, taken BEFORE filtering so a stale catalogue still maps slug -> retracted id.
  const base: { key: string[]; shelf: GradedShelf }[] = entries ? entries.map((e) => ({ key: [e.cluster_id, e.shelf.id, e.shelf.slug], shelf: e.shelf })) : fallback.map((s) => ({ key: [s.id, s.slug], shelf: s }));
  const gone = new Map<string, RetractionNote>(); // every key that resolves to a withdrawn notice
  if (!error && notes) {
    for (const n of notes) gone.set(n.id, n);
    for (const b of base) { const hit = b.key.map((k) => gone.get(k)).find(Boolean); if (hit) for (const k of b.key) if (!gone.has(k)) gone.set(k, hit); }
  }
  // FAIL CLOSED: a sidecar that is present but bad means we cannot tell which shelves are withdrawn, so nothing is served and the error is reported.
  const shelves: GradedShelf[] = error ? [] : base.filter((b) => !b.key.some((k) => gone.has(k))).map((b) => b.shelf);
  const bySlug = new Map<string, GradedShelf>();
  for (const s of shelves) if (!bySlug.has(s.slug)) bySlug.set(s.slug, s);
  const byId = new Map<string, GradedShelf>(shelves.map((s) => [s.id, s]));
  let index: ShelfIndex | null = null;
  return {
    from: entries ? "catalogue" : "fallback",
    retractionError: error,
    closed: error !== null,
    listShelves: () => [...shelves],
    getShelf: (slug) => bySlug.get(slug),
    retracted: () => (error || !notes ? [] : notes.map((n) => ({ ...n }))),
    getWithdrawn: (key) => { const n = gone.get(key); return n ? { ...n } : undefined; },
    searchShelves(q, opts = {}) {
      if (!shelves.length) return [];
      index ??= buildShelfIndex(shelves as never);
      return runSearch(index, q, opts).map((h: Hit) => byId.get(h.id)).filter((s): s is GradedShelf => !!s);
    },
  };
}
