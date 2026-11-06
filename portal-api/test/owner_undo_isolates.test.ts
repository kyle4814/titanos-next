// F185 (C3): TWO ISOLATES over ONE shared store. F174 serialised requests with an in-process lock, which only holds inside one Worker isolate.
// Here each simulated isolate is its own request context with its OWN lock table (what a second isolate really has) over one shared store
// (MemoryOwnerStore, and D1OwnerStore on a FakeD1 / node:sqlite). Two modes run the SAME seeded interleavings:
//   LOCK-ONLY  the F174 code: per-isolate withDomainLock + plain load / mutate / put. EXPECTED to lose updates (asserted: it has teeth).
//   CAS        the F185 code: casTx (load, mutate, putCas on the per-domain revision, bounded retry), no lock. EXPECTED to lose none.
// ALL DATA IS SYNTHETIC (.example zones from the F95 generator, seeded PRNG, no network, no model calls). Math.random is seeded per schedule
// because FakeD1 yields a random number of ticks per call, so one seed = one exact, reproducible interleaving.
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoFix, undoFix, loadOrInit, scanNow, casTx, withDomainLock, type Ctx, type DomainState, type OwnerStore } from "../src/owner/engine.ts";
import type { DnsWriter } from "../src/owner/dnsw.ts";
import { prng, genWorld, rigOf, type RecZone } from "./owner_undo_gen.ts";

