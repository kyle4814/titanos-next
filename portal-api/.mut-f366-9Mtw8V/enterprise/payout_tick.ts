// C8 f57: ONE payout tick = the f42 resume sweep, then the f46 retry pass, once. PURE and MOCK ONLY: the transfer goes through the
// injected PayoutProvider (tests inject MockPayouts); no Stripe, no network, no timer in this file. The Worker scheduled() handler
// (src/index.ts) is the only caller on a clock, and a cron trigger is NOT in wrangler.toml (deploy is GATE5, see receipt).
// Guarantees: (1) never throws: a thrown pass or row becomes a counted, logged `errors` and the tick carries on; (2) bounded: at
// most opts.maxRows payout rows are read across BOTH passes, oldest first; (3) idempotent at a fixed `now`: terminal rows are not
// touched again, and a row this tick already retried (tickAt === now) is skipped by a second tick at the same now; (4) crash-safe:
// every move is a compare-and-set, a crash leaves a row in `sending`, and the next tick's sweep resolves it by key lookup (the
// transfer key is the payout id, so a re-send is a provider no-op); (5) tenant scope: opts.tenantId limits both passes, and every
// write keeps the row's own partnerId (the passes re-check it per row).
import { retryApprovedPayouts } from "./payout_retry.ts";
import { SWEEP_MAX_AGE_MS, sweepStuckPayouts, type TransferLookup } from "./payout_sweep.ts";
import type { EntStore } from "./store.ts";
import type { Payout, PayoutProvider } from "./types.ts";

export interface TickCounts { resumed: number; paid: number; retried: number; held: number; permanent_failed: number; skipped: number; errors: number }
export interface TickOpts {
  lookup?: TransferLookup;      // for the sweep; falls back to transferAdapter.lookup if it has one; none = sweep not run (stuck rows wait)
  maxRows?: number;             // default 50, hard cap 500
  maxAgeMs?: number;            // sweep age gate, default 15 minutes
  maxAttempts?: number;         // retry bound, default 3
  tenantId?: string;
  log?: (line: string) => void;
}
export interface TickResult { ok: boolean; counts: TickCounts; rowsRead: number; bounded: boolean; sweepRan: boolean }

export const TICK_DEFAULT_MAX_ROWS = 50;
export const TICK_HARD_MAX_ROWS = 500;

const zero = (): TickCounts => ({ resumed: 0, paid: 0, retried: 0, held: 0, permanent_failed: 0, skipped: 0, errors: 0 });
const age = (p: Payout) => p.sendingAt ?? p.createdAt;

// A store view that hands the passes at most `budget` rows in total (oldest first) and hides rows this tick already retried.
function bounded(store: EntStore, now: number, maxRows: number) {
  const st = { left: maxRows, read: 0, cut: false };
  const view = new Proxy(store, {
    get(t, prop, recv) {
      if (prop !== "payoutsByStatus") { const v = Reflect.get(t, prop, t); return typeof v === "function" ? v.bind(t) : v; }
      return async (status: Payout["status"], partnerId?: string) => {
        const all = (await t.payoutsByStatus(status, partnerId)).filter((p) => !(status === "approved_retry" && p.tickAt === now));
        all.sort((a, b) => age(a) - age(b) || a.id.localeCompare(b.id));
        const take = all.slice(0, Math.max(0, st.left));
        if (take.length < all.length) st.cut = true;
        st.left -= take.length; st.read += take.length;
        return take;
      };
    },
  }) as EntStore;
  return { view, st };
}

export async function runPayoutTick(store: EntStore, transferAdapter: PayoutProvider, now: number, opts: TickOpts = {}): Promise<TickResult> {
  const counts = zero();
  const log = (l: string) => { try { opts.log?.(l); } catch { /* a broken logger never breaks the tick */ } };
  const res = (b: ReturnType<typeof bounded>["st"], sweepRan: boolean): TickResult => ({ ok: counts.errors === 0, counts, rowsRead: b.read, bounded: b.cut, sweepRan });
  const rawMax = opts.maxRows;
  const maxRows = Number.isInteger(rawMax) && (rawMax as number) >= 0 ? Math.min(rawMax as number, TICK_HARD_MAX_ROWS) : TICK_DEFAULT_MAX_ROWS;
  const { view, st } = bounded(store, now, maxRows);
  const tenantId = typeof opts.tenantId === "string" && opts.tenantId !== "" ? opts.tenantId : undefined;
  const lookup = opts.lookup ?? (typeof (transferAdapter as Partial<TransferLookup>).lookup === "function" ? (transferAdapter as unknown as TransferLookup) : undefined);

  let sweepRan = false;
  if (lookup) {
    sweepRan = true;
    try {
      const s = await sweepStuckPayouts({ store: view, lookup, now, tenantId }, opts.maxAgeMs ?? SWEEP_MAX_AGE_MS);
      counts.skipped += s.skippedYoung;
      for (const i of s.items) {
        if (i.action === "lost_race") { counts.skipped++; continue; }
        counts.resumed++;
        if (i.action === "paid") counts.paid++;
        else if (i.action === "held") counts.held++;
      }
    } catch (e) { counts.errors++; log(`payout_tick sweep_error ${errName(e)}`); }
  } else log("payout_tick sweep_skipped no_lookup");

  try {
    const maxAttempts = Number.isInteger(opts.maxAttempts) && (opts.maxAttempts as number) >= 1 ? (opts.maxAttempts as number) : 3;
    const r = await retryApprovedPayouts(view, transferAdapter, now, maxAttempts, tenantId);
    for (const i of r.items) {
      if (i.action === "lost_race") counts.skipped++;
      else if (i.action === "paid") counts.paid++;
      else if (i.action === "approved_retry") {
        counts.retried++;
        try { const p = await store.payoutById(i.payoutId); if (p && p.status === "approved_retry" && (tenantId === undefined || p.partnerId === tenantId)) await store.putPayout({ ...p, tickAt: now }); }
        catch (e) { counts.errors++; log(`payout_tick mark_error ${errName(e)}`); }
      } else if (i.reason?.startsWith("permanent_")) counts.permanent_failed++;
      else counts.held++;
    }
  } catch (e) { counts.errors++; log(`payout_tick retry_error ${errName(e)}`); }
  log(`payout_tick ${JSON.stringify(counts)} rows=${st.read}`);
  return res(st, sweepRan);
}
const errName = (e: unknown) => (e instanceof Error ? e.name : "non_error");
