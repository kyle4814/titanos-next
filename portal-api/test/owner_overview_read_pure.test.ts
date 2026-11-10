// F377 (C2 residual): getOverview is a READ. A GET must not write: no rev bump, no row created, no audit event persisted,
// and N reads leave the stored snapshot byte-identical. The first real mutation still persists the derived monitor state.
// Synthetic data only. Runs the real service over MemoryOwnerStore and over D1OwnerStore (real SQLite via FakeD1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore, type OwnerStore } from "../src/owner/engine.ts";
import { D1OwnerStore } from "../src/owner/d1ownerstore.ts";
import { FakeD1 } from "./owner_fake_d1.ts";
import { getOverview, getReport, listDomains, scan } from "../src/owner/service.ts";
import { healthy } from "./owner_harness.ts";

const domain = "readonly.com.au";
type Rig = { h: ReturnType<typeof make>; me: any; id: string; writes: () => number; snap: () => Promise<string>; store: OwnerStore };
async function rigFor(kind: "memory" | "d1"): Promise<Rig> {
  const h = make(); const zone = new MemoryZone(healthy(domain));
  let store: OwnerStore; let writes = () => 0; let snap: () => Promise<string>; let d1: FakeD1 | undefined;
  if (kind === "memory") {
    const m = new MemoryOwnerStore(); let n = 0;
    const put = m.put.bind(m); m.put = async (s) => { n++; return put(s); };
    const pc = m.putCas.bind(m); m.putCas = async (s, r) => { const ok = await pc(s, r); if (ok) n++; return ok; };
    store = m; writes = () => n; snap = async () => JSON.stringify((await m.all()));
  } else {
    d1 = new FakeD1(); store = new D1OwnerStore(d1, () => 0);
    writes = () => d1!.log.filter((l) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(l.sql) && /owner_state/.test(l.sql)).length;
    snap = async () => JSON.stringify(d1!.db.prepare("SELECT * FROM owner_state ORDER BY domain_id").all());
  }
  h.deps.owner = { store, doh: () => zone.doh, zones: { zoneFor: (x) => (x === domain ? zone : undefined) } };
  const me = await h.login("ro@example.test");
  const { d } = await h.verifiedDomain(me.session, domain);
  if (d1) {
    d1.db.prepare("INSERT INTO accounts (id, email) VALUES (?, ?)").run(me.account.id, "ro@example.test");
    d1.db.prepare("INSERT INTO domains (id, account_id, domain, verify_token) VALUES (?, ?, ?, 't')").run(d.id, me.account.id, domain);
  }
  return { h, me, id: d.id, writes, snap, store };
}
for (const kind of ["memory", "d1"] as const) {
  test(`${kind}: fresh owner, two getOverview calls write nothing (no row, no rev, no audit event)`, async () => {
    const r = await rigFor(kind); const a = r.me.account;
    const before = await r.snap(); const w0 = r.writes();
    const o1 = await getOverview(r.h.deps, a, r.id); const o2 = await getOverview(r.h.deps, a, r.id);
    assert.equal(r.writes(), w0, "a read must perform zero store writes");
    assert.equal(await r.snap(), before, "stored snapshot unchanged");
    assert.equal(await r.store.get(r.id), undefined, "no row created by a GET");
    assert.deepEqual(o1, o2);
  });
  test(`${kind}: N getOverview/getReport/listDomains calls leave rev, audit and snapshot byte-identical`, async () => {
    const r = await rigFor(kind); const a = r.me.account;
    await scan(r.h.deps, a, r.id); // first real mutation persists
    const row = (await r.store.get(r.id))!; const before = await r.snap(); const w0 = r.writes();
    for (let i = 0; i < 6; i++) { await getOverview(r.h.deps, a, r.id); await getReport(r.h.deps, a, r.id); await listDomains(r.h.deps, a); }
    assert.equal(r.writes(), w0);
    assert.equal(await r.snap(), before);
    const after = (await r.store.get(r.id))!;
    assert.equal(after.rev, row.rev); assert.deepEqual(after.events, row.events);
  });
  test(`${kind}: the first real mutation still persists the monitor_on view; its overview agrees with what a read showed`, async () => {
    const r = await rigFor(kind); const a = r.me.account;
    const o = await getOverview(r.h.deps, a, r.id);
    assert.equal(await r.store.get(r.id), undefined);
    const o2 = await scan(r.h.deps, a, r.id);
    const s = (await r.store.get(r.id))!; assert.equal(s.rev, 1); assert.ok(s.scans >= 1);
    assert.equal(s.monitor.active, o.monitor.active);
    assert.equal(s.events.filter((e) => e.kind === "monitor_on").length, o.monitor.active ? 1 : 0);
    assert.equal(o2.monitor.active, o.monitor.active);
  });
}

// Entitlement reaches the stored flag via the write path (runMonitor's reconcile), never via a GET; a second pass is a no-op.
test("memory: paid monitor activates on the scheduler reconcile, not on a GET; second reconcile writes nothing", async () => {
  const { reconcileMonitorEntitlements } = await import("../src/owner/service.ts");
  const r = await rigFor("memory"); const a = r.me.account;
  await scan(r.h.deps, a, r.id);
  await r.h.req("POST", "/checkout", { token: r.me.session, body: { product: "monitor_monthly", domain } }); await r.h.pay("monitor_monthly");
  const before = await r.snap(); await getOverview(r.h.deps, a, r.id);
  assert.equal(await r.snap(), before, "GET after payment writes nothing");
  assert.equal((await r.store.get(r.id))!.monitor.active, false);
  assert.equal(await reconcileMonitorEntitlements(r.h.deps), 1);
  assert.equal((await r.store.get(r.id))!.monitor.active, true);
  const w = r.writes(); assert.equal(await reconcileMonitorEntitlements(r.h.deps), 0); assert.equal(r.writes(), w);
});
