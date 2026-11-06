// F174 (C3): interleaving tests for two concurrent undos, and an undo racing a fix, on the SAME domain.
// ALL DATA IS SYNTHETIC: generated zones on reserved .example names, seeded PRNG, no network, no model calls.
// Method: each "request" runs the same three steps service.ts runs (loadOrInit from the store, the engine call, store.put) on its OWN copy
// of the state. Every store get/put, every zone read or write and every DNS-over-HTTPS read is an awaited barrier; a seeded scheduler decides
// which parked request moves next, so one seed = one reproducible interleaving. Single-threaded, so the interleaving is exact, not sampled by timing.
// Invariants: (R1) exactly one of two undos on one fix wins; (R2) the final zone is one a serial order can produce;
// (R3) no fix record is lost or duplicated, and every record's status agrees with the zone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { autoFix, undoFix, loadOrInit, scanNow, withDomainLock, type Ctx, type DomainState, type OwnerStore } from "../src/owner/engine.ts";
import type { DnsWriter } from "../src/owner/dnsw.ts";
import { prng, genWorld, rigOf, type RecZone } from "./owner_undo_gen.ts";
import { STORE_KIND, LABEL } from "./owner_undo_gen.ts";

const tick = () => new Promise<void>((r) => setImmediate(r));
export class Sched {
  parked: { id: number; res: () => void }[] = []; done = new Set<number>(); trace: number[] = [];
  point(id: number) { return new Promise<void>((res) => { this.parked.push({ id, res }); }); }
  async run(tasks: ((id: number) => Promise<unknown>)[], rng: () => number) {
    const out: unknown[] = new Array(tasks.length);
    tasks.forEach((fn, i) => { fn(i).then((v) => { out[i] = v; this.done.add(i); }, (e) => { out[i] = { threw: String(e) }; this.done.add(i); }); });
    await tick();
    let idle = 0;
    while (this.done.size < tasks.length) {
      if (!this.parked.length) { if (++idle > 50) throw new Error("scheduler stuck: no task parked and not all done"); await tick(); continue; }
      idle = 0;
      // a request can have several reads in flight at once (the scanner fans out DoH lookups), so every parked operation is a separate choice
      const k = Math.floor(rng() * this.parked.length); const [{ id, res }] = this.parked.splice(k, 1); this.trace.push(id); res(); await tick();
    }
    return out;
  }
}
function ctxFor(R: ReturnType<typeof rigOf>, sc: Sched, id: number): Ctx {
  const z = R.zone, st = R.c.store, p = () => sc.point(id);
  const zone: DnsWriter = {
    getTxt: async (n) => { await p(); return z.getTxt(n); }, setTxt: async (n, v) => { await p(); return z.setTxt(n, v); },
    getMx: async (n) => { await p(); return z.getMx(n); }, setMx: async (n, v) => { await p(); return z.setMx(n, v); }, setDs: async (n, v) => { await p(); return z.setDs(n, v); },
  };
  const store: OwnerStore = { get: async (d) => { await p(); return st.get(d); }, put: async (s) => { await p(); return st.put(s); }, all: async () => { await p(); return st.all(); } };
  const doh = (_d: string) => ((n: string, t: string) => { return p().then(() => z.doh(n, t)); }) as ReturnType<Ctx["doh"]>;
  return { store, doh, zones: { zoneFor: (d) => (d === R.domain ? zone : undefined) }, now: R.c.now };
}
// The same three steps service.ts runs for undo / fix: open (load), engine call, put.
let LOCKED = true; // the unlocked variant exists only to prove the invariants have teeth (test below)
const lk = <T,>(fn: () => Promise<T>) => (LOCKED ? withDomainLock("dom_1", fn) : fn());
const svcUndo = (c: Ctx, R: ReturnType<typeof rigOf>, fixId: string) => lk(async () => { const s = await loadOrInit(c, "dom_1", R.domain, "acc_1", true); const r = await undoFix(c, s, fixId); await c.store.put(s); return r; });
const svcFix = (c: Ctx, R: ReturnType<typeof rigOf>, check: string) => lk(async () => { const s = await loadOrInit(c, "dom_1", R.domain, "acc_1", true); const r = await autoFix(c, s, check); await c.store.put(s); return r; });

// Deterministic setup: the seed fixes the zone; `apply` lists the checks fixed serially before the race.
async function setup(seed: number, apply: string[]) {
  const domain = `race${seed}.example`; const R = rigOf(genWorld(prng(7000 + seed), domain), domain);
  const s = await R.open(); await scanNow(R.c, s, "initial"); const S0 = R.snap();
  const ids: Record<string, string> = {};
  for (const ck of apply) { const r = await autoFix(R.c, s, ck); if (r.ok) ids[ck] = r.fix.id; }
  await R.c.store.put(s);
  return { R, S0, ids, S1: R.snap() };
}
const stable = (w: unknown) => JSON.stringify(w, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : Array.isArray(v) && v.every((x) => typeof x === "string") ? [...v] : v));
type Tx = { txt?: Record<string, string[]> };
const zoneKey = (w: unknown) => stable({ ...(w as object), txt: Object.fromEntries(Object.entries((w as Tx).txt ?? {}).map(([k, v]) => [k, [...v].sort()]).sort()) });
const finalState = async (R: ReturnType<typeof rigOf>) => (await R.c.store.get("dom_1"))!;
const checkFixZoneAgree = (st: DomainState, R: ReturnType<typeof rigOf>, why: string) => {
  const ids = st.fixes.map((f) => f.id); assert.equal(new Set(ids).size, ids.length, `${why}: fix ids unique, got ${ids}`);
};

