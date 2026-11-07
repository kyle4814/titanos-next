// C5 hop 6 (plan ch.6 C5, kill test "1,000 shelves live, 0 ungraded"): the catalogue CONSUMER. Pure and server-free: it is handed a text source
// (the published lib/shop/shelf_catalogue.json, or null when absent) and a fallback shelf list (the current synthetic source) and exposes
// listShelves / getShelf / searchShelves. No model call, no network, no clock.
// Rules: absent or empty catalogue => fallback (nothing regresses); malformed or ungraded catalogue => THROW at construction, never a partial shelf.
import { assertCatalogueAllGraded } from "./publish_gate.ts";
import type { Catalogue } from "./publish_gate";
import { buildShelfIndex, searchShelves as runSearch } from "./search.ts";
import type { ShelfIndex, Hit } from "./search";
import type { GradedShelf } from "./types";

export type CatalogueSource = () => string | null; // null = file absent
export type ReaderOpts = { seat?: string; limit?: number };
export interface CatalogueReader {
  readonly from: "catalogue" | "fallback";
  listShelves(): GradedShelf[];
  getShelf(slug: string): GradedShelf | undefined;
  searchShelves(q: string, opts?: ReaderOpts): GradedShelf[];
}

const byClusterId = <T extends { cluster_id: string }>(a: T, b: T) => (a.cluster_id < b.cluster_id ? -1 : a.cluster_id > b.cluster_id ? 1 : 0);

// Parse + validate. Returns the shelves in cluster_id order, or null when the file is absent/empty (caller falls back). Throws on anything else.
export function readCatalogue(text: string | null): GradedShelf[] | null {
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
  return sorted.map((e) => e.shelf);
}

export function createCatalogueReader(source: CatalogueSource, fallback: GradedShelf[]): CatalogueReader {
  const fromCat = readCatalogue(source());
  const shelves: GradedShelf[] = fromCat ?? fallback;
  const bySlug = new Map<string, GradedShelf>();
  for (const s of shelves) if (!bySlug.has(s.slug)) bySlug.set(s.slug, s);
  const byId = new Map<string, GradedShelf>(shelves.map((s) => [s.id, s]));
  let index: ShelfIndex | null = null;
  return {
    from: fromCat ? "catalogue" : "fallback",
    listShelves: () => [...shelves],
    getShelf: (slug) => bySlug.get(slug),
    searchShelves(q, opts = {}) {
      index ??= buildShelfIndex(shelves as never);
      return runSearch(index, q, opts).map((h: Hit) => byId.get(h.id)).filter((s): s is GradedShelf => !!s);
    },
  };
}
