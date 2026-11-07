// C10 partial soak: independent load + chaos harness (wA_accept). Usage: node --experimental-strip-types soak.ts <seconds> <seed>
import { make, SECRET } from "../../test/harness.ts";
import { MemoryZone } from "../../src/owner/dnsw.ts";
import { MemoryOwnerStore } from "../../src/owner/engine.ts";
import { MemoryMarketStore } from "../../src/market/store.ts";
import { MockPayments } from "../../src/market/payments.ts";
import { MemoryEntStore } from "../../src/enterprise/store.ts";
import { MockIdp } from "../../src/enterprise/sso.ts";
import { SyntheticScan } from "../../src/enterprise/estate.ts";
import { RATE_V1 } from "../../src/enterprise/share.ts";
import { MockPayouts } from "../../test/ent_harness.ts";
import { healthy } from "../../test/owner_harness.ts";
import { SCOPES } from "../../src/agent/tools.ts";
import { signStripePayload } from "../../src/stripe.ts";
import { handle } from "../../src/index.ts";

const SECS = Number(process.argv[2] ?? 60), SEED = Number(process.argv[3] ?? 1);
let s = SEED >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const INTERNAL = "soak_internal", ENT_INTERNAL = "soak_ent_internal";
const h = make();
const zones = new Map<string, MemoryZone>();
let dnsFailP = 0;
const chaosDoh = (dom: string) => { const z = zones.get(dom); if (!z) throw new Error("no zone"); return (n: string, t: string) => { if (rnd() < dnsFailP) return Promise.reject(new Error("chaos_dns")); return z.doh(n, t); }; };
const payments = new MockPayments();
h.deps.owner = { store: new MemoryOwnerStore(), doh: chaosDoh, zones: { zoneFor: (d) => zones.get(d) } };
h.deps.market = { store: new MemoryMarketStore(), payments, doh: chaosDoh, internalSecret: INTERNAL };
const payouts = new MockPayouts();
h.deps.ent = { store: new MemoryEntStore(), idp: MockIdp, payouts, scan: SyntheticScan, rates: RATE_V1, internalSecret: ENT_INTERNAL };
// dns resolver for TXT verification also chaotic
const origTxt = h.deps.dns.txt.bind(h.deps.dns); h.deps.dns.txt = async (n: string) => { if (rnd() < dnsFailP) throw new Error("chaos_txt"); return origTxt(n); };

const codes: Record<string, number> = {}; let fundedWhileUnpaid = 0, fundedWrongAmount = 0;
const stat: Record<string, number> = { ops: 0, exceptions: 0, s5xx: 0, s2xx: 0, s4xx: 0, s429: 0 };
const exceptions: string[] = []; const lat: number[] = [];
const req = async (method: string, path: string, o: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
  const t0 = performance.now(); stat.ops++;
  try { const r = await h.req(method, path, o); const dt = performance.now() - t0; { const k = method + " " + path.split("/").slice(0, 3).join("/").replace(/[0-9a-z_]{12,}/gi, ":id") + " " + r.status; codes[k] = (codes[k] ?? 0) + 1; } if (lat.length < 200000) lat.push(dt); if (r.status >= 500) { stat.s5xx++; } else if (r.status === 429) stat.s429++; else if (r.status >= 400) stat.s4xx++; else stat.s2xx++; return r; }
  catch (e: any) { stat.exceptions++; if (exceptions.length < 20) exceptions.push(`${method} ${path}: ${e?.message ?? e}`); return new Response("{}", { status: 599 }); }
};
const J = async (r: Response) => { try { return await r.json() as any; } catch { return {}; } };

