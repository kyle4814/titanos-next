import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { MemoryStore } from "../src/store.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { MockMailer, HttpError, type Deps } from "../src/service.ts";
import { changePlan, PLAN_CAS_RETRIES } from "../src/plan_change_service.ts";
import type { Request } from "../src/plan_change.ts";
import { FakeD1, seeded } from "./fake_d1.ts";

// C2 plan write concurrency (f175). SYNTHETIC labelled fixtures only (example.invalid, sub_syn). FakeD1 = real SQLite, real migrations, foreign keys ON,
// yielding a SEEDED 0..3 event-loop ticks before every statement so concurrent changePlan calls interleave differently per seed (and replay per seed).
const DAY = 86_400_000, T0 = Date.UTC(2026, 10, 6), START = T0 - 10 * DAY, NOW = T0;
export const SCHEDULES = 300;
const acc = { id: "acc_syn", email: "synthetic@example.invalid", seat: "owner", createdAt: T0 };
const depsFor = (store: MemoryStore): Deps => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new MockMailer(), now: () => NOW, siteOrigin: "https://titanos.tech", webhookSecret: "whsec_test_fixture" });
async function seedStore(store: MemoryStore) {
  await store.putAccount(acc);
  await store.putPurchase({ id: "pur_syn", accountId: acc.id, productId: "ai_growth", checkoutId: "cs_syn", amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "paid" });
  await store.putSubscription({ id: "sub_syn", accountId: acc.id, purchaseId: "pur_syn", productId: "ai_growth", startedAt: START });
}
const POOL: Omit<Request, "eventId">[] = [{ kind: "upgrade", to: "ai_ops" }, { kind: "upgrade", to: "ai_embedded" }, { kind: "downgrade", to: "ai_growth" }, { kind: "downgrade", to: "ai_ops" }, { kind: "cancel" }, { kind: "keep" }];
function requests(seed: number): Request[] {
  const r = seeded(seed * 7919 + 13), n = 2 + Math.floor(r() * 3); // 2..4 concurrent calls
  const out: Request[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && r() < 0.2) { out.push({ ...out[Math.floor(r() * i)] }); continue; } // a duplicate delivery of an earlier event id
    out.push({ ...POOL[Math.floor(r() * POOL.length)], eventId: `evt_${seed}_${i}` } as Request);
  }
  return out;
}
const perms = <T,>(a: T[]): T[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
const snap = (s: any) => JSON.stringify({ p: s.productId, c: s.cancelAt, pl: s.plan });

// serial oracle: every order of the (deduplicated by first appearance in that order) requests on a fresh MemoryStore
async function serialEnds(reqs: Request[]) {
  const ends: { order: number[]; final: string; outs: string[] }[] = [];
  for (const order of perms(reqs.map((_, i) => i))) {
    const st = new MemoryStore(); await seedStore(st); const outs: string[] = [];
    for (const i of order) outs[i] = JSON.stringify((await changePlan(depsFor(st), acc, "sub_syn", reqs[i])).outcome);
    ends.push({ order, final: snap(await st.subscriptionById("sub_syn")), outs });
  }
  return ends;
}

type Mods = { D1PlanStore: new (db: any) => D1PlanStore; changePlan: typeof changePlan };
// One schedule on a module set. Returns the violations and how many CAS attempts were lost (a real race happened).
async function runSchedule(m: Mods, seed: number): Promise<{ bad: string[]; lost: number }> {
  const bad: string[] = [], d1 = new FakeD1(seeded(seed)), store = new m.D1PlanStore(d1);
  await seedStore(store);
  let lost = 0; const cas = store.casSubscription.bind(store); store.casSubscription = async (s, v) => { const ok = await cas(s, v); if (!ok) lost++; return ok; };
  const reqs = requests(seed);
  const settled = await Promise.allSettled(reqs.map((r) => m.changePlan(depsFor(store), acc, "sub_syn", r)));
  const final = await store.subscriptionById("sub_syn"), ver = (await store.subscriptionVersioned("sub_syn"))!.version;
  const done = settled.map((s, i) => (s.status === "fulfilled" ? i : -1)).filter((i) => i >= 0);
  for (const s of settled) if (s.status === "rejected" && !((s.reason as HttpError).code === "plan_conflict")) bad.push("X unexpected rejection " + String((s.reason as Error)?.message));
  // L1 no lost update: every request that reported success is recorded in the stored plan
  for (const i of done) if (!final?.plan?.outcomes[reqs[i].eventId]) bad.push(`L1 lost update: ${reqs[i].eventId} answered but absent from the stored plan`);
  // L2 serial order: the end state AND every answer equal one serial order of the same requests (only checkable when none was rejected)
  if (done.length === reqs.length) {
    const outs = settled.map((s) => JSON.stringify((s as PromiseFulfilledResult<any>).value.outcome));
    const ok = (await serialEnds(reqs)).some((e) => e.final === snap(final) && e.outs.every((o, i) => o === outs[i]));
    if (!ok) bad.push("L2 end state or answers match no serial order");
  }
  // L3 version counts writes: one bump per distinct event id (a replay writes nothing)
  const distinct = new Set(done.map((i) => reqs[i].eventId)).size;
  if (done.length === reqs.length && ver !== distinct) bad.push(`L3 version ${ver} != ${distinct} distinct writes`);
  return { bad, lost };
}
async function runAll(m: Mods) { let lost = 0, raced = 0; const bad: string[] = []; for (let s = 1; s <= SCHEDULES; s++) { const r = await runSchedule(m, s); lost += r.lost; if (r.lost) raced++; for (const b of r.bad) bad.push(`seed ${s}: ${b}`); } return { bad, lost, raced }; }
const base: Mods = { D1PlanStore, changePlan };

test(`PLANCAS: ${SCHEDULES} seeded schedules on FakeD1: no lost update, serial-order end state, version counts writes`, async () => {
  const r = await runAll(base);
  console.log(`PLANCAS_COUNTS schedules=${SCHEDULES} lost_cas=${r.lost} schedules_with_a_lost_cas=${r.raced}`);
  assert.deepEqual(r.bad, []);
  assert.ok(r.raced >= 30, `the schedules must actually race (only ${r.raced} had a lost CAS)`);
});

test("PLANCAS: the same schedule number replays identically (seeded, not Math.random)", async () => {
  const a = await runSchedule(base, 17), b = await runSchedule(base, 17);
  assert.equal(a.lost, b.lost);
});

test("PLANCAS: casSubscription is a real compare-and-set on both stores (stale version loses, winner's write survives)", async () => {
  for (const mk of [() => new MemoryStore(), () => new D1PlanStore(new FakeD1())]) {
    const s = mk(); await seedStore(s);
    const a = (await s.subscriptionVersioned("sub_syn"))!, b = (await s.subscriptionVersioned("sub_syn"))!;
    assert.equal(a.version, b.version);
    assert.equal(await s.casSubscription({ ...a.sub, productId: "ai_ops" }, a.version), true);
    assert.equal(await s.casSubscription({ ...b.sub, productId: "ai_embedded" }, b.version), false);
    const now = (await s.subscriptionVersioned("sub_syn"))!;
    assert.equal(now.sub.productId, "ai_ops"); assert.equal(now.version, a.version + 1);
    assert.equal(await s.casSubscription({ ...now.sub, id: "sub_missing" }, 0), false); // no such row
    await s.putSubscription({ ...now.sub, productId: "ai_growth" }); // an unconditional writer also bumps, so it is detected too
    assert.equal(await s.casSubscription({ ...now.sub, productId: "ai_embedded" }, now.version), false);
  }
});

test("PLANCAS: a caller that keeps losing is rejected with 409 plan_conflict and writes nothing", async () => {
  const store = new D1PlanStore(new FakeD1(seeded(1))); await seedStore(store);
  let calls = 0; store.casSubscription = async () => { calls++; return false; };
  const before = snap(await store.subscriptionById("sub_syn"));
  await assert.rejects(changePlan(depsFor(store), acc, "sub_syn", { eventId: "evt_x", kind: "upgrade", to: "ai_ops" }), (e: any) => e instanceof HttpError && e.status === 409 && e.code === "plan_conflict");
  assert.equal(calls, PLAN_CAS_RETRIES); assert.equal(snap(await store.subscriptionById("sub_syn")), before);
});

test("PLANCAS: migration 0005 is additive, NOT APPLIED, default 0", async () => {
  const sql = readFileSync(resolve(import.meta.dirname, "../migrations/0005_subscription_version.sql"), "utf8");
  assert.match(sql, /NOT APPLIED/); assert.match(sql, /ALTER TABLE subscriptions ADD COLUMN version INTEGER NOT NULL DEFAULT 0;/); assert.doesNotMatch(sql, /DROP|DELETE/i);
  const c = (new FakeD1().db.prepare("PRAGMA table_info(subscriptions)").all() as any[]).find((x) => x.name === "version");
  assert.ok(c); assert.equal(c.notnull, 1); assert.equal(String(c.dflt_value), "0");
});

// ---------- mutation: remove the CAS and the schedules must fail ----------
const SRC = resolve(import.meta.dirname, "../src");
const MUT: { id: string; file: string; from: string; to: string }[] = [
  { id: "M1 service writes unconditionally (CAS removed from changePlan)", file: "plan_change_service.ts", from: "if (!(await d.store.casSubscription(sub, v.version))) continue;", to: "await d.store.putSubscription(sub);" },
  { id: "M2 D1 CAS ignores the version (WHERE id only)", file: "d1_plan_store.ts", from: "WHERE id = ? AND version = ?\",\n      s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan), s.id, expectedVersion)", to: "WHERE id = ?\",\n      s.accountId, s.purchaseId, s.productId, s.startedAt, n(s.cancelAt), n(s.cancelledAt), s.plan === undefined ? null : JSON.stringify(s.plan), s.id)" },
  { id: "M3 D1 CAS forgets to bump the version", file: "d1_plan_store.ts", from: "plan_json = ?, version = version + 1 WHERE", to: "plan_json = ? WHERE" },
  { id: "M4 service re-reads the version after computing (stale check)", file: "plan_change_service.ts", from: "casSubscription(sub, v.version)", to: "casSubscription(sub, (await d.store.subscriptionVersioned(subId))!.version)" },
];
test(`PLANCAS mutation: ${MUT.length} of ${MUT.length} CAS mutants are killed by the schedules`, async () => {
  for (const mu of MUT) {
    const text = readFileSync(join(SRC, mu.file), "utf8");
    assert.equal(text.split(mu.from).length - 1, 1, `anchor must match exactly once: ${mu.id}`);
    const dir = mkdtempSync(join(tmpdir(), "plancas_mut_"));
    try {
      mkdirSync(join(dir, "portal-api"), { recursive: true }); symlinkSync(resolve(SRC, "../../lib"), join(dir, "lib")); // int3: src/market imports ../../../lib
      cpSync(SRC, join(dir, "portal-api", "src"), { recursive: true });
      writeFileSync(join(dir, "portal-api", "src", mu.file), text.replace(mu.from, mu.to));
      const U = (f: string) => import(pathToFileURL(join(dir, "portal-api", "src", f)).href);
      const [ds, svc] = await Promise.all([U("d1_plan_store.ts"), U("plan_change_service.ts")]);
      const r = await runAll({ D1PlanStore: ds.D1PlanStore, changePlan: svc.changePlan });
      console.log(`PLANCAS_MUTANT ${mu.id}: ${r.bad.length} violations, first: ${r.bad[0]}`);
      assert.ok(r.bad.length > 0, "SURVIVED: " + mu.id);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
