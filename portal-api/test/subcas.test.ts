import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, seeded } from "./fake_d1.ts";

// C2 every subscription writer is compare-and-set (f183, extends f175). SYNTHETIC labelled fixtures only (example.invalid, sub_syn).
// Each schedule fires 2..4 CONCURRENT writers at one subscription: changePlan (upgrade/downgrade/keep/cancel), cancelSubscription,
// a customer.subscription.deleted webhook and a subscription_create invoice.paid webhook (period seeding). Both stores: MemoryStore and
// D1PlanStore over FakeD1 (real SQLite, real migrations). Every store call yields a SEEDED 0..3 event-loop ticks, so the interleaving
// differs per seed and replays per seed. Oracle: the end state must equal one SERIAL order of the same operations on a plain MemoryStore.
const SRC = resolve(import.meta.dirname, "../src");
const DAY = 86_400_000, T0 = Date.UTC(2026, 10, 6), START = T0 - 10 * DAY, NOW = T0;
export const SCHEDULES = 200;
const acc = { id: "acc_syn", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 };
type M = Record<string, any>;
const U = (dir: string) => async () => {
  const f = (n: string) => import(pathToFileURL(join(dir, n)).href);
  const [store, d1, svc, pcs, pc, st, dns] = await Promise.all([f("store.ts"), f("d1_plan_store.ts"), f("service.ts"), f("plan_change_service.ts"), f("plan_change.ts"), f("stripe.ts"), f("dns.ts")]);
  return { store, d1, svc, pcs, pc, st, dns } as M;
};
const base = U(SRC);
const depsFor = (m: M, store: any) => ({ store, billing: new m.st.MockBilling(), dns: m.dns.fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => NOW, siteOrigin: "https://titanos.tech", webhookSecret: "whsec_test_fixture" });
async function seedStore(store: any) {
  await store.putAccount(acc);
  await store.putPurchase({ id: "pur_syn", accountId: acc.id, productId: "ai_growth", checkoutId: "cs_syn", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "paid" });
  await store.putSubscription({ id: "sub_syn", accountId: acc.id, purchaseId: "pur_syn", productId: "ai_growth", startedAt: START });
}
// every store call yields a seeded number of ticks first (the MemoryStore otherwise never interleaves)
const yielding = (store: any, rng: () => number) => new Proxy(store, { get(t, k) { const v = t[k]; return typeof v !== "function" ? v : async (...a: unknown[]) => { for (let i = Math.floor(rng() * 4); i >= 0; i--) await new Promise((r) => setImmediate(r)); return v.apply(t, a); }; } });

