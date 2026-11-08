// C5 hop 5 (plan ch.6 C5, line 1497): the graded run store. drainQueue hands back graded shelves but nothing kept the grade, so the build
// step could not call promoteDrained / assertCatalogueAllGraded from stored data. This stores, per cluster_id, the label, the shelf as graded,
// and the grader run (content_hash + checks). Pure apart from an injected port: no model call, no key, no network, no clock (graded_at is injected).
import type { GradedShelf, Check } from "./types";
import type { DrainEntry, DrainQueue, DrainResult } from "./drain";
import type { D1Port } from "./drain_d1";
import { runFromGraded, promoteDrained, assertCatalogueAllGraded, MemoryGraderPort } from "./publish_gate.ts";
import { planRetractions, assertRetractionCap, applyRetractions, renderCatalogueFiles } from "./retraction.ts";
import type { Retraction, RetractPolicy } from "./retraction.ts";
import type { Catalogue, DrainedShelf, GradeRun, Held, CatalogueEntry } from "./publish_gate.ts";

export type StoredGraded = { cluster_id: string; label: string; content_hash: string; pass: boolean; checks: Check[]; shelf: GradedShelf; graded_at: string };
export interface GradedRunStore {
  saveGraded(cluster_id: string, graded: GradedShelf, label: string): Promise<void>;
  loadAll(): Promise<StoredGraded[]>;
}

const clone = <T>(v: T): T => structuredClone(v);
function makeRecord(cluster_id: string, graded: GradedShelf, label: string, graded_at: string): StoredGraded {
  const run = runFromGraded(graded);
  return { cluster_id, label, content_hash: run.content_hash, pass: run.pass, checks: run.checks, shelf: clone(graded), graded_at };
}

export class MemoryGradedStore implements GradedRunStore {
  private rows = new Map<string, StoredGraded>();
  writes = 0;
  private readonly now: () => string;
  constructor(now: () => string = () => "1970-01-01T00:00:00Z") { this.now = now; }
  async saveGraded(cluster_id: string, graded: GradedShelf, label: string): Promise<void> {
    const rec = makeRecord(cluster_id, graded, label, this.now());
    const have = this.rows.get(cluster_id);
    if (have && have.content_hash === rec.content_hash) rec.graded_at = have.graded_at; // same content re-saved: idempotent
    this.rows.set(cluster_id, rec); this.writes++;
  }
  async loadAll(): Promise<StoredGraded[]> { return [...this.rows.values()].map(clone).sort((a, b) => (a.cluster_id < b.cluster_id ? -1 : a.cluster_id > b.cluster_id ? 1 : 0)); }
}

export const GRADED_SELECT_SQL = "SELECT cluster_id, label, content_hash, pass, checks, shelf, graded_at FROM graded_run ORDER BY cluster_id";
export const GRADED_UPSERT_SQL =
  "INSERT INTO graded_run (cluster_id, label, content_hash, pass, checks, shelf, graded_at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
  "ON CONFLICT(cluster_id) DO UPDATE SET label = excluded.label, " +
  "graded_at = CASE WHEN graded_run.content_hash = excluded.content_hash THEN graded_run.graded_at ELSE excluded.graded_at END, " +
  "content_hash = excluded.content_hash, pass = excluded.pass, checks = excluded.checks, shelf = excluded.shelf";

type Row = { cluster_id: string; label: string; content_hash: string; pass: number; checks: string; shelf: string; graded_at: string };
// A corrupt JSON column reads as empty/null so the run is UNGRADED (held), never a crash and never a silent pass.
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
export function rowToStored(r: Row): StoredGraded {
  const checks = parseJson<Check[]>(r.checks, []);
  const shelf = parseJson<GradedShelf | null>(r.shelf, null);
  return { cluster_id: r.cluster_id, label: r.label, content_hash: r.content_hash, pass: Number(r.pass) === 1, checks: Array.isArray(checks) ? checks : [], shelf: shelf as GradedShelf, graded_at: r.graded_at };
}

