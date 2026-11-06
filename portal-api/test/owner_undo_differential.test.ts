// F173: store DIFFERENTIAL. The same seeded scenario runs on MemoryOwnerStore and on D1OwnerStore (FakeD1) and the observable
// outcomes must be identical: per-step results, the zone after each step, and the owner state as JSON (what a reader of either store sees).
// SYNTHETIC data only (.example names, seeded PRNG), no network, no model calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanNow, setMonitor, autoFix, undoFix, monitorTick } from "../src/owner/engine.ts";
import { FAULTS } from "./owner_faults.ts";
import { healthy, DAY } from "./owner_harness.ts";
import { prng, genWorld, rigOf, pick, int } from "./owner_undo_gen.ts";

type Kind = "memory" | "d1";
async function trace(kind: Kind, i: number) {
  const r = prng(1000 + i); const domain = `gen${i}.example`;
  const R = rigOf(genWorld(r, domain), domain, kind);
  const s = await R.open(); await scanNow(R.c, s, "initial");
  const out: unknown[] = []; const ids: string[] = [];
  for (const check of ["SPF", "DMARC"]) {
    const res = await autoFix(R.c, s, check); out.push(["fix", check, res.ok ? "ok" : res.reason, R.snap()]);
    if (res.ok) ids.push(res.fix.id);
  }
  await R.c.store.put(s);
  out.push(["stored", JSON.parse(JSON.stringify(await R.c.store.get("dom_1")))]);
  for (const id of [...ids].reverse()) { const u = await undoFix(R.c, s, id); out.push(["undo", id, u.ok, R.snap()]); const u2 = await undoFix(R.c, s, id); out.push(["undo2", u2.ok, u2.ok ? null : u2.reason]); }
  await R.c.store.put(s);
  out.push(["final", JSON.parse(JSON.stringify(await R.c.store.get("dom_1"))), R.snap()]);
  return out;
}
test("DIFF-1 apply, undo, undo again: identical results, zones and stored state on both stores (200 synthetic zones)", async () => {
  for (let i = 0; i < 200; i++) assert.deepEqual(await trace("d1", i), await trace("memory", i), `zone ${i}`);
});
async function badgeRun(kind: Kind, i: number) {
  const r = prng(5000 + i); const domain = `dif${i}.example`; const R = rigOf(healthy(domain), domain, kind);
  const chosen = Array.from({ length: int(r, 1, 3) }, () => pick(r, FAULTS));
  const s = await R.open(); for (const f of chosen) f.plant(R.zone, domain);
  setMonitor(s, true, R.clock.t); await scanNow(R.c, s); await R.c.store.put(s);
  for (const f of chosen) await f.ownerFix(R.zone, domain);
  await scanNow(R.c, s); await R.c.store.put(s);
  const f = pick(r, chosen); f.plant(R.zone, domain); R.clock.t += DAY;
  const tick = await monitorTick(R.c);
  const stored = JSON.parse(JSON.stringify((await R.c.store.get("dom_1"))!));
  return { badge: stored.badge ?? null, finding: stored.findings[f.check].state, alerts: tick.alerts.map((a) => a.kind), stored };
}
test("DIFF-2 badge earned, fault returns, monitorTick: identical alerts and stored state on both stores (80 trials)", async () => {
  for (let i = 0; i < 80; i++) assert.deepEqual(await badgeRun("d1", i), await badgeRun("memory", i), `trial ${i}`);
});
test("DIFF-3 the one KNOWN representation difference: `badge = undefined` is a present key in memory and an absent key in D1 (equal as JSON)", async () => {
  const mem = rigOf(healthy("k.example"), "k.example", "memory"), d1 = rigOf(healthy("k.example"), "k.example", "d1");
  for (const R of [mem, d1]) { const s = await R.open(); s.badge = undefined; await R.c.store.put(s); }
  const a = (await mem.c.store.get("dom_1"))!, b = (await d1.c.store.get("dom_1"))!;
  assert.equal("badge" in a, true); assert.equal("badge" in b, false);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