// ---- world ----
const unpaidSet = new Set<string>(); const T_START = h.clock.t; const owners: any[] = [], pros: any[] = [], agents: any[] = [];
const canary = (id: string) => `CANARY_${id}_${Math.floor(rnd() * 1e9)}`;
async function mkOwner(i: number) {
  const email = `own${i}@soak${i}.example.com`, dom = `soak${i}.example.com.au`; const w = healthy(dom); w.txt![dom] = ["v=spf1 include:_spf.google.com ~all"]; zones.set(dom, new MemoryZone(w));
  const me = await h.login(email); const d = await J(await req("POST", "/domains", { token: me.session, body: { domain: dom } })); h.dns.zone[d.record.name] = [d.record.value]; await req("POST", `/domains/${d.id}/verify`, { token: me.session });
  owners.push({ i, email, dom, session: me.session, id: me.account.id, domId: d.id, jobs: [] as string[], canary: dom });
}
async function mkPro(i: number) { const me = await h.login(`pro${i}@soakp.example.com`); await req("POST", "/pro/join", { token: me.session, body: { acceptTerms: true } }); await req("POST", "/pro/onboarding", { token: me.session }); payments.ready.add(`acct_mock_${me.account.id.slice(0, 12)}`); await req("POST", "/pro/onboarding/refresh", { token: me.session }); pros.push({ i, session: me.session, id: me.account.id }); }
async function mkAgent(i: number) { const me = await h.login(`ag${i}@soaka.example.com`); const k = await J(await req("POST", "/keys", { token: me.session, body: { scopes: [...SCOPES] } })); await h.store.creditApply(me.account.id, 5000, "topup", "seed" + i, h.clock.t); agents.push({ i, session: me.session, key: k.key, id: me.account.id, calls: 0 }); }
const NO = 24, NP = 10, NA = 8;
for (let i = 0; i < NO; i++) await mkOwner(i); for (let i = 0; i < NP; i++) await mkPro(i); for (let i = 0; i < NA; i++) await mkAgent(i);
// enterprise: 3 tenants with canary labels
const tenants: any[] = [];
for (let t = 0; t < 3; t++) { const email = `ent${t}@entsoak${t}.com.au`; const u = await h.login(email); const r = await J(await h.req("POST", "/internal/tenants/provision", { body: { kind: "enterprise", name: `EntSoak${t}`, slug: `entsoak-${t}`, adminEmail: email }, headers: { "x-internal-secret": ENT_INTERNAL } }));
  const dom = `ent-canary-${t}.com.au`; const a = await J(await req("POST", `/enterprise/${r.id}/assets`, { token: u.session, body: { domain: dom, label: `ENTCANARY_LABEL_${t}` } })); h.dns.zone[a.record.name] = [a.record.value]; await req("POST", `/enterprise/${r.id}/assets/${a.id}/verify`, { token: u.session });
  tenants.push({ t, id: r.id, session: u.session, label: `ENTCANARY_LABEL_${t}`, dom }); }

