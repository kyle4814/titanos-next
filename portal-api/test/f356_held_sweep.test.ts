import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { T0 } from "./harness.ts";

// f356: the held-facts sweep (drainHeldFacts), SYNTHETIC data, nothing applied to a real D1 and no cron wired. Contract H1..H7 on Memory and D1PlanStore (FakeD1), run on the real source AND on source mutants.
const SRC = resolve(import.meta.dirname, "../src"), MIG = resolve(import.meta.dirname, "../migrations");
type Mods = { store: any; d1: any; svc: any; hs: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const root = mkdtempSync(join(tmpdir(), "f356-")); if (!root.startsWith(tmpdir())) throw new Error("bad tmp");
  const dir = join(root, "portal-api", "src"); mkdirSync(dir, { recursive: true }); symlinkSync(resolve(SRC, "../../lib"), join(root, "lib"));
  try {
    cpSync(SRC, dir, { recursive: true });
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), hs: await imp("held_sweep.ts") };
  } finally { setTimeout(() => rmSync(root, { recursive: true, force: true }), 50); }
}
type Kind = "memory" | "d1";
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  return { open: (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared), db };
}
const pur = (id: string, status: string) => ({ id, accountId: "acc1", productId: "ai_growth", checkoutId: `cs_${id}`, amountCents: 150000, deliverableIssued: false, refundedCents: 0, createdAt: T0, status });
async function row(s: any, n: number, status = "paid", withSub = true) { // purchase pur<n> + subscription sub_<n>
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase(pur(`pur${n}`, status));
  if (withSub) await s.putSubscription({ id: `sub_${n}`, accountId: "acc1", purchaseId: `pur${n}`, productId: "ai_growth", startedAt: T0 });
}
const held = async (s: any, k: string) => { const f = await s.takeFacts(k); for (const x of f) await s.holdFact(k, x); return f.length; }; // peek: take, then put back in order
// a store whose subscription CAS always loses (a racing writer keeps winning)
const contended = (s: any) => new Proxy(s, { get(t, k: string) { if (k === "casSubscription") return async () => false; const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
const CANCEL = { kind: "cancel" };

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const LEASE = m.svc.LEASE_MS as number;
  const NOW = T0 + 1000;

  // H1 + H2: a fact held for an existing PAID row is applied once; the second pass is a no-op.
  { const { open } = world(m, kind), s = open(); await row(s, 1); await s.holdFact("sub:sub_1", CANCEL);
    const r1 = await m.hs.drainHeldFacts(open(), NOW), after = await open().subscriptionById("sub_1");
    want("H1", r1.scanned === 1 && r1.drained === 1 && r1.skipped === 0 && r1.contended === 0, `H1 first pass reports 1 scanned / 1 drained, got ${JSON.stringify(r1)}`);
    want("H1", !!after?.cancelledAt, "H1 the held cancel is applied to the row");
    want("H1", (await held(open(), "sub:sub_1")) === 0, "H1 the fact is consumed (nothing held)");
    const stamp = after?.cancelledAt, r2 = await m.hs.drainHeldFacts(open(), NOW + 5000), after2 = await open().subscriptionById("sub_1");
    want("H2", r2.scanned === 0 && r2.drained === 0 && r2.contended === 0, `H2 second pass is a no-op, got ${JSON.stringify(r2)}`);
    want("H2", after2?.cancelledAt === stamp, "H2 the row is unchanged by the second pass");
    // re-hold the same fact: it applies idempotently (a cancel is never re-stamped)
    await open().holdFact("sub:sub_1", CANCEL); await m.hs.drainHeldFacts(open(), NOW + 9000);
    want("H2", (await open().subscriptionById("sub_1"))?.cancelledAt === stamp, "H2 a repeated cancel does not re-stamp the row");
  }

  // H3: unpaid / refunded / abandoned purchases, and a key with no row yet, are untouched (facts stay held).
  { const { open } = world(m, kind), s = open();
    await row(s, 2, "pending"); await row(s, 3, "refunded"); await row(s, 4, "abandoned"); await row(s, 5, "paid", false);
    for (const n of [2, 3, 4, 5]) await s.holdFact(`sub:sub_${n}`, CANCEL);
    const r = await m.hs.drainHeldFacts(open(), NOW);
    want("H3", r.scanned === 4 && r.drained === 0 && r.skipped === 4, `H3 four keys scanned and all skipped, got ${JSON.stringify(r)}`);
    for (const n of [2, 3, 4, 5]) want("H3", (await held(open(), `sub:sub_${n}`)) === 1, `H3 sub_${n} fact must stay held`);
    for (const n of [2, 3, 4]) want("H3", !(await open().subscriptionById(`sub_${n}`))?.cancelledAt, `H3 sub_${n} row untouched`);
  }

  // H4: contention (the CAS keeps losing) re-holds without loss or duplication; the next uncontended pass applies it once.
  { const { open } = world(m, kind), s = open(); await row(s, 1); await s.holdFact("sub:sub_1", CANCEL); await s.holdFact("sub:sub_1", { kind: "period", start: T0, end: T0 + 30 * 86400_000, create: false });
    const r = await m.hs.drainHeldFacts(contended(open()), NOW);
    want("H4", r.drained === 0 && r.contended === 1 && r.errors.length === 1, `H4 contended pass: 0 drained, 1 contended, 1 error, got ${JSON.stringify(r)}`);
    want("H4", (await held(open(), "sub:sub_1")) === 2, "H4 both facts re-held, none lost, none duplicated");
    want("H4", !(await open().subscriptionById("sub_1"))?.cancelledAt, "H4 the row was not written under contention");
    const r2 = await m.hs.drainHeldFacts(open(), NOW + 1), after = await open().subscriptionById("sub_1");
    want("H4", r2.drained === 1 && !!after?.cancelledAt, `H4 the next pass applies the cancel once, got ${JSON.stringify(r2)}`);
    want("H4", (await held(open(), "sub:sub_1")) === 1, "H4 the not-yet-applicable later period stays held exactly once (no first period, no plan)");
  }

  // H4b: a period-only fact on a planless row cannot apply yet: every pass leaves it held exactly once and reports skipped, never drained.
  { const { open } = world(m, kind), s = open(); await row(s, 1); await s.holdFact("sub:sub_1", { kind: "period", start: T0, end: T0 + 30 * 86400_000, create: false });
    const a = await m.hs.drainHeldFacts(open(), NOW), b = await m.hs.drainHeldFacts(open(), NOW + 1);
    want("H4", a.drained === 0 && a.skipped === 1 && b.drained === 0 && b.skipped === 1, `H4b nothing applicable: skipped both passes, got ${JSON.stringify([a, b])}`);
    want("H4", (await held(open(), "sub:sub_1")) === 1, "H4b the period is held exactly once after two passes");
  }

  // H5: a live claim lease (markPaid mid-flight) is respected: contended, facts stay held; an expired lease is free.
  { const { open } = world(m, kind), s = open(); await row(s, 1); await s.holdFact("sub:sub_1", CANCEL);
    await open().acquireLease(m.svc.leaseKey("pur1"), "winner", NOW, LEASE);
    const r = await m.hs.drainHeldFacts(open(), NOW + 10);
    want("H5", r.drained === 0 && r.contended === 1 && (await held(open(), "sub:sub_1")) === 1, `H5 a live lease blocks the drain, got ${JSON.stringify(r)}`);
    const r2 = await m.hs.drainHeldFacts(open(), NOW + LEASE + 1);
    want("H5", r2.drained === 1, `H5 an expired lease is free, got ${JSON.stringify(r2)}`);
    want("H5", (await open().acquireLease(m.svc.leaseKey("pur1"), "other", NOW + LEASE + 2, 10)) === true, "H5 the sweep releases its own lease");
  }

  // H6: bounded. Five paid rows, batch 2: each pass touches at most 2 keys; the cursor walks all five exactly once; an absurd batch is clamped.
  { const { open } = world(m, kind), s = open();
    for (let n = 1; n <= 5; n++) { await row(s, n); await s.holdFact(`sub:sub_${n}`, CANCEL); }
    const r1 = await m.hs.drainHeldFacts(open(), NOW, { batch: 2 });
    want("H6", r1.scanned === 2 && r1.drained === 2 && typeof r1.nextCursor === "string", `H6 page 1 is capped at 2 with a cursor, got ${JSON.stringify(r1)}`);
    const r2 = await m.hs.drainHeldFacts(open(), NOW, { batch: 2, cursor: r1.nextCursor });
    const r3 = await m.hs.drainHeldFacts(open(), NOW, { batch: 2, cursor: r2.nextCursor });
    want("H6", r2.scanned === 1 || r2.scanned === 2, "H6 page 2 is capped");
    want("H6", r1.drained + r2.drained + r3.drained === 5, `H6 the cursor walk drains all five exactly once, got ${r1.drained}+${r2.drained}+${r3.drained}`);
    want("H6", r3.nextCursor === undefined || r3.scanned === 0, `H6 the lap ends, got ${JSON.stringify(r3)}`);
  }
  { const { open } = world(m, kind), s = open(); // head-of-line: unpaid keys at the front must not starve a paid key behind them when the cursor advances
    for (let n = 1; n <= 3; n++) { await row(s, n, "pending"); await s.holdFact(`sub:sub_${n}`, CANCEL); }
    await row(s, 9); await s.holdFact("sub:sub_9", CANCEL);
    const r1 = await m.hs.drainHeldFacts(open(), NOW, { batch: 3 }), r2 = await m.hs.drainHeldFacts(open(), NOW, { batch: 3, cursor: r1.nextCursor });
    want("H6", r1.skipped === 3 && r2.drained === 1, `H6 the cursor reaches the paid key behind three unpaid ones, got ${JSON.stringify([r1, r2])}`);
  }
  { const { open } = world(m, kind), s = open(); await row(s, 1); await s.holdFact("sub:sub_1", CANCEL);
    await s.holdFact("pi:pi_1", { kind: "refund", cents: 1 });
    const r = await m.hs.drainHeldFacts(open(), NOW, { batch: Number.NaN });
    want("H6", r.scanned === 1 && r.drained === 1 && (await held(open(), "pi:pi_1")) === 1, `H6 a NaN batch falls back to the default; only sub: keys are read (pi: left alone), got ${JSON.stringify(r)}`);
  }

  // H7: the key listing is read-only and prefix-literal (a % or _ in a prefix is not a wildcard).
  { const { open } = world(m, kind), s = open(); await s.holdFact("sub:a", CANCEL); await s.holdFact("subX:b", CANCEL); await s.holdFact("sub:c", CANCEL);
    const k = await open().heldFactKeys("sub:", undefined, 10), k2 = await open().heldFactKeys("sub:", "sub:a", 10), k3 = await open().heldFactKeys("sub_", undefined, 10);
    want("H7", JSON.stringify(k) === JSON.stringify(["sub:a", "sub:c"]), `H7 prefix listing, got ${JSON.stringify(k)}`);
    want("H7", JSON.stringify(k2) === JSON.stringify(["sub:c"]), `H7 cursor is exclusive, got ${JSON.stringify(k2)}`);
    want("H7", k3.length === 0, "H7 underscore is literal, not a wildcard");
    want("H7", (await held(open(), "sub:a")) === 1, "H7 listing takes nothing");
  }
  return bad;
}

for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f356 held-facts sweep H1..H7 on real source (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// MUTATION: each edit to the sweep (or to the CAS / re-hold it leans on) must be caught on BOTH stores.
const MUTANTS: [string, [string, string, string][]][] = [
  ["M1 skip the paid check", [["held_sweep.ts", 'if (!pur || pur.status !== "paid") {', "if (!pur) {"]]],
  ["M2 drain without the claim lease", [["held_sweep.ts", "if (!(await store.acquireLease(leaseKey(pur.id), owner, now, LEASE_MS))) {", "if (false) {"]]],
  ["M3 drain without CAS (blind write)", [["service.ts", "if (!(await d.store.casSubscription(v.sub, v.version))) continue;", "await d.store.putSubscription(v.sub);"]]],
  ["M4 contention loses the facts (no re-hold)", [["service.ts", "} catch (e) { if (!(e as { factsRestored?: boolean })?.factsRestored) for (const f of late) await d.store.holdFact(`sub:${sub.id}`, f); throw e; }", "} catch (e) { throw e; }"], ["service.ts", "  if (fx.taken) for (const f of fx.taken) await d.store.holdFact(`sub:${id}`, f);\n  throw Object.assign(", "  throw Object.assign("]]], // hand merge 2026-11-10: the f261 port moved the contention re-hold into updateSubscription, so M4 removes both
  ["M5 unbounded scan", [["held_sweep.ts", "heldFactKeys(SUB_HELD_PREFIX, opts.cursor, b)", "heldFactKeys(SUB_HELD_PREFIX, opts.cursor, 1e9)"]]],
  ["M6 cursor ignored (head-of-line starvation)", [["held_sweep.ts", "heldFactKeys(SUB_HELD_PREFIX, opts.cursor, b)", "heldFactKeys(SUB_HELD_PREFIX, undefined, b)"]]],
  ["M7 sweep touches an unseeded row's facts (reads rows with no subscription)", [["held_sweep.ts", "if (!sub) { rep.skipped++; continue; }", "if (!sub) { await store.takeFacts(key); rep.skipped++; continue; }"]]],
];
for (const [name, edits] of MUTANTS) for (const kind of ["memory", "d1"] as Kind[]) {
  test(`f356 mutant ${name} is caught (${kind})`, async () => { assert.ok((await violations(await load(edits), kind)).length > 0, `${name} survived on ${kind}`); });
}
