// C5 hop 5 (plan ch.6 C5, kill test "1,000 shelves live, 0 ungraded"): the build step. Reads drained shelves + their stored grader runs from a
// PORT, runs promoteDrained against the existing catalogue, then assertCatalogueAllGraded. Any held shelf or any assert throw FAILS the build and
// lists EVERY offending cluster_id; the catalogue text is only produced on success. Deterministic: no model call, no network, no clock.
import { promoteDrained, assertCatalogueAllGraded, runFromGraded } from "./publish_gate.ts";
import type { Catalogue, DrainedShelf, GradeRun } from "./publish_gate";
import type { D1Port } from "./drain_d1";
import type { GradedShelf } from "./types";

export type DrainedBatch = { shelves: DrainedShelf[]; runs: Record<string, GradeRun> };
export interface DrainedStore { load(): Promise<DrainedBatch> }

// Default adapter: in memory, no I/O.
export class MemoryDrainedStore implements DrainedStore {
  private readonly batch: DrainedBatch;
  constructor(batch: DrainedBatch = { shelves: [], runs: {} }) { this.batch = batch; }
  async load(): Promise<DrainedBatch> { return structuredClone(this.batch); }
}

export const SELECT_SHELVES_SQL = "SELECT cluster_id, label, shelf_json, run_json FROM generator_shelves";
export const UPSERT_SHELF_SQL =
  "INSERT INTO generator_shelves (cluster_id, label, shelf_json, run_json) VALUES (?, ?, ?, ?) " +
  "ON CONFLICT(cluster_id) DO UPDATE SET label = excluded.label, shelf_json = excluded.shelf_json, run_json = excluded.run_json";
type ShelfRow = { cluster_id: string; label: string; shelf_json: string; run_json: string | null };

const parseJson = (s: string | null | undefined): unknown => { if (typeof s !== "string" || !s.trim()) return null; try { return JSON.parse(s); } catch { return null; } };

// D1 adapter behind the same interface. A row with no readable run_json simply has no run, so the gate holds it as ungraded.
export class D1DrainedStore implements DrainedStore {
  private readonly db: D1Port;
  constructor(db: D1Port) { this.db = db; }
  async load(): Promise<DrainedBatch> {
    const { results } = await this.db.prepare(SELECT_SHELVES_SQL).all<ShelfRow>();
    const shelves: DrainedShelf[] = [], runs: Record<string, GradeRun> = {};
    for (const r of results) {
      const shelf = parseJson(r.shelf_json) as GradedShelf | null;
      shelves.push({ cluster_id: r.cluster_id, label: r.label, shelf: shelf as GradedShelf });
      const run = parseJson(r.run_json) as GradeRun | null;
      if (run) runs[r.cluster_id] = run;
    }
    return { shelves, runs };
  }
  // Drain-step half (f304 PENDING LIVE item 1): store the graded shelf and runFromGraded(g) per cluster_id.
  async saveGraded(items: { cluster_id: string; label: string; graded: GradedShelf }[]): Promise<number> {
    let n = 0;
    for (const i of items) {
      await this.db.prepare(UPSERT_SHELF_SQL).bind(i.cluster_id, i.label, JSON.stringify(i.graded), JSON.stringify(runFromGraded(i.graded))).run();
      n++;
    }
    return n;
  }
}

// Key-sorted JSON so the same catalogue is always the same bytes, whatever order the store returned rows in.
export function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => [k, stable(o[k])]));
  }
  return v;
}
export function serialiseCatalogue(c: Catalogue): string {
  const entries = [...c.entries].sort((a, b) => (a.cluster_id < b.cluster_id ? -1 : a.cluster_id > b.cluster_id ? 1 : 0));
  return JSON.stringify(stable({ entries }), null, 2) + "\n";
}

export type Offender = { cluster_id: string; reason: string };
export type BuildResult =
  | { ok: true; text: string; catalogue: Catalogue; published: number; already: number }
  | { ok: false; offenders: Offender[]; assertError: string | null };

export async function buildCatalogue(store: DrainedStore, existing: Catalogue = { entries: [] }): Promise<BuildResult> {
  const batch = await store.load();
  const port = { lookup: (id: string) => (Object.prototype.hasOwnProperty.call(batch.runs, id) ? batch.runs[id] : null) };
  const r = promoteDrained(existing, batch.shelves, port);
  const offenders: Offender[] = r.held.map((h) => ({ cluster_id: h.cluster_id, reason: h.reason }));
  let assertError: string | null = null;
  try { assertCatalogueAllGraded(r.catalogue); } catch (e) { assertError = e instanceof Error ? e.message : String(e); }
  if (offenders.length || assertError) return { ok: false, offenders, assertError };
  return { ok: true, text: serialiseCatalogue(r.catalogue), catalogue: r.catalogue, published: r.published.length, already: r.already.length };
}

// One line per offender, every id, plus the assert message in full.
export function formatFailure(res: Extract<BuildResult, { ok: false }>): string {
  const lines = res.offenders.map((o) => `OFFENDER ${o.cluster_id}: ${o.reason}`);
  if (res.assertError) lines.push("ASSERT " + res.assertError);
  lines.push(`BUILD FAILED: ${res.offenders.length} shelf(s) held, catalogue not written`);
  return lines.join("\n");
}
