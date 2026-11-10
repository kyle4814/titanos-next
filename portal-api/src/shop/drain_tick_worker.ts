// f334 C5: the Worker-side host for runDrainGradeTick (f322). Pure wiring: D1 binding "DB" -> D1DrainQueue (generator_queue) + D1GradedStore (graded_run).
// NO model call and NO network here: the GeneratorPort comes only from an injected builder; with none wired the tick is a no-op (NO_GENERATOR).
// Default OFF (DRAIN_TICK_ENABLED must be exactly "1"). Fails closed: ANY D1 error = no further writes this tick, error counted, queue rows stay QUEUED, next tick retries.
// The cron trigger itself is NOT registered anywhere live: see portal-api/wrangler.drain-tick.toml.example (GATE5 card in the f334 receipt).
import type { Env } from "../env.ts";
import { runDrainGradeTick, DEFAULT_MAX_ITEMS, DEFAULT_BUDGET, DEFAULT_MAX_MS } from "../../../lib/shop/drain_grade_tick.ts";
import type { GeneratorPort, TickPorts, TickReport } from "../../../lib/shop/drain_grade_tick.ts";
import { D1DrainQueue } from "../../../lib/shop/drain_d1.ts";
import { D1GradedStore } from "../../../lib/shop/graded_store.ts";
import { gradeAll } from "../../../lib/shop/grader.ts";

export const DRAIN_TICK_CRON = "*/10 * * * *";   // the cron expression this handler claims; any other cron falls through to the monitor handler
export type DrainTickReason = "DISABLED" | "NO_GENERATOR" | "NO_DB" | "D1_ERROR" | "OK" | "DUPLICATE_FIRE";
export interface DrainTickResult { ran: boolean; ok: boolean; reason: DrainTickReason; report?: TickReport; error?: string }
export interface DrainTickOpts { maxItems?: number; budget?: number; maxMs?: number; now?: () => number; buildGenerator?: (env: Env) => GeneratorPort | null; log?: (line: string) => void }

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

export function isDrainTick(event: { cron?: string }): boolean { return event?.cron === DRAIN_TICK_CRON; }

export async function drainTickScheduled(event: { scheduledTime?: number; cron?: string }, env: Env, opts: DrainTickOpts = {}): Promise<DrainTickResult> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const note = (reason: string, extra: Record<string, unknown> = {}) => log(JSON.stringify({ svc: "drain-tick", reason, ...extra }));
  if ((env as { DRAIN_TICK_ENABLED?: string }).DRAIN_TICK_ENABLED !== "1") return { ran: false, ok: true, reason: "DISABLED" };
  if (!env.DB) { note("no_db"); return { ran: false, ok: false, reason: "NO_DB" }; }
  let generator: GeneratorPort | null = null;
  try { generator = opts.buildGenerator ? opts.buildGenerator(env) : null; } catch (e) { note("generator_build_failed", { error: msg(e) }); return { ran: false, ok: false, reason: "NO_GENERATOR", error: msg(e) }; }
  if (!generator) return { ran: false, ok: true, reason: "NO_GENERATOR" };
  const now = opts.now ?? (() => Date.now());
  const db = env.DB as unknown as ConstructorParameters<typeof D1DrainQueue>[0];
  const ports: TickPorts = {
    queue: new D1DrainQueue(db), generator, grader: { gradeAll },
    store: new D1GradedStore(db as unknown as ConstructorParameters<typeof D1GradedStore>[0], () => new Date(now()).toISOString()), now,
  };
  try {
    const report = await runDrainGradeTick(ports, { maxItems: opts.maxItems ?? DEFAULT_MAX_ITEMS, budget: opts.budget ?? DEFAULT_BUDGET, maxMs: opts.maxMs ?? DEFAULT_MAX_MS });
    note("ok", { drained: report.drained, saved: report.saved.length, failed: report.failed.length, errors: report.errors.length, stop: report.stop });
    return { ran: true, ok: report.errors.length === 0, reason: "OK", report };
  } catch (e) {
    // A D1 read/write threw mid-tick. Items committed before it stay committed (store save, then queue flush, per item); the failing item stays QUEUED.
    const report = (e as { report?: TickReport }).report;
    note("d1_error", { error: msg(e), saved: report?.saved.length ?? 0 });
    return { ran: true, ok: false, reason: "D1_ERROR", report, error: msg(e) };
  }
}
