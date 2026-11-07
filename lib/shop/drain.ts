// C5 hop 3 (plan ch.6 C5, line 1497): drain the GeneratorQueue through generator -> gradeAll. Pure: three ports, no model call, no network, no clock, no D1.
// It never publishes: the output is a status on the queue row plus the graded shelf handed back to the caller. The one door to a live shelf stays
// lib/shop/grader.ts visibleShelves. A re-run is a no-op because only QUEUED rows are touched and every touched row leaves QUEUED or counts an attempt.
import type { Shelf, GradedShelf } from "./types";

export const MAX_ATTEMPTS = 3;
export const DEFAULT_CAP = 5;
export type DrainStatus = "QUEUED" | "QUEUED_FOR_GENERATOR" | "GRADED_PASS" | "GRADED_FAIL" | "FAILED";
export type DrainEntry = {
  cluster_id: string; label: string; first_seen: string | null; status: DrainStatus;
  attempts?: number; failed_checks?: string[]; last_error?: string | null; [k: string]: unknown;
};
export interface DrainQueue { list(): DrainEntry[]; save(entry: DrainEntry): void }
export interface ShelfGenerator { generate(entry: DrainEntry): Shelf }
export interface ShelfGrader { gradeAll(shelves: Shelf[]): GradedShelf[] }
export type DrainOutcome = { cluster_id: string; status: DrainStatus; failed_checks: string[]; attempts: number };
export type DrainResult = { processed: DrainOutcome[]; graded: GradedShelf[]; remaining: number };

const isQueued = (e: DrainEntry) => e.status === "QUEUED" || e.status === "QUEUED_FOR_GENERATOR";
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
// Oldest first_seen first; a null first_seen sorts last; ties break on cluster_id so the order is total and stable.
export function drainOrder(es: DrainEntry[]): DrainEntry[] {
  return [...es].sort((a, b) => (a.first_seen === null ? 1 : 0) - (b.first_seen === null ? 1 : 0) || cmp(a.first_seen ?? "", b.first_seen ?? "") || cmp(a.cluster_id, b.cluster_id));
}

export function drainQueue(queue: DrainQueue, gen: ShelfGenerator, grader: ShelfGrader, cap = DEFAULT_CAP): DrainResult {
  const limit = Number.isInteger(cap) && cap > 0 ? cap : 0;
  const seen = new Set<string>();
  const todo = drainOrder(queue.list().filter(isQueued)).filter((e) => (seen.has(e.cluster_id) ? false : (seen.add(e.cluster_id), true)));
  const processed: DrainOutcome[] = [], graded: GradedShelf[] = [];
  for (const e of todo.slice(0, limit)) {
    const attempts = (e.attempts ?? 0) + 1;
    try {
      const shelf = gen.generate(e);
      const out = grader.gradeAll([shelf]);
      if (!Array.isArray(out) || out.length !== 1 || !out[0]?.grade) throw new Error("grader returned no grade");
      const g = out[0];
      const failed = g.grade.checks.filter((c) => !c.ok).map((c) => c.id);
      const pass = g.grade.pass === true && failed.length === 0;
      const status: DrainStatus = pass ? "GRADED_PASS" : "GRADED_FAIL";
      queue.save({ ...e, status, attempts, failed_checks: failed, last_error: null });
      graded.push(g);
      processed.push({ cluster_id: e.cluster_id, status, failed_checks: failed, attempts });
    } catch (err) {
      const status: DrainStatus = attempts >= MAX_ATTEMPTS ? "FAILED" : e.status;
      const msg = err instanceof Error ? err.message : String(err);
      queue.save({ ...e, status, attempts, last_error: msg });
      processed.push({ cluster_id: e.cluster_id, status, failed_checks: [], attempts });
    }
  }
  return { processed, graded, remaining: queue.list().filter(isQueued).length };
}

export class MemoryDrainQueue implements DrainQueue {
  rows: DrainEntry[]; writes = 0;
  constructor(rows: DrainEntry[] = []) { this.rows = rows.map((r) => ({ ...r })); }
  list() { return this.rows.map((r) => ({ ...r })); }
  save(e: DrainEntry) { this.writes++; const i = this.rows.findIndex((r) => r.cluster_id === e.cluster_id); if (i < 0) this.rows.push({ ...e }); else this.rows[i] = { ...e }; }
}
