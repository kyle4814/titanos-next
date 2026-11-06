// Owner-seat HTTP service: session-authenticated, domain-scoped, one account never sees another's domain.
import { HttpError, type Deps } from "../service.ts";
import type { Account } from "../store.ts";
import { PRODUCTS } from "../catalogue.ts";
import { autoFix, loadOrInit, monitorTick, overview, report, scanNow, setMonitor, undoFix, type Ctx, type DomainState } from "./engine.ts";

const MIN_MANUAL_SCAN_GAP_MS = 60_000; // abuse guard: one manual scan per domain per minute
const ctxOf = (d: Deps): Ctx => {
  if (!d.owner) throw new HttpError(503, "owner_seat_unavailable");
  return { store: d.owner.store, doh: d.owner.doh, zones: d.owner.zones, now: d.now };
};
async function mine(d: Deps, a: Account, id: string) {
  const row = await d.store.domainById(id);
  if (!row || row.accountId !== a.id) throw new HttpError(404, "not_found");
  if (!row.verifiedAt) throw new HttpError(403, "domain_not_verified");
  return row;
}
// The monitor is on while this account holds a live monitor subscription for this domain.
export async function monitorEntitled(d: Deps, a: Account, domain: string): Promise<boolean> {
  const subs = await d.store.subscriptionsFor(a.id);
  for (const s of subs) {
    if (s.cancelledAt && s.cancelledAt <= d.now()) continue;
    if (PRODUCTS[s.productId]?.kind !== "monitor") continue;
    const p = await d.store.purchaseById(s.purchaseId);
    if (p?.domain === domain && p.status === "paid") return true;
  }
  return false;
}
async function open(d: Deps, a: Account, id: string): Promise<{ c: Ctx; s: DomainState }> {
  const row = await mine(d, a, id); const c = ctxOf(d);
  const s = await loadOrInit(c, row.id, row.domain, a.id, true);
  setMonitor(s, await monitorEntitled(d, a, row.domain), d.now());
  return { c, s };
}
export async function listDomains(d: Deps, a: Account) {
  const c = ctxOf(d); const out = [];
  for (const row of (await d.store.domainsFor(a.id)).filter((x) => x.verifiedAt)) {
    const s = (await c.store.get(row.id)) ?? (await loadOrInit(c, row.id, row.domain, a.id, true));
    out.push({ id: row.id, domain: row.domain, level: s.level, levelName: s.levelName, badge: s.badge ?? null, openQuests: Object.values(s.findings).filter((f) => f.state === "OPEN" || f.state === "REGRESSED").length, lastScanAt: s.lastScan?.at ?? null });
  }
  return { domains: out };
}
export async function getOverview(d: Deps, a: Account, id: string) { const { c, s } = await open(d, a, id); await c.store.put(s); return overview(s, d.now()); }
export async function scan(d: Deps, a: Account, id: string) {
  const { c, s } = await open(d, a, id);
  if (s.lastScan && d.now() - s.lastScan.at < MIN_MANUAL_SCAN_GAP_MS) throw new HttpError(429, "scan_too_soon");
  await scanNow(c, s, "owner scan"); await c.store.put(s); return overview(s, d.now());
}
export async function fix(d: Deps, a: Account, id: string, check: unknown) {
  if (typeof check !== "string" || !/^[A-Z-]{2,8}$/.test(check)) throw new HttpError(400, "invalid_check");
  const { c, s } = await open(d, a, id);
  const r = await autoFix(c, s, check); await c.store.put(s);
  return { result: r.ok ? r.result : r.reason, detail: r.ok ? r.fix.note : r.detail, plan: r.plan ? { auto: r.plan.auto, summary: r.plan.summary, edits: r.plan.edits.map((e) => ({ name: e.name, before: e.before, after: e.after })) } : null, fixId: r.ok ? r.fix.id : r.fix?.id ?? null, overview: overview(s, d.now()) };
}
export async function undo(d: Deps, a: Account, id: string, fixId: string) {
  const { c, s } = await open(d, a, id);
  const r = await undoFix(c, s, fixId); await c.store.put(s);
  if (!r.ok) throw new HttpError(r.reason === "no_such_fix" ? 404 : 409, r.reason!);
  return overview(s, d.now());
}
export async function getReport(d: Deps, a: Account, id: string) { const { s } = await open(d, a, id); return report(s, d.now()); }
// Run by the scheduler (a Worker cron trigger, owner-approved deploy). Mails the owner on a fault returning.
export async function runMonitor(d: Deps) {
  const c = ctxOf(d); const t = await monitorTick(c);
  for (const al of t.alerts) {
    const acct = await d.store.accountById(al.accountId);
    if (acct && !acct.deletedAt) await d.mailer.send(acct.email, `${al.domain}: ${al.kind === "badge_lost" ? "a fault returned and your badge was lost" : "a fixed problem has returned"}`, `${al.detail}\n\nOpen ${d.siteOrigin}/app to see the proof and the one-tap fix. You can undo anything we change.`);
  }
  return t;
}