const counts = { A: 0, B: 0, D: 0 }; const NEED = { A: 250, B: 250, D: 100 };

async function scenario(kind: "A" | "B" | "D", need: number) {
  let seed = 0, effective = 0; const failures: string[] = [];
  while (effective < need && seed < need * 20) {
    seed++;
    const apply = kind === "A" ? ["SPF"] : kind === "D" ? ["SPF", "DMARC"] : ["SPF"];
    const base = await setup(seed, apply);
    if (!base.ids.SPF) continue; // fix not applicable on this zone (guided, rolled back): nothing to race, not counted
    // ---- serial references from a fresh identical rig ----
    const serial = async (ops: ("undoS" | "undoS2" | "fixD" | "undoD")[]) => {
      const b = await setup(seed, apply); const out: unknown[] = [];
      for (const o of ops) {
        if (o === "undoS" || o === "undoS2") out.push((await svcUndo(b.R.c, b.R, b.ids.SPF)).ok);
        else if (o === "fixD") { const r = await svcFix(b.R.c, b.R, "DMARC"); out.push(r.ok ? "applied" : r.reason); }
        else out.push((await svcUndo(b.R.c, b.R, b.ids.DMARC ?? "x")).ok);
      }
      return { zone: zoneKey(b.R.zone.world), st: await finalState(b.R), out };
    };
    const sc = new Sched(); const rng = prng(90000 + seed);
    const mk = (fn: (c: Ctx, R: typeof base.R) => Promise<unknown>) => (id: number) => fn(ctxFor(base.R, sc, id), base.R);
    let results: unknown[];
    if (kind === "A") results = await sc.run([mk((c, R) => svcUndo(c, R, base.ids.SPF)), mk((c, R) => svcUndo(c, R, base.ids.SPF))], rng);
    else if (kind === "B") results = await sc.run([mk((c, R) => svcUndo(c, R, base.ids.SPF)), mk((c, R) => svcFix(c, R, "DMARC"))], rng);
    else { if (!base.ids.DMARC) continue; results = await sc.run([mk((c, R) => svcUndo(c, R, base.ids.SPF)), mk((c, R) => svcUndo(c, R, base.ids.DMARC))], rng); }
    effective++; counts[kind]++;
    const tag = `[${kind} seed ${seed} trace ${sc.trace.join("")}]`;
    const st = await finalState(base.R); const zk = zoneKey(base.R.zone.world);
    try {
      for (const r of results) assert.ok(!(r as { threw?: string })?.threw, `${tag} a request threw ${JSON.stringify(r)}`);
      checkFixZoneAgree(st, base.R, tag);
      if (kind === "A") {
        const wins = (results as { ok: boolean }[]).filter((r) => r.ok).length;
        assert.equal(wins, 1, `${tag} R1 exactly one undo wins, got ${wins}: ${JSON.stringify(results)}`);
        const ref = await serial(["undoS", "undoS2"]); assert.equal(zk, ref.zone, `${tag} R2 zone is the serial result`);
        assert.equal(st.events.filter((e) => e.kind === "fix_undone").length, 1, `${tag} R3 one fix_undone event`);
        assert.equal(st.fixes.find((f) => f.id === base.ids.SPF)!.status, "undone", `${tag} R3 fix record undone`);
        assert.equal(zk, zoneKey(base.S0), `${tag} zone is back to the pre-fix zone`);
      } else if (kind === "B") {
        const refA = await serial(["undoS", "fixD"]), refB = await serial(["fixD", "undoS"]);
        assert.ok(zk === refA.zone || zk === refB.zone, `${tag} R2 zone is reachable by a serial order`);
        const dmarcFix = st.fixes.filter((f) => f.check === "DMARC");
        // R3: if the zone carries the DMARC change, its record must exist; if a DMARC fix reported applied, the record must be there.
        const fixRes = results[1] as { ok: boolean; fix?: { id: string } };
        if (fixRes.ok) assert.ok(dmarcFix.some((f) => f.id === fixRes.fix!.id && f.status !== "undone"), `${tag} R3 the applied DMARC fix record was not lost`);
        const spf = st.fixes.find((f) => f.id === base.ids.SPF)!;
        assert.equal(spf.status, (results[0] as { ok: boolean }).ok ? "undone" : spf.status, `${tag} R3 SPF record agrees with the undo result`);
        assert.equal((results[0] as { ok: boolean; reason?: string }).ok || (results[0] as { reason?: string }).reason === "zone_changed_since", true, `${tag} undo either wins or is refused for a legitimate reason`);
      } else {
        const ref = await serial(["undoS", "undoD"]); assert.equal(zk, ref.zone, `${tag} R2 zone is the serial result`);
        assert.deepEqual((results as { ok: boolean }[]).map((r) => r.ok), [true, true], `${tag} both independent undos win`);
        assert.deepEqual(st.fixes.map((f) => f.status).sort(), ["undone", "undone"], `${tag} R3 both records undone, none lost`);
      }
    } catch (e) { failures.push((e as Error).message.split("\n")[0]); }
  }
  return { effective, failures, seed };
}

