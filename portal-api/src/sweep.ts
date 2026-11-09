// f247: the ONE scheduled sweep entry. Runs the three housekeeping passes in a fixed order, each isolated so one failing pass never stops the others:
//   1 reconcilePending (f210)  2 reconcileSubscriptions (f237)  3 reapRefundMemos (f243, wired here by f247; before this nothing ever called it).
// Pure over (Deps, clock): d.now() is the clock. NOT attached to any cron trigger: wrangler.toml [triggers] is a CARD NEEDED (GATE5), see the f247 receipt.
import type { Deps } from "./service.ts";
import { reapRefundMemos } from "./service.ts";
import { reconcilePending } from "./pending_reconciler.ts";
import { reconcileSubscriptions } from "./reconcile.ts";

export const SWEEP_GRACE_MS = 15 * 60_000; // must stay above LEASE_MS (f242): a sweep never touches a purchase whose winner may still hold its claim lease
export interface SweepReport { pending?: Awaited<ReturnType<typeof reconcilePending>>; subscriptions?: Awaited<ReturnType<typeof reconcileSubscriptions>>; memos?: Awaited<ReturnType<typeof reapRefundMemos>>; errors: string[] }

export async function runSweep(d: Deps, graceMs = SWEEP_GRACE_MS): Promise<SweepReport> {
  const rep: SweepReport = { errors: [] };
  const step = async <K extends keyof SweepReport>(name: K, f: () => Promise<NonNullable<SweepReport[K]>>) => {
    try { (rep as Record<string, unknown>)[name] = await f(); } catch (e) { rep.errors.push(`${String(name)}: ${String((e as Error)?.message ?? e)}`); }
  };
  await step("pending", () => reconcilePending(d, graceMs));
  await step("subscriptions", () => reconcileSubscriptions(d.store, d.billing, d.now(), graceMs));
  await step("memos", () => reapRefundMemos(d));
  return rep;
}
