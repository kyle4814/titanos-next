import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, MIGRATIONS } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";
// @ts-ignore plain .mjs, the f104 migration lint
import { lint } from "../scripts/migration_lint.mjs";

// f245: the f242 lease residuals 1..3, SYNTHETIC data, Stripe is MockBilling only, nothing applied to a real D1.
//  1. STALL GUARD: a winner (markPaid) that stalls PAST the lease TTL no longer overwrites the row a sweep seeded in the meantime (the winner writes with putSubscriptionOnce; a cancel it took is merged onto the sweep's row).
//  2. The winner replays facts held after its seed read them (replayLateFacts), so a hold written in the winner window lands.
//  3. The lease is a D1 row (migration 0015_claim_leases): one INSERT ... ON CONFLICT DO UPDATE ... WHERE, changes() === 1 is the win signal. Proved on FakeD1 (node:sqlite).
// Contract G1..G4 on Memory and D1PlanStore, run on the real source AND on source mutants.
const SRC = resolve(import.meta.dirname, "../src"), MIG = resolve(import.meta.dirname, "../migrations");
type Mods = { store: any; d1: any; svc: any; rec: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const root = mkdtempSync(join(tmpdir(), "f245-")); if (!root.startsWith(tmpdir())) throw new Error("bad tmp");
  const dir = join(root, "portal-api", "src"); mkdirSync(dir, { recursive: true }); symlinkSync(resolve(SRC, "../../lib"), join(root, "lib"));
  try {
    cpSync(SRC, dir, { recursive: true });
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), rec: await imp("reconcile.ts") };
  } finally { setTimeout(() => rmSync(root, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  return { open: (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared), db };
}
const base = { id: "pur1", accountId: "acc1", productId: "ai_growth", checkoutId: "cs_1", amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0 };
async function seed(s: any, status: string = "pending", over: Record<string, unknown> = {}) {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ ...base, status, ...over });
}
const WIN_START = T0 / 1000, SWEEP_START = T0 / 1000 + 3600; // the winner's webhook object and the sweep's Stripe session carry DIFFERENT periods, so the surviving row names its writer
const winnerSub = { id: "sub_1", current_period_start: WIN_START, current_period_end: WIN_START + 30 * 86400, billing_cycle_anchor: WIN_START };
const sweepSub = { id: "sub_1", current_period_start: SWEEP_START, current_period_end: SWEEP_START + 30 * 86400, billing_cycle_anchor: SWEEP_START };
const sweepSession = () => ({ id: "cs_1", status: "complete" as const, paymentStatus: "paid" as const, paymentIntent: "pi_1", customer: "cus_1", subscription: sweepSub as any });
const D = (m: Mods, store: any) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => T0, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const o = { payment_intent: "pi_1", customer: "cus_1", subscription: winnerSub };
// runs `fn` once, just BEFORE the first call of any named store method (the winner's subscription write, whichever write it uses)
function pauseAt(s: any, methods: string[], fn: () => Promise<void>) {
  let done = false;
  return new Proxy(s, { get(t, k: string) { const v = t[k]; if (typeof v !== "function") return v; return async (...a: unknown[]) => { if (methods.includes(k) && !done) { done = true; await fn(); } return v.apply(t, a); }; } });
}
const WRITE = ["putSubscriptionOnce", "putSubscription"];

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const count = async (s: any) => ({ subs: (await s.subscriptionsFor("acc1")).length, inv: (await s.invoicesFor("acc1")).length });
  const LEASE = m.svc.LEASE_MS as number, KEY = m.svc.leaseKey("pur1") as string;

  // G1 (item 1) the winner stalls PAST the TTL after building its row; the sweep seeds in that window; the winner resumes. One subscription, the SWEEP's (its period), one invoice.
  { const { open } = world(m, kind), s0 = open(); await seed(s0);
    const bill = new MockBilling(); bill.sessions.set("cs_1", sweepSession());
    let rep: any;
    const winner = pauseAt(s0, WRITE, async () => { rep = await m.rec.reconcileSubscriptions(open(), bill, T0 + LEASE + 1, 0); });
    const r = await m.svc.markPaid(D(m, winner), { ...(await s0.purchaseById("pur1")) }, o, "evt1");
    const subs = await open().subscriptionsFor("acc1"), c = await count(open());
    want("G1", !!rep && rep.seeded === 1, `G1 the sweep must seed once the lease has expired, got ${JSON.stringify(rep)}`);
    want("G1", r.won === true, "G1 the winner still reports its win (it did claim the purchase)");
    want("G1", subs.length === 1 && subs[0].startedAt === SWEEP_START * 1000, `G1 exactly one row and it is the sweep's (late winner must not overwrite), got ${JSON.stringify(subs.map((x: any) => ({ id: x.id, startedAt: x.startedAt })))}`);
    want("G1", c.inv === 1, `G1 no duplicate invoice, got ${c.inv}`);
  }

  // G1b the stalled winner had already taken a held cancel (the sweep never sees it): the sweep's row stands AND carries that cancel.
  { const { open } = world(m, kind), s0 = open(); await seed(s0); await s0.holdFact("sub:sub_1", { kind: "cancel" });
    const bill = new MockBilling(); bill.sessions.set("cs_1", sweepSession());
    const winner = pauseAt(s0, WRITE, async () => { await m.rec.reconcileSubscriptions(open(), bill, T0 + LEASE + 1, 0); });
    await m.svc.markPaid(D(m, winner), { ...(await s0.purchaseById("pur1")) }, o, "evt1");
    const subs = await open().subscriptionsFor("acc1"), c = await count(open());
    want("G1b", subs.length === 1 && subs[0].startedAt === SWEEP_START * 1000 && !!subs[0].cancelledAt, `G1b the sweep's row must stand and carry the cancel the winner consumed, got ${JSON.stringify(subs.map((x: any) => ({ startedAt: x.startedAt, cancelledAt: x.cancelledAt })))}`);
    want("G1b", c.inv === 1 && (await open().takeFacts("sub:sub_1")).length === 0, "G1b one invoice, no fact left behind");
  }

  // G2 (item 2) a hold written in the winner window (after its seed read its facts, before the row lands) is replayed onto the landed row and consumed.
  { const { open } = world(m, kind), s0 = open(); await seed(s0);
    const winner = pauseAt(s0, WRITE, async () => { await s0.holdFact("sub:sub_1", { kind: "cancel" }); });
    await m.svc.markPaid(D(m, winner), { ...(await s0.purchaseById("pur1")) }, o, "evt1");
    const subs = await open().subscriptionsFor("acc1");
    want("G2", subs.length === 1 && !!subs[0].cancelledAt, `G2 the hold written during the winner window must be replayed (row cancelled), got ${JSON.stringify(subs)}`);
    want("G2", (await open().takeFacts("sub:sub_1")).length === 0, "G2 the replayed fact is consumed");
    want("G2", (await count(open())).inv === 1, "G2 one invoice");
  }

  // G3 (item 3) the lease contract through the Store interface, same on Memory and D1: a live lease is not stolen, an expired one is (the boundary instant itself is expired), the owner renews, a foreign owner cannot release.
  { const { open } = world(m, kind), a = open(), b = open();
    want("G3", (await a.acquireLease("k1", "A", 1000, 500)) === true, "G3 a free key is taken");
    want("G3", (await b.acquireLease("k1", "B", 1499, 500)) === false, "G3 a live lease (expires 1500) is not stolen at 1499");
    want("G3", (await b.acquireLease("k1", "B", 1500, 500)) === true, "G3 an expired lease is stolen at its expiry instant");
    want("G3", (await a.acquireLease("k1", "A", 1600, 500)) === false, "G3 the new holder's lease is live, the old owner cannot take it back");
    want("G3", (await b.acquireLease("k1", "B", 1700, 500)) === true, "G3 the owner renews its own live lease");
    await a.releaseLease("k1", "A");
    want("G3", (await a.acquireLease("k1", "A", 1800, 500)) === false, "G3 a foreign owner's release must not free the lease");
    await b.releaseLease("k1", "B");
    want("G3", (await a.acquireLease("k1", "A", 1800, 500)) === true, "G3 the owner's release frees it at once");
    // two contenders, one winner: eight contenders on eight store instances, one key, 40 rounds
    for (let r = 0; r < 40; r++) {
      const res = await Promise.all(Array.from({ length: 8 }, (_, i) => open().acquireLease(`race${r}`, `o${i}`, 5000, 1000)));
      want("G3", res.filter(Boolean).length === 1, `G3 round ${r}: exactly one of 8 contenders wins, got ${res.filter(Boolean).length}`);
    }
  }

  // G4 (item 3, D1 only) the row shape and the win signal: the lease really is a row in claim_leases (key, owner, expires_at), shared by separate store instances.
  if (kind === "d1") { const { open, db } = world(m, kind);
    await open().acquireLease("claim:pur9", "ownerX", 7000, 300);
    const row = db.db.prepare("SELECT key, owner, expires_at FROM claim_leases").all() as any[];
    want("G4", row.length === 1 && row[0].key === "claim:pur9" && row[0].owner === "ownerX" && Number(row[0].expires_at) === 7300, `G4 one row (key, owner, expires_at = now + ttl), got ${JSON.stringify(row)}`);
    await open().releaseLease("claim:pur9", "ownerX");
    want("G4", (db.db.prepare("SELECT count(*) AS n FROM claim_leases").get() as any).n === 0, "G4 release deletes the row");
    // a lease taken through one store instance is live for another (it is a row, not a per-isolate map)
    await open().acquireLease(KEY, "w1", 100, LEASE);
    want("G4", (await open().acquireLease(KEY, "w2", 100 + LEASE - 1, LEASE)) === false, "G4 the lease is visible across store instances (a D1 row)");
  }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f245 contract G1..G4 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