export class D1GradedStore implements GradedRunStore {
  private readonly db: D1Port; private readonly now: () => string;
  writes = 0;
  constructor(db: D1Port, now: () => string = () => "1970-01-01T00:00:00Z") { this.db = db; this.now = now; }
  async saveGraded(cluster_id: string, graded: GradedShelf, label: string): Promise<void> {
    const r = makeRecord(cluster_id, graded, label, this.now());
    await this.db.prepare(GRADED_UPSERT_SQL).bind(r.cluster_id, r.label, r.content_hash, r.pass ? 1 : 0, JSON.stringify(r.checks), JSON.stringify(r.shelf), r.graded_at).run();
    this.writes++;
  }
  async loadAll(): Promise<StoredGraded[]> {
    const { results } = await this.db.prepare(GRADED_SELECT_SQL).all<Row>();
    return results.map(rowToStored);
  }
}

// After drainQueue: store the grade for every cluster the drain graded this tick. drainQueue pushes processed + graded in lockstep for
// GRADED_* outcomes only (a throw pushes processed alone), so graded[] zips with the GRADED_* outcomes in order.
export async function persistDrained(queue: DrainQueue, store: GradedRunStore, result: Pick<DrainResult, "processed" | "graded">): Promise<string[]> {
  const rows = new Map<string, DrainEntry>(queue.list().map((e) => [e.cluster_id, e]));
  const saved: string[] = [];
  let i = 0;
  for (const o of result.processed) {
    if (o.status !== "GRADED_PASS" && o.status !== "GRADED_FAIL") continue;
    const g = result.graded[i++];
    const row = rows.get(o.cluster_id);
    if (!g || !g.grade || !row) throw new Error("persistDrained: graded shelf and queue row out of step for " + o.cluster_id);
    await store.saveGraded(o.cluster_id, g, row.label);
    saved.push(o.cluster_id);
  }
  if (i !== result.graded.length) throw new Error("persistDrained: " + (result.graded.length - i) + " graded shelf(s) with no GRADED outcome");
  return saved;
}

// retract: when given, entries that fail the retraction policy are removed and listed (now is injected, there is no clock here).
export type BuildOpts = { base?: Catalogue; expectIds?: string[]; strict?: boolean; retract?: RetractPolicy & { now: string } };
export type BuildResult = { catalogue: Catalogue; published: CatalogueEntry[]; held: Held[]; retractions: Retraction[]; files: { "shelf_catalogue.json": string; "retractions.json": string } | null };
// Integrity holds (no run, stale hash, partial, malformed) block the build. A shelf that was honestly graded and FAILED is just held.
const FAIL_ONLY = /^(failed checks|grader run not marked pass)/;
// The build step: stored runs -> promoteDrained -> assertCatalogueAllGraded. Throws on ANY ungraded shelf (never builds around it).
export async function buildCatalogueFromStore(store: GradedRunStore, opts: BuildOpts = {}): Promise<BuildResult> {
  const stored = await store.loadAll();
  const drained: DrainedShelf[] = [];
  const runs: Record<string, GradeRun> = {};
  for (const s of stored) {
    drained.push({ cluster_id: s.cluster_id, label: s.label, shelf: s.shelf });
    runs[s.cluster_id] = { content_hash: s.content_hash, pass: s.pass, checks: s.checks };
  }
  const bad: string[] = [];
  const have = new Set(stored.map((s) => s.cluster_id));
  for (const id of opts.expectIds ?? []) if (!have.has(id)) bad.push(id + ": ungraded: no stored grader run");
  const res = promoteDrained(opts.base ?? { entries: [] }, drained.filter((d) => d.shelf), new MemoryGraderPort(runs));
  for (const s of stored) if (!s.shelf) bad.push(s.cluster_id + ": ungraded: stored shelf unreadable");
  for (const h of res.held) if (opts.strict || !FAIL_ONLY.test(h.reason)) bad.push(h.cluster_id + ": " + h.reason);
  if (bad.length) throw new Error(`graded store: ${bad.length} ungraded shelf(s) block the build: ` + bad.join("; "));
  let catalogue = res.catalogue;
  let retractions: Retraction[] = [];
  if (opts.retract) {
    retractions = planRetractions(stored, opts.retract.now, opts.retract, catalogue);
    assertRetractionCap(retractions.length, catalogue.entries.length, opts.retract);
    catalogue = applyRetractions(catalogue, retractions);
  }
  assertCatalogueAllGraded(catalogue);
  const published = res.published.filter((p) => catalogue.entries.some((e) => e.cluster_id === p.cluster_id));
  const files = opts.retract ? renderCatalogueFiles(catalogue, retractions, opts.retract.now, opts.retract) : null;
  return { catalogue, published, held: res.held, retractions, files };
}
