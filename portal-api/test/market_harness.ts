import { make } from "./harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { makeMarketStore } from "./store_switch.ts";
import { MockPayments } from "../src/market/payments.ts";
import { MemorySeatEntitlements, type SubStatus } from "../src/market/entitlements.ts";
import { healthy } from "./owner_harness.ts";

export const INTERNAL = "internal_test_secret";
// A domain with one planted fault: SPF soft-fail (WARN). Pros "fix" it by editing the zone; nothing else changes.
export const faulty = (d: string) => { const w = healthy(d); w.txt![d] = ["v=spf1 include:_spf.google.com ~all"]; return w; };
export const FIXED_SPF = "v=spf1 include:_spf.google.com -all";

export function rig() {
  const h = make();
  const zones = new Map<string, MemoryZone>();
  const store = makeMarketStore(), payments = new MockPayments(), seats = new MemorySeatEntitlements();   // SYNTHETIC subscription records
  h.deps.market = { store, payments, seats, doh: (dom) => { const z = zones.get(dom); if (!z) throw new Error("no zone " + dom); return z.doh; }, internalSecret: INTERNAL };
  const zone = (dom: string, w = faulty(dom)) => { const z = new MemoryZone(w); zones.set(dom, z); return z; };
  const fix = (dom: string) => { zones.get(dom)!.world.txt![dom] = [FIXED_SPF]; };
  const unfix = (dom: string) => { zones.get(dom)!.world.txt![dom] = ["v=spf1 include:_spf.google.com ~all"]; };
  async function owner(email: string, dom: string) {
    zone(dom); const me = await h.login(email); const { d } = await h.verifiedDomain(me.session, dom);
    return { ...me, domainId: d.id as string, domain: dom };
  }
  async function pro(email: string, o: { onboard?: boolean; plan?: string; sub?: { status: SubStatus; paidThroughMs: number } } = {}) {
    const me = await h.login(email);
    await h.req("POST", "/pro/join", { token: me.session, body: { acceptTerms: true, plan: o.plan } });   // plan is a forgeable client field: the server must ignore it
    if (o.sub) seats.set({ accountId: me.account.id, ...o.sub });
    if (o.onboard !== false) { await h.req("POST", "/pro/onboarding", { token: me.session }); payments.ready.add(`acct_mock_${me.account.id.slice(0, 12)}`); await h.req("POST", "/pro/onboarding/refresh", { token: me.session }); }
    return me;
  }
  async function hire(o: { session: string; domainId: string }, check = "SPF", fund = true) {
    const r = await h.j(await h.req("POST", "/market/jobs", { token: o.session, body: { domainId: o.domainId, check } }));
    if (fund && r.job) await fundJob(r.job.id);
    return r;
  }
  async function fundJob(id: string, opts: { amount?: number; evId?: string } = {}) {
    const job = (await store.getJob(id))!;
    return h.webhook("checkout.session.completed", { id: job.checkoutId, payment_status: "paid", payment_intent: `pi_${id}`, amount_total: opts.amount ?? job.priceCents, metadata: { market_job_id: id } }, { id: opts.evId });
  }
  const claim = (s: string, id: string) => h.req("POST", `/pro/jobs/${id}/claim`, { token: s });
  const deliver = (s: string, id: string, note = "Changed SPF to hard fail") => h.req("POST", `/pro/jobs/${id}/deliver`, { token: s, body: { note } });
  const internal = (method: string, path: string, body?: unknown, secret = INTERNAL) => h.req(method, path, { headers: { "x-internal-secret": secret }, body });
  return { h, zones, store, payments, seats, zone, fix, unfix, owner, pro, hire, fundJob, claim, deliver, internal };
}