const tick = () => new Promise<void>((r) => setImmediate(r));
class Sched {
  parked: { id: number; res: () => void }[] = []; done = new Set<number>(); trace: number[] = [];
  point(id: number) { return new Promise<void>((res) => { this.parked.push({ id, res }); }); }
  async run(tasks: ((id: number) => Promise<unknown>)[], rng: () => number) {
    const out: unknown[] = new Array(tasks.length);
    tasks.forEach((fn, i) => { fn(i).then((v) => { out[i] = v; this.done.add(i); }, (e) => { out[i] = { threw: String(e) }; this.done.add(i); }); });
    await tick(); let idle = 0;
    while (this.done.size < tasks.length) {
      if (!this.parked.length) { if (++idle > 200) throw new Error("scheduler stuck"); await tick(); continue; }
      idle = 0; const k = Math.floor(rng() * this.parked.length); const [{ id, res }] = this.parked.splice(k, 1); this.trace.push(id); res(); await tick();
    }
    return out;
  }
}
type Mode = "lock" | "cas";
type Rig = ReturnType<typeof rigOf>;
// One isolate: a barrier before every store call, zone call and DoH read. In lock mode the store shows no putCas (a pre-F185 store) and the
// isolate has a private lock table; casTx then falls back to put, and the lock is the only protection (exactly the F174 deployment).
function isolate(R: Rig, sc: Sched, id: number, mode: Mode) {
  const z = R.zone, st = R.c.store, p = () => sc.point(id);
  const zone: DnsWriter = {
    getTxt: async (n) => { await p(); return z.getTxt(n); }, setTxt: async (n, v) => { await p(); return z.setTxt(n, v); },
    getMx: async (n) => { await p(); return z.getMx(n); }, setMx: async (n, v) => { await p(); return z.setMx(n, v); }, setDs: async (n, v) => { await p(); return z.setDs(n, v); },
  };
  const store: OwnerStore = { get: async (d) => { await p(); return st.get(d); }, put: async (s) => { await p(); return st.put(s); }, all: async () => { await p(); return st.all(); } };
  if (mode === "cas") store.putCas = async (s, r) => { await p(); return st.putCas!(s, r); };
  const doh = (_d: string) => ((n: string, t: string) => p().then(() => z.doh(n, t))) as ReturnType<Ctx["doh"]>;
  const c: Ctx = { store, doh, zones: { zoneFor: (d) => (d === R.domain ? zone : undefined) }, now: R.c.now };
  // The isolate-local lock: a fresh module-level queue per isolate, emulated by a private chain (withDomainLock itself is one table per process).
  let tail: Promise<unknown> = Promise.resolve();
  const local = <T,>(fn: () => Promise<T>): Promise<T> => { const run = tail.then(fn, fn); tail = run.then(() => undefined, () => undefined); return run; };
  const tx = <T,>(body: (s: DomainState) => Promise<T>) => {
    const once = async () => { const s = await loadOrInit(c, "dom_1", R.domain, "acc_1", true); return { s, out: await body(s) }; };
    return mode === "cas" ? casTx(c, once).then((r) => r.out) : local(async () => { const r = await once(); await c.store.put(r.s); return r.out; });
  };
  return {
    undo: (fixId: string) => tx((s) => undoFix(c, s, fixId)),
    fix: (check: string) => tx((s) => autoFix(c, s, check)),
    scan: () => tx(async (s) => { await scanNow(c, s, "monitor"); return { ok: true as const }; }),
  };
}
async function setup(seed: number, apply: string[], kind: "memory" | "d1") {
  const domain = `iso${seed}.example`; const R = rigOf(genWorld(prng(7000 + seed), domain), domain, kind);
  const s = await R.open(); await scanNow(R.c, s, "initial"); const S0 = R.snap();
  const ids: Record<string, string> = {};
  for (const ck of apply) { const r = await autoFix(R.c, s, ck); if (r.ok) ids[ck] = r.fix.id; }
  await R.c.store.put(s);
  return { R, S0, ids };
}
type Tx = { txt?: Record<string, string[]> };
const zoneKey = (w: unknown) => JSON.stringify({ ...(w as object), txt: Object.fromEntries(Object.entries((w as Tx).txt ?? {}).map(([k, v]) => [k, [...v].sort()]).sort()) }, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
type Res = { ok: boolean; reason?: string; fix?: { id: string } };

async function scenario(kind: "A" | "B" | "D" | "E", need: number, mode: Mode, store: "memory" | "d1") {
  let seed = 0, effective = 0; const failures: string[] = []; const traces = new Set<string>(); const realRandom = Math.random;
  try {
    while (effective < need && seed < need * 20) {
      seed++;
      const apply = kind === "D" ? ["SPF", "DMARC"] : ["SPF"];
      Math.random = prng(31000 + seed);
      const base = await setup(seed, apply, store);
      if (!base.ids.SPF || (kind === "D" && !base.ids.DMARC)) continue;
      const serial = async (ops: string[]) => { // each op to completion, one after the other, on a fresh identical rig
        const b = await setup(seed, apply, store);
        for (const o of ops) {
          const sc = new Sched(); const i2 = isolate(b.R, sc, 0, "cas");
          await sc.run([() => (o === "undoS" ? i2.undo(b.ids.SPF) : o === "undoD" ? i2.undo(b.ids.DMARC ?? "x") : i2.fix("DMARC"))], prng(1));
        }
        return { zone: zoneKey(b.R.zone.world) };
      };
      const sc = new Sched(); const rng = prng(90000 + seed);
      const A = isolate(base.R, sc, 0, mode), B = isolate(base.R, sc, 1, mode);
      let results: unknown[];
      if (kind === "A") results = await sc.run([() => A.undo(base.ids.SPF), () => B.undo(base.ids.SPF)], rng);
      else if (kind === "B") results = await sc.run([() => A.undo(base.ids.SPF), () => B.fix("DMARC")], rng);
      else if (kind === "D") results = await sc.run([() => A.undo(base.ids.SPF), () => B.undo(base.ids.DMARC)], rng);
      else results = await sc.run([() => A.undo(base.ids.SPF), () => B.scan()], rng); // E: undo on one isolate, monitor scan on another
      effective++; traces.add(sc.trace.join(""));
      const tag = `[${kind} ${mode} ${store} seed ${seed}]`;
      const st = (await base.R.c.store.get("dom_1"))!; const zk = zoneKey(base.R.zone.world);
      try {
        for (const r of results) assert.ok(!(r as { threw?: string })?.threw, `${tag} a request threw ${JSON.stringify(r)}`);
        const ids = st.fixes.map((f) => f.id); assert.equal(new Set(ids).size, ids.length, `${tag} fix ids unique`);
        const r0 = results[0] as Res;
        if (kind === "A") {
          assert.equal((results as Res[]).filter((r) => r.ok).length, 1, `${tag} R1 exactly one undo wins`);
          assert.equal(st.events.filter((e) => e.kind === "fix_undone").length, 1, `${tag} R3 one fix_undone event`);
          assert.equal(st.fixes.find((f) => f.id === base.ids.SPF)!.status, "undone", `${tag} R3 record undone`);
          assert.equal(zk, zoneKey(base.S0), `${tag} zone is the pre-fix zone`);
        } else if (kind === "B") {
          const refA = await serial(["undoS", "fixD"]), refB = await serial(["fixD", "undoS"]);
          const fx = results[1] as Res;
          // A third LEGAL outcome exists once the two really overlap: the undo reverts SPF while the DMARC fix is proving itself, the proof re-scan
          // sees SPF broken and the fix rolls itself back ("it broke SPF"). The zone is then SPF-undone with no DMARC, the record says rolled_back.
          const rolled = fx.reason === "rolled_back" && st.fixes.some((f) => f.check === "DMARC" && f.status === "rolled_back");
          if (rolled) assert.equal(zk, (await serial(["undoS"])).zone, `${tag} R2 a rolled-back DMARC leaves exactly the undo-only zone`);
          else assert.ok(zk === refA.zone || zk === refB.zone, `${tag} R2 zone reachable by a serial order`);
          if (fx.ok) assert.ok(st.fixes.some((f) => f.id === fx.fix!.id && f.status !== "undone"), `${tag} R3 the applied DMARC fix record was lost`);
          const spf = st.fixes.find((f) => f.id === base.ids.SPF)!;
          assert.equal(spf.status, r0.ok ? "undone" : spf.status, `${tag} R3 SPF record agrees with the undo result`);
        } else if (kind === "D") {
          assert.deepEqual((results as Res[]).map((r) => r.ok), [true, true], `${tag} both independent undos win`);
          assert.deepEqual(st.fixes.map((f) => f.status).sort(), ["undone", "undone"], `${tag} R3 both records undone, none lost`);
        } else {
          assert.equal(r0.ok, true, `${tag} the undo wins`);
          assert.equal(st.fixes.find((f) => f.id === base.ids.SPF)!.status, "undone", `${tag} R3 the scan's put did not resurrect the fix record (lost update)`);
          assert.equal(st.events.filter((e) => e.kind === "fix_undone").length, 1, `${tag} R3 the fix_undone event survived the scan's write`);
        }
      } catch (e) { failures.push((e as Error).message.split("\n")[0]); }
    }
  } finally { Math.random = realRandom; }
  return { effective, failures, distinct: traces.size };
}
const NEED = { A: 250, B: 250, D: 100, E: 150 } as const;
const stores = ["memory", "d1"] as const;
const lost: Record<string, string> = {};
for (const store of stores) for (const kind of ["A", "B", "D", "E"] as const) {
  test(`F185 CAS: two isolates, one ${store} store, scenario ${kind}: ${NEED[kind]} seeded schedules, no lost update`, async () => {
    const r = await scenario(kind, NEED[kind], "cas", store);
    lost[`${store}/${kind}/cas`] = `${r.failures.length}/${r.effective}`;
    assert.ok(r.effective >= NEED[kind]); assert.ok(r.distinct >= 20, `only ${r.distinct} distinct schedules`);
    assert.equal(r.failures.length, 0, `${r.failures.length} of ${r.effective} broke an invariant; first: ${r.failures[0]}`);
  });
  test(`F185 teeth: the same ${NEED[kind]} schedules on the F174 code (per-isolate lock + plain put, ${store}, scenario ${kind}) DO lose updates`, async () => {
    const r = await scenario(kind, NEED[kind], "lock", store);
    lost[`${store}/${kind}/lock`] = `${r.failures.length}/${r.effective}`;
    assert.ok(r.failures.length > 0, `lock-only code survived every schedule (the harness has no teeth for ${kind})`);
  });
}
test("F185 totals (printed for the receipt)", () => { console.log("LOST-UPDATE TABLE (violating schedules / schedules): " + JSON.stringify(lost)); });

// ---- the store contract the CAS rests on (both adapters) ----
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { D1OwnerStore } from "../src/owner/d1ownerstore.ts";
import { FakeD1 } from "./owner_fake_d1.ts";
import { newState } from "../src/owner/engine.ts";
function mkStore(kind: "memory" | "d1") {
  if (kind === "memory") return new MemoryOwnerStore();
  const d1 = new FakeD1(); for (const a of ["a1", "a2"]) d1.db.prepare("INSERT INTO accounts (id, email) VALUES (?, ?)").run(a, `${a}@example.test`);
  for (const [id, a] of [["d1", "a1"]]) d1.db.prepare("INSERT INTO domains (id, account_id, domain, verify_token) VALUES (?, ?, ?, 't')").run(id, a, `${id}.example`);
  return new D1OwnerStore(d1, () => 1);
}
for (const kind of ["memory", "d1"] as const) test(`F185 putCas contract (${kind}): stale revision refused, fresh accepted, first insert races, other account refused`, async () => {
  const st = mkStore(kind); const base = () => newState("d1", "d1.example", "a1", true);
  const x = base(), y = base();                                  // two isolates that both saw "no row yet"
  assert.equal(await st.putCas!(x, 0), true); assert.equal(x.rev, 1);
  assert.equal(await st.putCas!(y, 0), false, "second first-insert loses"); assert.equal(y.rev, undefined);
  const a = (await st.get("d1"))!, b = (await st.get("d1"))!; assert.equal(a.rev, 1);
  a.xp = 5; b.xp = 9;
  assert.equal(await st.putCas!(a, a.rev!), true); assert.equal(a.rev, 2);
  assert.equal(await st.putCas!(b, b.rev!), false, "stale revision refused");
  assert.equal((await st.get("d1"))!.xp, 5, "the loser wrote nothing"); assert.equal((await st.get("d1"))!.rev, 2);
  const c = (await st.get("d1"))!; await st.put(c); assert.equal((await st.get("d1"))!.rev, 3, "plain put advances the revision, so an in-flight CAS cannot win after it");
  assert.equal(await st.putCas!(a, 2), false);
  const other = newState("d1", "d1.example", "a2", true); other.rev = 3;
  await assert.rejects(() => Promise.resolve(st.putCas!(other, 3)).then((ok) => { if (!ok) throw new Error("refused"); }), /refused|account_mismatch/);
});

// ---- write-ahead: the intent is durable BEFORE the zone is touched (phase 1 of autoFix) ----
test("F185 write-ahead: a zone write that dies leaves the fix record behind (status applied), so the half-done edit is visible and undoable", async () => {
  const domain = "wal.example"; const R = rigOf(genWorld(prng(7001), domain), domain, "memory");
  const s = await R.open(); await scanNow(R.c, s, "initial");
  const ctx: Ctx = { ...R.c, zones: { zoneFor: () => ({ ...R.zone, getTxt: async (n: string) => R.zone.getTxt(n), getMx: async (n: string) => R.zone.getMx(n), setMx: async () => {}, setDs: async () => {}, setTxt: async () => { throw new Error("provider down"); } }) } };
  let tried = 0;
  for (const ck of ["SPF", "DMARC"]) { const f = (await R.c.store.get("dom_1")) ?? s; f.rev = f.rev ?? 0; if (!f.findings[ck] || (f.findings[ck].state !== "OPEN" && f.findings[ck].state !== "REGRESSED")) continue; tried++;
    await assert.rejects(() => autoFix(ctx, f, ck), /provider down/); break; }
  assert.ok(tried > 0, "no fixable finding in this synthetic zone");
  const st = (await R.c.store.get("dom_1"))!;
  assert.equal(st.fixes.length, 1, "the intent was committed before the zone write"); assert.equal(st.fixes[0].status, "applied");
});

// ---- the real HTTP service path with TWO Deps (two isolates) over ONE account store, ONE owner store and ONE zone ----
import { make } from "./harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { healthy } from "./owner_harness.ts";
test("F185 http: two isolates (two Deps over one store): concurrent undo POSTs give exactly {200, 409}; an undo racing a DMARC fix keeps the DMARC record", async () => {
  for (let n = 0; n < 25; n++) {
    const domain = "acme.com.au"; const h1 = make(), h2 = make(); h2.deps.store = h1.deps.store; h2.deps.billing = h1.deps.billing; // same portal store, separate Deps and (here) no shared lock table
    const zone = new MemoryZone(healthy(domain)); zone.world.txt![domain] = ["v=spf1 include:_spf.google.com ~all"]; delete zone.world.txt![`_dmarc.${domain}`];
    const gt = zone.getTxt.bind(zone); zone.getTxt = async (x: string) => { for (let k = 0; k <= n % 3; k++) await new Promise<void>((r) => setImmediate(r)); return gt(x); };
    const owner = new MemoryOwnerStore(); for (const h of [h1, h2]) h.deps.owner = { store: owner, doh: () => zone.doh, zones: { zoneFor: (x) => (x === domain ? zone : undefined) } };
    const me = await h1.login("owner@acme.com.au"); const { d } = await h1.verifiedDomain(me.session, domain); const id = d.id as string;
    await h1.req("POST", `/app/domains/${id}/scan`, { token: me.session });
    const f = await h1.j(await h1.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } }));
    assert.equal(f.result, "proven");
    const [u1, u2] = await Promise.all([h1.req("POST", `/app/domains/${id}/fixes/${f.fixId}/undo`, { token: me.session }), h2.req("POST", `/app/domains/${id}/fixes/${f.fixId}/undo`, { token: me.session })]);
    assert.deepEqual([u1.status, u2.status].sort(), [200, 409], `round ${n}`);
    assert.deepEqual(zone.world.txt![domain], ["v=spf1 include:_spf.google.com ~all"]);
    h1.clock.t += 61_000; h2.clock.t = h1.clock.t;
    const fx2 = await h1.j(await h1.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } }));
    const [u3, f3] = await Promise.all([h1.req("POST", `/app/domains/${id}/fixes/${fx2.fixId}/undo`, { token: me.session }), h2.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "DMARC" } })]);
    assert.equal(u3.status, 200, `round ${n}`);
    const rep = await (await h1.req("GET", `/app/domains/${id}/report?format=md`, { token: me.session })).text();
    const fj = await h1.j(f3);
    if (fj.result === "proven" || fj.result === "partial") assert.match(rep, /DMARC: .*\((proven|partial)\)/, `round ${n}: the DMARC fix record was lost`);
  }
});