test("f245 migration 0015_claim_leases: additive, one table, not applied, lint-clean (no new findings)", () => {
  assert.ok(MIGRATIONS.includes("0015_claim_leases.sql"));
  const sql = readFileSync(join(MIG, "0015_claim_leases.sql"), "utf8"), code = sql.replace(/--.*$/gm, "");
  assert.ok(/NOT applied/.test(sql));
  assert.ok(!/\b(DROP|DELETE|UPDATE|ALTER)\b/i.test(code), "additive only");
  assert.ok(/CREATE TABLE IF NOT EXISTS claim_leases \(key TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL\);/.test(code));
  assert.equal(MIGRATIONS.filter((f) => f.startsWith("0015")).length, 1, "a unique number: no new duplicate-prefix finding");
  const r = lint({});
  assert.deepEqual(r.failures.filter((f: string) => /0015|claim_leases/.test(f)), [], "the migration lint raises nothing about this migration");
});

const MUT: [string, string, [string, string, string][]][] = [
  ["M1 winner writes with the upsert again (item 1)", "G1", [["service.ts", "if (await d.store.putSubscriptionOnce(sub)) await replayLateFacts(d, sub);", "if (await d.store.putSubscription(sub).then(() => true)) await replayLateFacts(d, sub);"]]],
  ["M2 winner does not merge its cancel onto the sweep's row (item 1)", "G1b", [["service.ts", "else await mergeLostSeed(d, sub, parts);", ";"]]],
  ["M3 winner does not replay late facts (item 2)", "G2", [["service.ts", "if (await d.store.putSubscriptionOnce(sub)) await replayLateFacts(d, sub);", "if (await d.store.putSubscriptionOnce(sub)) await Promise.resolve(false);"]]],
  ["M4 D1 lease always steals (WHERE dropped) (item 3)", "G3", [["d1_plan_store.ts", " WHERE claim_leases.expires_at <= ? OR claim_leases.owner = excluded.owner", " WHERE ? >= 0"]]],
  ["M5 D1 expiry boundary off by one (<= becomes <) (item 3)", "G3", [["d1_plan_store.ts", "claim_leases.expires_at <= ?", "claim_leases.expires_at < ?"]]],
  ["M6 D1 win signal ignored (changes() >= 0) (item 3)", "G3", [["d1_plan_store.ts", "return r.meta.changes === 1;\n  }\n  override async releaseLease", "return r.meta.changes >= 0;\n  }\n  override async releaseLease"]]],
  ["M7 D1 release not owner-matched (item 3)", "G3", [["d1_plan_store.ts", "DELETE FROM claim_leases WHERE key = ? AND owner = ?", "DELETE FROM claim_leases WHERE key = ? AND ? IS NOT NULL"]]],
  ["M8 D1 lease adapter reverted to the per-instance memory map (item 3)", "G3", [["d1_plan_store.ts", "override async acquireLease(", "async acquireLeaseUnused("]]],
];
test("f245 mutants are all killed (each item's fix reverted in a scratch copy fails its test)", async () => {
  let killed = 0;
  for (const [name, inv, edits] of MUT) {
    const m = await load(edits); const v = [...(await violations(m, "memory").catch((e) => [`threw ${e}`])), ...(await violations(m, "d1").catch((e) => [`threw ${e}`]))];
    const by = [...new Set(v.map((x) => x.split(" ")[0]))];
    if (v.length > 0) { killed++; console.log("KILLED", name, "by", by.join(",")); } else console.log("SURVIVED", name);
    assert.ok(v.length > 0, `mutant must fail the contract: ${name}`);
    assert.ok(by.includes(inv), `${name}: killed, but not by ${inv} (got ${by.join(",")})`);
  }
  console.log(`C2LSTALL_MUTANTS ${killed}/${MUT.length} killed`);
});
