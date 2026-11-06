import { test } from "node:test";
import assert from "node:assert/strict";
import { make, T0 } from "./harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore, DAY, type OwnerStore, type DomainState } from "../src/owner/engine.ts";
import { scheduled, workerScheduled, type CronLog } from "../src/owner/cron.ts";
import { healthy } from "./owner_harness.ts";

// All data synthetic (example domains, mock mailer, mock billing, fake clock).
async function rig(domains: string[], opts: { paid?: string[] } = {}) {
  const h = make();
  const zones = new Map(domains.map((d) => [d, new MemoryZone(healthy(d))]));
  const owner = new MemoryOwnerStore();
  const wrap: Record<string, (doh: any) => any> = {};
  h.deps.owner = { store: owner, doh: (d) => (wrap[d] ? wrap[d](zones.get(d)!.doh) : zones.get(d)!.doh), zones: { zoneFor: (d) => zones.get(d) } };
  const ids: Record<string, string> = {};
  const paid = opts.paid ?? domains;
  for (const [i, dom] of domains.entries()) {
    const me = await h.login(`owner${i}@${dom}`);
    const { d } = await h.verifiedDomain(me.session, dom);
    ids[dom] = d.id;
    if (paid.includes(dom)) {
      await h.req("POST", "/checkout", { token: me.session, body: { product: "monitor_monthly", domain: dom } });
      await h.pay("monitor_monthly");
    }
    await h.req("GET", `/app/domains/${d.id}`, { token: me.session }); // opening the seat switches the monitor on when entitled
  }
  const logs: CronLog[] = [];
  return { h, zones, owner, wrap, ids, logs, log: (e: CronLog) => logs.push(e), run: (st = T0 + DAY, o = {}) => scheduled({ scheduledTime: st }, h.deps, { log: (e) => logs.push(e), ...o }) };
}

test("cron: due vs not due", async () => {
  const r = await rig(["a.com.au", "b.com.au"]);
  r.h.clock.t = T0 + 1000;
  assert.equal((await r.run(T0)).scanned, 2, "nextScanAt is the moment the monitor switched on, so both are due");
  const s = await r.owner.get(r.ids["a.com.au"]);
  assert.equal(s!.monitor.nextScanAt, T0 + 1000 + DAY, "next scan moved a full interval ahead");
  r.h.clock.t = T0 + 2 * DAY;
  const second = await r.run(T0 + DAY);
  assert.equal(second.scanned, 2);
  r.h.clock.t += 1000;
  const none = await r.run(T0 + DAY + 1);
  assert.equal(none.due, 0); assert.equal(none.scanned, 0);
});

test("cron: unpaid and cancelled are skipped and switched off", async () => {
  const r = await rig(["paid.com.au", "free.com.au"], { paid: ["paid.com.au"] });
  const free = (await r.owner.get(r.ids["free.com.au"]))!;
  assert.equal(free.monitor.active, false, "free tier never active");
  // force a stale active flag on the unpaid domain (e.g. subscription cancelled after the seat was last opened)
  free.monitor = { active: true, intervalMs: DAY, nextScanAt: T0 }; await r.owner.put(free);
  r.h.clock.t = T0 + DAY;
  const res = await r.run();
  assert.equal(res.scanned, 1); assert.equal(res.skippedUnpaid, 1);
  assert.equal((await r.owner.get(r.ids["free.com.au"]))!.monitor.active, false);
  assert.equal((await r.owner.get(r.ids["free.com.au"]))!.scans, 0, "no scan ran for the unpaid domain");
  assert.ok(r.logs.some((l) => l.reason === "unpaid_skipped" && l.domain === "free.com.au"));
});

test("cron: the same tick delivered twice scans once", async () => {
  const r = await rig(["a.com.au"]);
  r.h.clock.t = T0 + DAY;
  const a = await r.run(777), b = await r.run(777);
  assert.equal(a.scanned, 1); assert.equal(b.ran, false); assert.equal(b.reason, "duplicate_fire"); assert.equal(b.scanned, 0);
  assert.equal((await r.owner.get(r.ids["a.com.au"]))!.scans, 1);
  // concurrent delivery: only one claim wins
  const r2 = await rig(["c.com.au"]); r2.h.clock.t = T0 + DAY;
  const both = await Promise.all([r2.run(5), r2.run(5)]);
  assert.equal(both.filter((x) => x.ran).length, 1);
  assert.equal((await r2.owner.get(r2.ids["c.com.au"]))!.scans, 1);
});

test("cron: a different tick right after is also safe (nothing due)", async () => {
  const r = await rig(["a.com.au"]); r.h.clock.t = T0 + DAY;
  await r.run(1); const again = await r.run(2);
  assert.equal(again.ran, true); assert.equal(again.scanned, 0);
  assert.equal((await r.owner.get(r.ids["a.com.au"]))!.scans, 1);
});

test("cron: per-run cap leaves the rest for the next tick, oldest first", async () => {
  const r = await rig(["a.com.au", "b.com.au", "c.com.au"]);
  for (const [i, id] of Object.values(r.ids).entries()) { const s = (await r.owner.get(id))!; s.monitor.nextScanAt = T0 - (3 - i) * 1000; await r.owner.put(s); } // a is most overdue
  r.h.clock.t = T0 + DAY;
  const res = await r.run(1, { maxDomains: 2 });
  assert.equal(res.scanned, 2); assert.equal(res.skippedCap, 1);
  assert.equal((await r.owner.get(r.ids["c.com.au"]))!.scans, 0, "the least overdue waits");
  assert.ok(r.logs.some((l) => l.reason === "cap_hit"));
  r.h.clock.t += 1000;
  assert.equal((await r.run(2, { maxDomains: 2 })).scanned, 1, "next tick picks up the remainder");
});

