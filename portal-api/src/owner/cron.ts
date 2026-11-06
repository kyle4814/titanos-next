// Scheduled monitor handler (f14). Pure: no globals, no wrangler config. A Worker cron trigger (owner-approved,
// GATE5, not set here) calls scheduled(event, deps). It selects due domains that still hold a PAID monitor
// subscription, runs each through the existing runMonitor/monitorTick path, and fails closed.
import type { Deps } from "../service.ts";
import { type DomainState, type OwnerStore } from "./engine.ts";
import { monitorEntitled, runMonitor } from "./service.ts";
import { setMonitor } from "./engine.ts";

export const DEFAULT_MAX_DOMAINS_PER_RUN = 50;
export const DEFAULT_TIME_BUDGET_MS = 20_000;
export interface CronOpts { maxDomains?: number; timeBudgetMs?: number; log?: (e: CronLog) => void }
export interface CronLog { at: number; level: "info" | "warn" | "error"; reason: string; domain?: string; detail?: string }
export interface CronResult {
  ran: boolean; reason: "ok" | "duplicate_fire" | "owner_seat_unavailable" | "owner_store_unavailable" | "entitlement_store_unavailable";
  due: number; scanned: number; alerts: number; skippedUnpaid: number; skippedCap: number; skippedBudget: number; failed: { domain: string; error: string }[];
}
const empty = (reason: CronResult["reason"], ran = false): CronResult => ({ ran, reason, due: 0, scanned: 0, alerts: 0, skippedUnpaid: 0, skippedCap: 0, skippedBudget: 0, failed: [] });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

// A one-domain window onto the owner store, so monitorTick (which loops over all()) can only touch that domain.
class OneDomain implements OwnerStore {
  base: OwnerStore; s: DomainState;
  constructor(base: OwnerStore, s: DomainState) { this.base = base; this.s = s; }
  async get(id: string) { return this.base.get(id); }
  async put(s: DomainState) { return this.base.put(s); }
  async all() { return [this.s]; }
}

export async function scheduled(event: { scheduledTime?: number; cron?: string }, d: Deps, opts: CronOpts = {}): Promise<CronResult> {
  const log = opts.log ?? ((e: CronLog) => console.log(JSON.stringify({ svc: "monitor-cron", ...e })));
  const note = (level: CronLog["level"], reason: string, domain?: string, detail?: string) => log({ at: d.now(), level, reason, domain, detail });
  const cap = Math.max(0, opts.maxDomains ?? DEFAULT_MAX_DOMAINS_PER_RUN), budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const start = d.now();
  if (!d.owner) { note("error", "owner_seat_unavailable"); return empty("owner_seat_unavailable"); }
  const owner = d.owner;

  let all: DomainState[];
  try { all = await owner.store.all(); } catch (e) { note("error", "owner_store_unavailable", undefined, msg(e)); return empty("owner_store_unavailable"); }

  // Same tick delivered twice (or two workers racing): only the first claim runs. Fails closed if the claim store is down.
  const tickId = `cron:monitor:${event.scheduledTime ?? Math.floor(start / 60_000) * 60_000}`;
  try { if (!(await d.store.claimEvent(tickId))) { note("info", "duplicate_fire", undefined, tickId); return empty("duplicate_fire"); } }
  catch (e) { note("error", "entitlement_store_unavailable", undefined, msg(e)); return empty("entitlement_store_unavailable"); }

  const due = all.filter((s) => s.monitor.active && s.monitor.nextScanAt !== undefined && s.monitor.nextScanAt <= start)
    .sort((a, b) => a.monitor.nextScanAt! - b.monitor.nextScanAt! || a.domainId.localeCompare(b.domainId)); // longest overdue first
  const r = empty("ok", true); r.due = due.length;

  let attempted = 0; // domains actually sent to a scan; unpaid skips cost nothing
  for (let i = 0; i < due.length; i++) {
    const s = due[i];
    if (attempted >= cap) { r.skippedCap = due.length - i; note("warn", "cap_hit", undefined, `cap ${cap}, ${r.skippedCap} left for the next tick`); break; }
    if (d.now() - start >= budget) { r.skippedBudget = due.length - i; note("warn", "time_budget_hit", undefined, `budget ${budget} ms, ${r.skippedBudget} left for the next tick`); break; }
    try {
      const acct = await d.store.accountById(s.accountId);
      if (!acct || acct.deletedAt || !(await monitorEntitled(d, acct, s.domain))) {
        // No paid monitor subscription any more: switch the schedule off so it is not re-selected every tick.
        const cur = (await owner.store.get(s.domainId)) ?? s; setMonitor(cur, false, d.now()); await owner.store.put(cur);
        r.skippedUnpaid++; note("info", "unpaid_skipped", s.domain); continue;
      }
    } catch (e) { r.failed.push({ domain: s.domain, error: `entitlement: ${msg(e)}` }); note("error", "entitlement_check_failed", s.domain, msg(e)); continue; }
    attempted++;
    try {
      const t = await runMonitor({ ...d, owner: { ...owner, store: new OneDomain(owner.store, s) } });
      r.scanned += t.scanned; r.alerts += t.alerts.length;
    } catch (e) { r.failed.push({ domain: s.domain, error: msg(e) }); note("error", "domain_failed", s.domain, msg(e)); }
  }
  note("info", "run_done", undefined, JSON.stringify({ due: r.due, scanned: r.scanned, alerts: r.alerts, unpaid: r.skippedUnpaid, cap: r.skippedCap, budget: r.skippedBudget, failed: r.failed.length }));
  return r;
}

// Worker entry. Deps cannot be built from Env until the D1 Store and D1 owner store exist (not built: BACKEND_DECISION),
// so today this logs the reason and does nothing. When the adapters land, pass them as `deps` and nothing else changes.
export async function workerScheduled(event: { scheduledTime?: number; cron?: string }, _env: unknown, deps?: Deps, opts: CronOpts = {}): Promise<CronResult> {
  if (!deps) { (opts.log ?? ((e) => console.log(JSON.stringify({ svc: "monitor-cron", ...e }))))({ at: Date.now(), level: "error", reason: "owner_store_unavailable", detail: "no D1 adapters wired; failing closed" }); return empty("owner_store_unavailable"); }
  return scheduled(event, deps, opts);
}
