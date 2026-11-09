// C5 hop 6 (plan ch.6 C5, FILL_f305/f303 CARD NEEDED): one scheduled tick = pull queued demand clusters -> injected GeneratorPort -> existing gradeAll ->
// saveGraded ONLY for passing shelves. A failing shelf is GRADED_FAIL on the queue row and in the report, never written to the graded store (publish path).
// Pure apart from injected ports: NO model call, NO network, NO clock of its own (now() is injected). The real generator is BYOK/gated and out of scope.
// Idempotent: only QUEUED rows are touched and every touched row leaves QUEUED (or counts an attempt), so a re-run on the same queue writes nothing.
// Crash-safe: each item is committed alone (store save, then queue save, then flush); a store throw aborts the tick with the earlier items intact.
import type { Shelf, GradedShelf } from "./types";
import { drainOrder, MAX_ATTEMPTS } from "./drain.ts";
import type { DrainEntry, DrainQueue, DrainStatus, ShelfGrader } from "./drain.ts";
import type { GradedRunStore } from "./graded_store.ts";

export const DEFAULT_MAX_ITEMS = 20;
export const DEFAULT_BUDGET = 20; // cost units per tick; one generation defaults to cost 1
export const DEFAULT_MAX_MS = 25_000;

export type GeneratorResult = { shelf: Shelf; cost?: number };
export interface GeneratorPort { generate(entry: DrainEntry): Promise<GeneratorResult> }
export type TickQueue = DrainQueue & { load?(): Promise<void>; flush?(): Promise<void> };
export type TickPorts = { queue: TickQueue; generator: GeneratorPort; grader: ShelfGrader; store: GradedRunStore; now?: () => number };
export type TickOpts = { maxItems?: number; budget?: number; maxMs?: number };
export type TickError = { cluster_id: string; message: string };
export type TickStop = "DONE" | "MAX_ITEMS" | "BUDGET" | "CLOCK";
export type TickReport = { drained: number; saved: string[]; failed: string[]; skipped: number; errors: TickError[]; spent: number; stop: TickStop };

const isQueued = (e: DrainEntry) => e.status === "QUEUED" || e.status === "QUEUED_FOR_GENERATOR";
const posInt = (v: number | undefined, d: number) => (v === undefined ? d : Number.isInteger(v) && v > 0 ? v : 0);

export async function runDrainGradeTick(ports: TickPorts, opts: TickOpts = {}): Promise<TickReport> {
  const maxItems = posInt(opts.maxItems, DEFAULT_MAX_ITEMS);
  const budget = opts.budget === undefined ? DEFAULT_BUDGET : Number.isFinite(opts.budget) && opts.budget > 0 ? opts.budget : 0;
  const maxMs = opts.maxMs === undefined ? DEFAULT_MAX_MS : Number.isFinite(opts.maxMs) && opts.maxMs > 0 ? opts.maxMs : 0;
  const now = ports.now ?? (() => 0);
  const t0 = now();
  const { queue, generator, grader, store } = ports;
  if (queue.load) await queue.load();
  const seen = new Set<string>();
  const todo = drainOrder(queue.list().filter(isQueued)).filter((e) => (seen.has(e.cluster_id) ? false : (seen.add(e.cluster_id), true)));
  const rep: TickReport = { drained: 0, saved: [], failed: [], skipped: 0, errors: [], spent: 0, stop: "DONE" };
  let i = 0;
  for (; i < todo.length; i++) {
    if (i >= maxItems) { rep.stop = "MAX_ITEMS"; break; }
    if (rep.spent >= budget) { rep.stop = "BUDGET"; break; }
    if (now() - t0 >= maxMs) { rep.stop = "CLOCK"; break; }
    const e = todo[i];
    const attempts = (e.attempts ?? 0) + 1;
    rep.drained++;
    let g: GradedShelf;
    try {
      const out = await generator.generate(e);
      rep.spent += Number.isFinite(out.cost) && (out.cost as number) >= 0 ? (out.cost as number) : 1;
      const res = grader.gradeAll([out.shelf]);
      if (!Array.isArray(res) || res.length !== 1 || !res[0]?.grade) throw new Error("grader returned no grade");
      g = res[0];
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status: DrainStatus = attempts >= MAX_ATTEMPTS ? "FAILED" : e.status;
      queue.save({ ...e, status, attempts, last_error: message });
      if (queue.flush) await queue.flush();
      rep.errors.push({ cluster_id: e.cluster_id, message });
      continue;
    }
    const failedChecks = g.grade.checks.filter((c) => !c.ok).map((c) => c.id);
    const pass = g.grade.pass === true && failedChecks.length === 0;
    try {
      if (pass) await store.saveGraded(e.cluster_id, g, e.label); // the ONLY write to the publish path
      queue.save({ ...e, status: pass ? "GRADED_PASS" : "GRADED_FAIL", attempts, failed_checks: failedChecks, last_error: null });
      if (queue.flush) await queue.flush();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      rep.errors.push({ cluster_id: e.cluster_id, message });
      rep.skipped = todo.length - i;
      const abort = new Error("drain tick aborted at " + e.cluster_id + ": " + message) as Error & { report: TickReport };
      abort.report = rep;
      throw abort; // earlier items are already committed; this one stays QUEUED and is retried next tick
    }
    (pass ? rep.saved : rep.failed).push(e.cluster_id);
  }
  rep.skipped = todo.length - i;
  return rep;
}

export type TickEnv = { DRAIN_TICK_ENABLED?: string; [k: string]: unknown };
export type TickBuild = (env: TickEnv) => TickPorts | null;
export type ScheduledResult = { ran: boolean; reason?: "DISABLED" | "NO_GENERATOR"; report?: TickReport };

// Default OFF: runs only when DRAIN_TICK_ENABLED is exactly "1". The real GeneratorPort builder (BYOK, gated) is not wired here, so by default even an
// enabled flag is a no-op (NO_GENERATOR). No cron trigger exists in wrangler config: that is a CARD NEEDED (GATE5 + deploy).
export async function scheduled(_event: { scheduledTime?: number; cron?: string }, env: TickEnv, build: TickBuild = () => null, opts: TickOpts = {}): Promise<ScheduledResult> {
  if (env?.DRAIN_TICK_ENABLED !== "1") return { ran: false, reason: "DISABLED" };
  const ports = build(env);
  if (!ports) return { ran: false, reason: "NO_GENERATOR" };
  return { ran: true, report: await runDrainGradeTick(ports, opts) };
}