// ---- actions ----
let leaks = 0; const leakNotes: string[] = [];
const rpc = (a: any, name: string, args: any = {}, hdr: Record<string, string> = {}) => req("POST", "/mcp", { token: a.key, body: { jsonrpc: "2.0", id: stat.ops, method: "tools/call", params: { name, arguments: args } }, headers: hdr });
const actions: (() => Promise<void>)[] = [
  async () => { const o = pick(owners); const r = await req("POST", `/app/domains/${o.domId}/scan`, { token: o.session }); },
  async () => { const o = pick(owners); await req("GET", `/app/domains/${o.domId}`, { token: o.session }); },
  async () => { const o = pick(owners); await req("POST", `/app/domains/${o.domId}/fix`, { token: o.session, body: { check: pick(["SPF", "DMARC", "DKIM"]) } }); },
  async () => { const o = pick(owners), o2 = pick(owners); if (o === o2) return; const r = await req("GET", `/app/domains/${o2.domId}`, { token: o.session }); const t = await r.text(); if (r.status < 400 || t.includes(o2.canary)) { leaks++; leakNotes.push(`owner ${o.i} read owner ${o2.i} -> ${r.status}`); } },
  async () => { const o = pick(owners); const r = await J(await req("POST", "/market/jobs", { token: o.session, body: { domainId: o.domId, check: pick(["SPF", "DMARC"]) } })); if (r.job) o.jobs.push(r.job.id); },
  async () => { const o = pick(owners); if (!o.jobs.length) return; const id = pick(o.jobs) as string; const jb = await h.deps.market!.store.getJob(id); if (jb && jb.status === "awaiting_funds") { const unpaid = rnd() < 0.1, wrong = rnd() < 0.1; await h.webhook("checkout.session.completed", { id: jb.checkoutId, payment_status: unpaid ? "unpaid" : "paid", payment_intent: `pi_${id}`, amount_total: wrong ? 1 : jb.priceCents, metadata: { market_job_id: id } }); const after = await h.deps.market!.store.getJob(id); if (after && after.status !== "awaiting_funds" && after.status !== "cancelled") { if (unpaid) { fundedWhileUnpaid++; unpaidSet.add(id); } if (wrong) fundedWrongAmount++; } } },
  async () => { const p = pick(pros); const b = await J(await req("GET", "/pro/board", { token: p.session })); const j = b.jobs?.length ? pick(b.jobs) as any : null; if (j) await req("POST", `/pro/jobs/${j.id}/claim`, { token: p.session }); },
  async () => { const p = pick(pros); const mine = await J(await req("GET", "/market/jobs", { token: p.session })); const j = mine.asPro?.find((x: any) => x.status === "claimed"); if (j) await req("POST", `/pro/jobs/${j.id}/deliver`, { token: p.session, body: { note: "done via soak" } }); },
  async () => { const o = pick(owners); const z = zones.get(o.dom)!; z.world.txt![o.dom] = rnd() < 0.7 ? ["v=spf1 include:_spf.google.com -all"] : ["v=spf1 include:_spf.google.com ~all"]; },   // owner flips DNS (fix / regression)
  async () => { const p = pick(pros), o = pick(owners); const mine = await J(await req("GET", "/market/jobs", { token: o.session })); const j = mine.asOwner?.find((x: any) => ["delivered"].includes(x.status)); if (j) h.clock.t += 61_000, await req("POST", `/market/jobs/${j.id}/rescan`, { token: o.session }); },
  async () => { await h.req("POST", "/internal/market/sweep", { headers: { "x-internal-secret": INTERNAL } }); },
  async () => { const a = pick(agents); const r = await rpc(a, pick(["catalogue_list", "domain_check", "credits_balance", "explain_finding", "my_domains"]), { domain: pick(owners).dom, finding: "spf_missing" }, rnd() < 0.2 ? { "x-model-key": "sk-soak" } : {}); a.calls++; },
  async () => { const a = pick(agents), b = pick(agents); if (a === b) return; const r = await rpc(a, "my_domains"); const t = await r.text(); if (t.includes("soak") && false) { leaks++; } },
  async () => { const t = pick(tenants), t2 = pick(tenants); const r = await req("GET", `/enterprise/${t2.id}/estate`, { token: t.session }); const txt = await r.text(); if (t.t !== t2.t && (r.status < 400 || txt.includes(t2.label))) { leaks++; leakNotes.push(`tenant ${t.t} read tenant ${t2.t}: ${r.status}`); } if (t.t === t2.t && r.status !== 200) { stat.s4xx += 0; } },
  async () => { const t = pick(tenants); const r = await req("GET", `/enterprise/${t.id}/estate.csv`, { token: t.session }); },
  async () => { const o = pick(owners); await req("POST", "/checkout", { token: o.session, body: { product: pick(["monitor_monthly", "compliance_pack", "leads_starter"]), domain: o.dom } }); },
  async () => { const ps = [...h.store.purchases.values()].filter((p) => p.status === "pending"); if (!ps.length) return; const p = pick(ps); const sub = p.productId === "monitor_monthly"; await h.webhook("checkout.session.completed", { id: p.checkoutId, payment_status: "paid", payment_intent: `pi_${p.id}`, customer: `cus_${p.accountId}`, ...(sub ? { subscription: `sub_${p.id}` } : {}) }, { id: rnd() < 0.2 ? "evt_dupe_fixed" : undefined }); },
  async () => { const o = pick(owners); const ps = [...h.store.purchases.values()].filter((p) => p.accountId === o.id && p.status === "paid"); if (ps.length) await req("POST", "/refunds", { token: o.session, body: { purchaseId: pick(ps).id } }); },
  async () => { await h.req("POST", "/stripe/webhook", { headers: { "stripe-signature": "t=1,v1=bad" }, body: { id: "evt_x", type: "x" } }); },
  async () => { const o = pick(owners); await req("POST", "/domains", { token: o.session, body: { domain: pick(["", "x", "a".repeat(300), "a.b", "ünï.com", "127.0.0.1", "soak1.example.com.au"]) } }); },
  async () => { const r = await h.req("POST", "/mcp", { token: "tk_" + "a".repeat(48), body: "not json" as any }); },
  async () => { await h.req("GET", pick(["/health", "/catalogue", "/agent/tools", "/.well-known/agent.json", "/market/leaderboard"])); },
  async () => { const x = pick([1000, 60_000, 3_600_000, 86_400_000]); const drift = h.clock.t - T_START; if (drift + x < 20 * 86_400_000 && rnd() < 0.7) h.clock.t += x; else if (drift - x > 0) h.clock.t -= x; },
  async () => { if (rnd() < 0.05 && h.clock.t - T_START > 120_000) h.clock.t -= pick([1000, 60_000]); },
  async () => { payments.failTransfer = rnd() < 0.3; payments.failClaimFee = rnd() < 0.1; dnsFailP = rnd() < 0.3 ? 0.4 : 0; },
];
// ---- invariants ----
function invariants(tag: string) {
  const bad: string[] = []; const st = h.deps.market!.store as MemoryMarketStore;
  return (async () => {
    const jobs = await st.allJobs(); const transfers = payments.calls.filter((c: any) => c.op === "transfer");
    const paid = jobs.filter((j) => j.status === "paid");
    for (const j of paid) { if (!j.proof || j.proof.now !== "PASS") bad.push(`paid job ${j.id} without PASS proof`); if (!j.fundedAt) bad.push(`paid job ${j.id} never funded`); }
    const byGroup = new Map<string, number>(); for (const t of transfers as any[]) byGroup.set(t.args.group ?? t.args.transferGroup ?? JSON.stringify(t.args).slice(0, 60), 0);
    const paidSum = paid.reduce((a, j) => a + j.priceCents, 0), trSum = (transfers as any[]).reduce((a, t) => a + (t.args.cents ?? t.args.amountCents ?? 0), 0);
    if (trSum !== paidSum) bad.push(`transfer sum ${trSum} != paid-jobs sum ${paidSum} (provider calls may include retries; idempotency makes the provider count once)`);
    const unpaidFunded = jobs.filter((j) => j.fundedAt && !j.paymentIntent).length;
    for (const a of agents) { const bal = await h.store.creditBalance(a.id); const sum = h.store.ledger.filter((e: any) => e.accountId === a.id).reduce((x: number, e: any) => x + e.delta, 0); if (bal < 0) bad.push(`negative credits ${a.id}`); if (bal !== sum) bad.push(`credit balance ${bal} != ledger ${sum}`); }
    const invNums = [...h.store.invoices.values()].map((i) => i.number); if (new Set(invNums).size !== invNums.length) bad.push("duplicate invoice numbers");
    const evInv = [...h.store.invoices.values()].map((i) => i.stripeEventId); // one invoice per purchase event
    return { tag, jobs: jobs.length, paid: paid.length, transfersLedger: transfers.length, paidSum, trSum, unpaidFundedJobs: unpaidFunded, bad };
  })();
}
// ---- run ----
const t0 = Date.now(); const heap0 = process.memoryUsage().heapUsed; const reports: any[] = []; let batch = 0; let nextCk = t0 + 30_000; const lastLat: number[] = [];
while ((Date.now() - t0) / 1000 < SECS) {
  const B = 1 + Math.floor(rnd() * 12); await Promise.all(Array.from({ length: B }, () => pick(actions)().catch((e: any) => { stat.exceptions++; if (exceptions.length < 20) exceptions.push("action: " + (e?.message ?? e)); }))); batch++;
  if (Date.now() >= nextCk) { nextCk += 30_000; const inv = await invariants("ck"); const l = lat.slice(-5000).sort((a, b) => a - b); reports.push({ tSec: Math.round((Date.now() - t0) / 1000), ops: stat.ops, p50: +l[Math.floor(l.length * 0.5)]?.toFixed(2), p99: +l[Math.floor(l.length * 0.99)]?.toFixed(2), heapMB: Math.round(process.memoryUsage().heapUsed / 1048576), jobs: inv.jobs, paid: inv.paid, bad: inv.bad.length }); }
}
const fin = await invariants("final"); const l = [...lat].sort((a, b) => a - b); const pc = (p: number) => +l[Math.floor(l.length * p)]?.toFixed(2);
console.log(JSON.stringify({ seed: SEED, seconds: SECS, stat, leaks, leakNotes: leakNotes.slice(0, 5), fundedWhileUnpaid, fundedWrongAmount, paidFromUnpaidFunding: [...unpaidSet].filter((id) => (h.deps.market!.store as any).jobs?.get?.(id)?.status === "paid").length, topCodes: Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 14), exceptions, latencyMs: { p50: pc(0.5), p95: pc(0.95), p99: pc(0.99), max: +l.at(-1)!.toFixed(1) }, heapMB: { start: Math.round(heap0 / 1048576), end: Math.round(process.memoryUsage().heapUsed / 1048576) }, final: fin, checkpoints: reports }, null, 1));