test("cron: time budget stops the run", async () => {
  const r = await rig(["a.com.au", "b.com.au", "c.com.au"]);
  r.h.clock.t = T0 + DAY;
  // each scan costs 600 ms of fake time
  for (const d of ["a.com.au", "b.com.au", "c.com.au"]) r.wrap[d] = (doh) => (...a: any[]) => { r.h.clock.t += 200; return doh(...a); };
  const res = await r.run(1, { timeBudgetMs: 500 });
  assert.ok(res.scanned >= 1 && res.scanned < 3, `scanned ${res.scanned}`); assert.ok(res.skippedBudget >= 1);
  assert.ok(r.logs.some((l) => l.reason === "time_budget_hit"));
});

test("cron: owner store down fails closed, no run, reason logged", async () => {
  const r = await rig(["a.com.au"]); r.h.clock.t = T0 + DAY;
  const real = r.h.deps.owner!.store;
  const down: OwnerStore = { get: async () => { throw new Error("D1 down"); }, put: async () => { throw new Error("D1 down"); }, all: async () => { throw new Error("D1 down"); } };
  r.h.deps.owner!.store = down;
  const res = await r.run();
  assert.equal(res.ran, false); assert.equal(res.reason, "owner_store_unavailable"); assert.equal(res.scanned, 0);
  assert.ok(r.logs.some((l) => l.level === "error" && l.reason === "owner_store_unavailable"));
  assert.equal(r.h.mailer.outbox.filter((m) => /returned/.test(m.subject)).length, 0);
  r.h.deps.owner!.store = real;
  assert.equal((await r.run(99)).scanned, 1, "the same due domain is still picked up once the store is back (claim not burned? new tick id)");
  // owner seat absent entirely
  delete r.h.deps.owner; const none = await r.run(100); assert.equal(none.reason, "owner_seat_unavailable");
  // Worker entry with no adapters wired
  const w = await workerScheduled({}, {}, undefined, { log: r.log }); assert.equal(w.ran, false);
});

test("cron: claim store down fails closed (no scans)", async () => {
  const r = await rig(["a.com.au"]); r.h.clock.t = T0 + DAY;
  r.h.store.claimEvent = async () => { throw new Error("claim store down"); };
  const res = await r.run();
  assert.equal(res.ran, false); assert.equal(res.scanned, 0);
  assert.equal((await r.owner.get(r.ids["a.com.au"]))!.scans, 0);
});

test("cron: one domain throwing does not stop the rest", async () => {
  const r = await rig(["a.com.au", "b.com.au", "c.com.au"]);
  r.h.clock.t = T0 + DAY;
  const real = r.h.deps.owner!.store; // the store throws on write for a.com.au only (a real throw out of monitorTick)
  r.h.deps.owner!.store = { get: (i) => real.get(i), all: () => real.all(), put: async (s) => { if (s.domain === "a.com.au") throw new Error("write failed"); return real.put(s); } };
  const res = await r.run();
  assert.equal(res.scanned, 2, "b and c ran"); assert.deepEqual(res.failed.map((f) => f.domain), ["a.com.au"]); assert.ok(r.logs.some((l) => l.reason === "domain_failed"));
  assert.equal((await r.owner.get(r.ids["b.com.au"]))!.scans, 1); assert.equal((await r.owner.get(r.ids["c.com.au"]))!.scans, 1);
});

test("cron: a throwing mailer does not stop the rest; the regression is still recorded", async () => {
  const r = await rig(["a.com.au", "b.com.au"]);
  r.h.clock.t = T0; await r.run(1); // baseline scans
  // break SPF on both so each raises an alert
  for (const z of r.zones.values()) { const k = Object.keys(z.world.txt!)[0]; z.world.txt![k] = ["v=spf1 +all"]; }
  r.h.clock.t = T0 + 2 * DAY;
  let n = 0; const send = r.h.mailer.send.bind(r.h.mailer);
  r.h.mailer.send = async (...a: Parameters<typeof send>) => { if (++n === 1) throw new Error("smtp down"); return send(...a); };
  const res = await r.run(2);
  assert.equal(res.failed.length, 1); assert.ok(res.alerts >= 1, "the other domain still alerted"); assert.ok(r.h.mailer.outbox.some((m) => m.to === "owner1@b.com.au"));
  for (const id of Object.values(r.ids)) assert.equal((await r.owner.get(id))!.scans, 2, "both rescans persisted");
});

test("cron: alerts go through the existing mailer path", async () => {
  const r = await rig(["a.com.au"]); r.h.clock.t = T0; await r.run(1);
  const z = r.zones.get("a.com.au")!; z.world.txt!["a.com.au"] = ["v=spf1 +all"];
  r.h.clock.t = T0 + 2 * DAY; const res = await r.run(2);
  assert.ok(res.alerts >= 1); assert.ok(r.h.mailer.outbox.some((m) => /returned/.test(m.subject)));
  assert.doesNotMatch(r.h.mailer.outbox.at(-1)!.text, /[–—]/);
});