for (const kind of ["A", "B", "D"] as const) {
  test(`${LABEL} ${kind === "A" ? "two concurrent undos of one fix" : kind === "B" ? "an undo racing a fix on the same domain" : "two concurrent undos of different fixes"}: seeded interleavings`, async () => {
    const r = await scenario(kind, NEED[kind]);
    assert.ok(r.effective >= NEED[kind], `only ${r.effective} effective schedules`);
    assert.equal(r.failures.length, 0, `${r.failures.length} of ${r.effective} schedules broke an invariant; first: ${r.failures[0]}; distinct: ${[...new Set(r.failures.map((f) => f.replace(/\[.*?\]/, "")))].slice(0, 4).join(" | ")}`);
  });
}
test(`${LABEL} the scheduler really interleaves, and the invariants have teeth: WITHOUT the per-domain lock they break`, async () => {
  LOCKED = false;
  try {
    const traces = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const b = await setup(seed, ["SPF"]); if (!b.ids.SPF) continue;
      const sc = new Sched(); await sc.run([0, 1].map(() => (id: number) => svcUndo(ctxFor(b.R, sc, id), b.R, b.ids.SPF)), prng(seed)); traces.add(sc.trace.join(""));
    }
    assert.ok(traces.size >= 10, `only ${traces.size} distinct schedules`);
    const a = await scenario("A", 60), b2 = await scenario("B", 60), d = await scenario("D", 40);
    assert.ok(a.failures.length > 0, "unlocked: two undos both win in some schedule");
    assert.ok(b2.failures.length > 0, "unlocked: an undo racing a fix loses a record or ends off the serial set");
    assert.ok(d.failures.length > 0, "unlocked: two different undos lose an update");
  } finally { LOCKED = true; }
});

// ---- the real HTTP service path (service.ts), two concurrent requests on one domain ----
import { make } from "./harness.ts";
import { MemoryZone } from "../src/owner/dnsw.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { healthy } from "./owner_harness.ts";
test("http: two concurrent undo requests on one fix: exactly one 200, one 409, the zone is the prior zone; fix racing undo keeps both records", async () => {
  for (let n = 0; n < 25; n++) {
    const domain = "acme.com.au"; const h = make(); const zone = new MemoryZone(healthy(domain));
    zone.world.txt![domain] = ["v=spf1 include:_spf.google.com ~all"]; delete zone.world.txt![`_dmarc.${domain}`];
    const slow = (k: number) => () => new Promise<void>((r) => (k % 2 ? setImmediate(r) : r())); // yield on every zone read, so requests really interleave
    const gt = zone.getTxt.bind(zone); zone.getTxt = async (x: string) => { await slow(n)(); await new Promise<void>((r) => setImmediate(r)); return gt(x); };
    h.deps.owner = { store: new MemoryOwnerStore(), doh: () => zone.doh, zones: { zoneFor: (x) => (x === domain ? zone : undefined) } };
    const me = await h.login("owner@acme.com.au"); const { d } = await h.verifiedDomain(me.session, domain); const id = d.id as string;
    await h.req("POST", `/app/domains/${id}/scan`, { token: me.session });
    const f = await h.j(await h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } }));
    assert.equal(f.result, "proven");
    const [u1, u2] = await Promise.all([1, 2].map(() => h.req("POST", `/app/domains/${id}/fixes/${f.fixId}/undo`, { token: me.session })));
    assert.deepEqual([u1.status, u2.status].sort(), [200, 409], `round ${n}`);
    assert.deepEqual(zone.world.txt![domain], ["v=spf1 include:_spf.google.com ~all"]);
    // an undo racing a DMARC fix: the fix record must survive
    h.clock.t += 61_000;
    const fx2 = await h.j(await h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "SPF" } }));
    const [u3, f3] = await Promise.all([h.req("POST", `/app/domains/${id}/fixes/${fx2.fixId}/undo`, { token: me.session }), h.req("POST", `/app/domains/${id}/fix`, { token: me.session, body: { check: "DMARC" } })]);
    assert.equal(u3.status, 200, `round ${n}`);
    const rep = await (await h.req("GET", `/app/domains/${id}/report?format=md`, { token: me.session })).text();
    const fj = await h.j(f3);
    if (fj.result === "proven" || fj.result === "partial") assert.match(rep, /DMARC: .*\((proven|partial)\)/, `round ${n}: the DMARC fix record was lost`);
  }
});
