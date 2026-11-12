// Owner-seat HTTP service: session-authenticated, domain-scoped, one account never sees another's domain.
import { HttpError, type Deps } from "../service.ts";
import type { Account } from "../store.ts";
import { PRODUCTS } from "../catalogue.ts";
import { autoFix, loadOrInit, monitorTick, overview, report, scanNow, setMonitor, undoFix, casTx, OwnerConflictError, type Ctx, type DomainState } from "./engine.ts";

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
// F185: every mutation is load, mutate, compare-and-set on the store's per-domain revision (casTx); a lost race re-runs on a fresh load.
// f368: `rejected(out)` is true when the body refused the request BEFORE mutating anything (undoFix and autoFix return ok:false first); that outcome is
// not written, so a rejected request leaves the rev and every row as it found them.
async function tx<T>(d: Deps, a: Account, id: string, f: (c: Ctx, s: DomainState) => Promise<T>, rejected: (out: T) => boolean = () => false) {
  try { const r = await casTx(ctxOf(d), async () => { const { c, s } = await open(d, a, id); const out = await f(c, s); return { s, out, write: !rejected(out) }; }); return { s: r.s, out: r.out }; }
  catch (e) { if (e instanceof OwnerConflictError) throw new HttpError(409, "state_conflict_retry"); throw e; }
}
export async function scan(d: Deps, a: Account, id: string) {
  const { s } = await tx(d, a, id, async (c, s) => {
    if (s.lastScan && d.now() - s.lastScan.at < MIN_MANUAL_SCAN_GAP_MS) throw new HttpError(429, "scan_too_soon");
    await scanNow(c, s, "owner scan");
  });
  return overview(s, d.now());
}
export async function fix(d: Deps, a: Account, id: string, check: unknown) {
  if (typeof check !== "string" || !/^[A-Z-]{2,8}$/.test(check)) throw new HttpError(400, "invalid_check");
  const { s, out: r } = await tx(d, a, id, (c, s) => autoFix(c, s, check), (r) => !r.ok && (r.reason === "unknown_check" || r.reason === "not_open" || r.reason === "no_zone"));
  return { result: r.ok ? r.result : r.reason, detail: r.ok ? r.fix.note : r.detail, plan: r.plan ? { auto: r.plan.auto, summary: r.plan.summary, edits: r.plan.edits.map((e) => ({ name: e.name, before: e.before, after: e.after })) } : null, fixId: r.ok ? r.fix.id : r.fix?.id ?? null, overview: overview(s, d.now()) };
}
export async function undo(d: Deps, a: Account, id: string, fixId: string) {
  // f367: an unknown fix id is rejected BEFORE the CAS write; a rejected request must not bump the domain's revision (route fuzz: STATE CHANGED on a 404)
  if (!(await open(d, a, id)).s.fixes.some((x) => x.id === fixId)) throw new HttpError(404, "no_such_fix");
  const { s, out: r } = await tx(d, a, id, (c, s) => undoFix(c, s, fixId), (r) => !r.ok);
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
