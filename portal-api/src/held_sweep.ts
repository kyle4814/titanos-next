// f356: the held-facts sweep. replayLateFacts is called by the f237 seed (reconcile.ts) and by the markPaid winner (f252), so a fact held for an EXISTING paid subscription row
// (a webhook that looked the row up and found none, or a fact re-held by f261 / replayLateFacts after contention) could sit unread. This pass drains them.
// Rules: only a PAID purchase's existing row is touched (an unseeded row's facts belong to the seed; an unpaid, refunded or cancelled purchase is left untouched, facts still held);
// the f242 claim lease is taken first (a live lease means markPaid is mid-flight and owns the facts); the drain itself is replayLateFacts, which takes each fact ONCE
// (takeFacts = remove) and applies it through the f183 CAS, re-holding on a throw, so a second pass is a no-op. Bounded: at most `batch` keys per pass, ascending, resumed from `cursor`.
// NOT wired to any cron or Worker trigger (GATE5): the wiring request is a CARD NEEDED in the receipt.
import type { Store } from "./store.ts";
import { replayLateFacts, leaseKey, LEASE_MS } from "./service.ts";
import { randomToken } from "./util.ts";

export interface HeldSweepReport { scanned: number; drained: number; skipped: number; contended: number; errors: string[]; nextCursor?: string }
export const SUB_HELD_PREFIX = "sub:";
export const DEFAULT_HELD_BATCH = 50, MAX_HELD_BATCH = 500;

export async function drainHeldFacts(store: Store, now: number, opts: { batch?: number; cursor?: string } = {}): Promise<HeldSweepReport> {
  const rep: HeldSweepReport = { scanned: 0, drained: 0, skipped: 0, contended: 0, errors: [] };
  const b = Number.isFinite(opts.batch) && (opts.batch as number) > 0 ? Math.min(Math.floor(opts.batch as number), MAX_HELD_BATCH) : DEFAULT_HELD_BATCH;
  const keys = await store.heldFactKeys(SUB_HELD_PREFIX, opts.cursor, b);
  if (keys.length === b) rep.nextCursor = keys[keys.length - 1]; // a full page: more may follow; a short page ends the lap
  const d = { store, now: () => now };
  for (const key of keys) {
    rep.scanned++;
    const sub = await store.subscriptionById(key.slice(SUB_HELD_PREFIX.length));
    if (!sub) { rep.skipped++; continue; } // no row yet: the seed (buildSubscription) reads these
    const pur = await store.purchaseById(sub.purchaseId);
    if (!pur || pur.status !== "paid") { rep.skipped++; continue; } // unpaid / refunded / abandoned: untouched
    const owner = randomToken("lease", 8);
    if (!(await store.acquireLease(leaseKey(pur.id), owner, now, LEASE_MS))) { rep.contended++; continue; } // markPaid or a seed is mid-flight and owns them
    try {
      const cur = await store.subscriptionById(sub.id) ?? sub, before = JSON.stringify(cur); // fresh row: replay mutates the caller's object
      const took = await replayLateFacts(d, cur);
      if (took && JSON.stringify(await store.subscriptionById(sub.id)) !== before) rep.drained++; else rep.skipped++; // skipped: a racing taker took them, or nothing was applicable yet (a later period with no first period is re-held, never lost)
    } catch (e) { rep.contended++; rep.errors.push(`${key}: ${String((e as Error)?.message ?? e)}`); } // replayLateFacts re-held them before it threw
    finally { await store.releaseLease(leaseKey(pur.id), owner); }
  }
  return rep;
}