type Op = { name: string; run: (m: M, d: any) => Promise<unknown> };
const secs = (ms: number) => Math.floor(ms / 1000);
function ops(seed: number): Op[] {
  const r = seeded(seed * 104729 + 7), n = 2 + Math.floor(r() * 3), out: Op[] = [];
  const kinds = ["plan_up", "plan_down", "plan_keep", "plan_cancel", "cancel_call", "hook_deleted", "hook_invoice"];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    let k = kinds[Math.floor(r() * kinds.length)]; if (used.has(k)) k = kinds[(kinds.indexOf(k) + 1) % kinds.length]; if (used.has(k)) continue; used.add(k);
    const id = `evt_${seed}_${k}`;
    if (k.startsWith("plan_")) {
      const req = k === "plan_up" ? { kind: "upgrade", to: "ai_ops" } : k === "plan_down" ? { kind: "downgrade", to: "ai_growth" } : k === "plan_keep" ? { kind: "keep" } : { kind: "cancel" };
      out.push({ name: k, run: (m, d) => m.pcs.changePlan(d, acc, "sub_syn", { ...req, eventId: id }) });
    } else if (k === "cancel_call") out.push({ name: k, run: (m, d) => m.svc.cancelSubscription(d, acc, "sub_syn") });
    else if (k === "hook_deleted") out.push({ name: k, run: (m, d) => m.svc.handleStripeEvent(d, { id, type: "customer.subscription.deleted", data: { object: { id: "sub_syn" } } }) });
    else out.push({ name: k, run: (m, d) => m.svc.handleStripeEvent(d, { id, type: "invoice.paid", data: { object: { id: "in_" + id, subscription: "sub_syn", billing_reason: "subscription_create", amount_paid: 150000, lines: { data: [{ period: { start: secs(START), end: secs(m.pc.addMonths(START, 1)) } }] } } } }) });
  }
  return out;
}
const perms = <T,>(a: T[]): T[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
// canonical (sorted keys): object key ORDER (outcomes insertion order, D1 JSON round trip) is not state
const canon = (v: any): any => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const snap = (s: any) => JSON.stringify(canon({ p: s.productId, s: s.startedAt, c: s.cancelAt, x: s.cancelledAt, pl: s.plan }));
const isConflict = (e: any) => e?.status === 409 && (e.code === "plan_conflict" || e.code === "subscription_conflict");

async function serialEnds(m: M, os: Op[]) {
  const ends: string[] = [];
  for (const order of perms(os.map((_, i) => i))) {
    const st = new m.store.MemoryStore(); await seedStore(st); const d = depsFor(m, st);
    for (const i of order) { try { await os[i].run(m, d); } catch { /* a refused op (minimum term) is part of that serial order */ } }
    ends.push(snap(await st.subscriptionById("sub_syn")));
  }
  return ends;
}
async function runSchedule(m: M, kind: "memory" | "d1", seed: number) {
  const bad: string[] = [], rng = seeded(seed);
  const raw = kind === "d1" ? new m.d1.D1PlanStore(new FakeD1(seeded(seed))) : new m.store.MemoryStore();
  await seedStore(raw);
  const v0 = (await raw.subscriptionVersioned("sub_syn"))!.version; // the seed write's version (memory 1, D1 0)
  const c = { lost: 0, wins: 0, puts: 0, creates: 0 };
  const cas = raw.casSubscription.bind(raw), put = raw.putSubscription.bind(raw), mk = raw.createSubscription.bind(raw);
  raw.casSubscription = async (s: any, v: number) => { const ok = await cas(s, v); ok ? c.wins++ : c.lost++; return ok; };
  raw.putSubscription = async (s: any) => { c.puts++; return put(s); };
  raw.createSubscription = async (s: any) => { c.creates++; return mk(s); };
  const store = yielding(raw, rng), d = depsFor(m, store), os = ops(seed);
  const settled = await Promise.allSettled(os.map((o) => o.run(m, d)));
  const final = await raw.subscriptionById("sub_syn"), ver = (await raw.subscriptionVersioned("sub_syn"))!.version;
  const rejected = settled.filter((s) => s.status === "rejected") as PromiseRejectedResult[];
  const conflicts = rejected.filter((s) => isConflict(s.reason)).length;
  for (const s of rejected) if (!isConflict(s.reason) && !(s.reason?.status === 409)) bad.push("X unexpected rejection " + String(s.reason?.message ?? s.reason));
  if (c.puts) bad.push(`V0 ${c.puts} unconditional putSubscription call(s) from service code`);
  if (c.creates > 0) bad.push(`V0b service created a row that already existed (${c.creates})`);
  if (ver !== v0 + c.wins) bad.push(`V1 version ${ver} != seed ${v0} + ${c.wins} successful CAS writes`); // one bump per successful write, none from anywhere else
  os.forEach((o, i) => { // L1: a changePlan that answered is recorded in the stored plan (never overwritten by a stale writer)
    const s = settled[i];
    if (o.name.startsWith("plan_") && s.status === "fulfilled" && !final?.plan?.outcomes?.[`evt_${seed}_${o.name}`]) bad.push(`L1 lost update: ${o.name} answered but absent from the stored plan`);
    if (o.name === "hook_deleted" && s.status === "fulfilled" && final?.cancelledAt === undefined) bad.push("L2 the cancel webhook answered but cancelledAt is not stored");
  });
  if (conflicts === 0) { // L3: the end state equals one serial order
    if (!(await serialEnds(m, os)).includes(snap(final))) bad.push("L3 end state matches no serial order");
  }
  return { bad, lost: c.lost };
}
async function runAll(m: M, kind: "memory" | "d1") { let lost = 0, raced = 0; const bad: string[] = []; for (let s = 1; s <= SCHEDULES; s++) { const r = await runSchedule(m, kind, s); lost += r.lost; if (r.lost) raced++; for (const b of r.bad) bad.push(`${kind} seed ${s}: ${b}`); } return { bad, lost, raced }; }

for (const kind of ["memory", "d1"] as const) {
  test(`SUBCAS: ${SCHEDULES} seeded schedules on ${kind}: no stale write overwrites a changePlan winner, serial-order end state`, async () => {
    const r = await runAll(await base(), kind);
    console.log(`SUBCAS_COUNTS ${kind} schedules=${SCHEDULES} lost_cas=${r.lost} schedules_with_a_lost_cas=${r.raced}`);
    assert.deepEqual(r.bad, []);
    assert.ok(r.raced >= 20, `the schedules must actually race (only ${r.raced} had a lost CAS)`);
  });
}

test("SUBCAS: a stale cancel cannot re-apply cancelAt over a later upgrade (retainer cancel writes cancelAt only inside changePlan's CAS)", async () => {
  const m = await base(), store = new m.store.MemoryStore(); await seedStore(store); const d = depsFor(m, store);
  const first = await m.svc.cancelSubscription(d, acc, "sub_syn").catch((e: any) => e); // inside the 3-month minimum: refused or scheduled, either way no stray write
  const up = await m.pcs.changePlan(d, acc, "sub_syn", { eventId: "evt_up", kind: "upgrade", to: "ai_ops" });
  assert.ok(up.outcome.ok);
  assert.equal((await store.subscriptionById("sub_syn")).cancelAt, undefined, "upgrade cleared cancelAt and nothing re-set it: " + JSON.stringify(first));
});

test("SUBCAS: updateSubscription gives up with 409 subscription_conflict after SUB_CAS_RETRIES losses and writes nothing; facts taken by a losing attempt are not lost", async () => {
  const m = await base(), store = new m.store.MemoryStore(); await seedStore(store); const d = depsFor(m, store);
  let n = 0; store.casSubscription = async () => { n++; return false; };
  const before = snap(await store.subscriptionById("sub_syn"));
  await assert.rejects(m.svc.updateSubscription(d, "sub_syn", (x: any) => { x.cancelledAt = 1; return true; }), (e: any) => e.status === 409 && e.code === "subscription_conflict");
  assert.equal(n, m.svc.SUB_CAS_RETRIES); assert.equal(snap(await store.subscriptionById("sub_syn")), before);
  // a held period fact taken by a losing attempt is not lost: it is put back when the winning attempt did not use it
  const s2 = new m.store.MemoryStore(); await seedStore(s2); const d2 = depsFor(m, s2);
  await s2.holdFact("sub:sub_syn", { kind: "period", start: START, end: START + 30 * DAY, create: false });
  const cas = s2.casSubscription.bind(s2); let first = true;
  s2.casSubscription = async (s: any, v: number) => { if (first) { first = false; return false; } return cas(s, v); };
  await m.svc.updateSubscription(d2, "sub_syn", async (x: any, fx: any) => { fx.taken ??= await s2.takeFacts("sub:sub_syn"); fx.used = false; x.cancelledAt = 5; return true; });
  assert.equal((await s2.takeFacts("sub:sub_syn")).length, 1);
});

// ---- source scan: no unconditional subscription write outside the store layer ----
const STORE_LAYER = new Set(["store.ts", "d1_plan_store.ts"]);
export function scanPut(files: Record<string, string>) {
  const hits: string[] = [];
  for (const [f, text] of Object.entries(files)) {
    if (STORE_LAYER.has(f)) continue;
    text.split("\n").forEach((l, i) => { if (/\bputSubscription\s*\(/.test(l.replace(/\/\/.*$/, ""))) hits.push(`${f}:${i + 1}`); });
  }
  return hits;
}
const srcFiles = (dir: string, pre = ""): Record<string, string> => Object.fromEntries(readdirSync(dir).flatMap((n) => statSync(join(dir, n)).isDirectory() ? Object.entries(srcFiles(join(dir, n), pre + n + "/")) : n.endsWith(".ts") ? [[pre + n, readFileSync(join(dir, n), "utf8")]] : []));
test("SUBCAS source scan: no putSubscription( call outside the store layer (store.ts, d1_plan_store.ts)", () => {
  assert.deepEqual(scanPut(srcFiles(SRC)), []);
});
test("SUBCAS source scan: the scanner itself flags a call in service code and ignores the store layer and comments", () => {
  assert.deepEqual(scanPut({ "service.ts": "a\n  await d.store.putSubscription(sub);" }), ["service.ts:2"]);
  assert.deepEqual(scanPut({ "store.ts": "async putSubscription(s) {}", "d1_plan_store.ts": "await this.putSubscription(x)", "service.ts": "// putSubscription(old)" }), []);
});

// ---- mutation: the schedules and the scan must kill these ----
const MUT: { id: string; file: string; from: string; to: string }[] = [
  { id: "M1 CAS replaced by an unconditional put in updateSubscription", file: "service.ts", from: "if (!(await d.store.casSubscription(v.sub, v.version))) continue;", to: "await d.store.putSubscription(v.sub);" },
  { id: "M2 retainer cancel re-writes cancelAt after changePlan (the original stale write)", file: "service.ts", from: "if (!isTier(sub.productId)) await updateSubscription(d, sub.id, (x) => { x.cancelAt = periodEnd; return true; });", to: "{ const f = (await d.store.subscriptionById(sub.id)) ?? sub; f.cancelAt = periodEnd; await d.store.putSubscription(f); }" },
  { id: "M3 cancel webhook writes a stale object", file: "service.ts", from: "await updateSubscription(d, sub.id, (x) => { if (x.cancelledAt) return false; x.cancelledAt = d.now(); return true; });", to: "if (!sub.cancelledAt) { sub.cancelledAt = d.now(); await d.store.putSubscription(sub); }" },
  { id: "M4 D1 CAS ignores the version", file: "d1_plan_store.ts", from: "WHERE id = ? AND version = ?\",\n      s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan), s.id, expectedVersion)", to: "WHERE id = ? AND version = ? OR 1\",\n      s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan), s.id, expectedVersion)" },
];
test(`SUBCAS mutation: ${MUT.length} of ${MUT.length} mutants are killed by the schedules or the source scan`, async () => {
  for (const mu of MUT) {
    const text = readFileSync(join(SRC, mu.file), "utf8");
    assert.equal(text.split(mu.from).length - 1, 1, `anchor must match exactly once: ${mu.id}`);
    const dir = mkdtempSync(join(resolve(SRC, "../.."), ".subcas_mut_"));
    try {
      cpSync(SRC, join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", mu.file), text.replace(mu.from, mu.to));
      let killed = scanPut(srcFiles(join(dir, "src"))).length > 0;
      if (!killed) for (const kind of ["memory", "d1"] as const) { if ((await runAll(await U(join(dir, "src"))(), kind)).bad.length) killed = true; }
      assert.ok(killed, "SURVIVED: " + mu.id);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
