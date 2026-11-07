// F206: the D1 throttle adapter. SYNTHETIC only (in-memory SQLite via FakeD1, fixed clock, no network, nothing live).
//  1 shared contract   : the existing throttle.test.ts runs unchanged-in-substance against BOTH adapters (child process).
//  2 concurrency       : 50 interleaved hits admit exactly N, also across two Throttle instances ("isolates") sharing one D1.
//  3 live lockout      : survives 1000+ other keys (Memory evicts it: the f204 known limit, kept as a negative control).
//  4 sweep             : rows bounded; live locks and live windows survive; sweep never changes a decision.
//  5 differential      : seeded random op sequence gives identical decisions on Memory and D1.
//  6 mutation          : a read-then-write adapter FAILS test 2; source mutants of the SQL die in the shared contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FakeD1 } from "./fake_d1.ts";
import { Throttle, MemoryThrottleStore, ThrottledError, throttleKey } from "../src/throttle.ts";
import type { AtomicThrottleStore } from "../src/throttle.ts";
import { D1ThrottleStore } from "../src/d1throttle.ts";

const N = 3, WIN = 60_000, LOCK = 120_000;
const D1SRC = fileURLToPath(new URL("../src/d1throttle.ts", import.meta.url));
const SUITE = fileURLToPath(new URL("./throttle.test.ts", import.meta.url));
const cfg = (c: { t: number }, extra: object = {}) => ({ maxFailures: N, windowMs: WIN, lockoutMs: LOCK, now: () => c.t, ...extra });
const fail = async () => { throw new Error("bad"); };
const attempt = (th: Throttle, k: string, ran: { n: number }) => th.guard(k, async () => { ran.n++; await new Promise((r) => setImmediate(r)); throw new Error("x"); }).then(() => "ok", (e) => (e instanceof ThrottledError ? "blocked" : "fail"));

// ---- 1 shared contract ----
function runSuite(env: Record<string, string>) {
  return spawnSync(process.execPath, ["--test", "--experimental-strip-types", SUITE], { env: { ...process.env, NODE_TEST_CONTEXT: undefined, ...env } as NodeJS.ProcessEnv, encoding: "utf8" });
}
test("shared contract: the existing throttle suite passes on Memory and on D1", () => {
  for (const adapter of ["memory", "d1"]) {
    const r = runSuite({ THROTTLE_ADAPTER: adapter });
    assert.equal(r.status, 0, `${adapter}: ${r.stdout.slice(-1500)}`);
    assert.match(r.stdout, /# fail 0/);
    assert.doesNotMatch(r.stdout, /# pass 0\b/);
  }
});

// ---- 2 concurrency ----
test("concurrency: 50 interleaved hits on one key admit exactly N (reserve level)", async () => {
  const c = { t: 1_000_000 }, d1 = new FakeD1(), store = new D1ThrottleStore(d1);
  const res = await Promise.all(Array.from({ length: 50 }, () => store.reserve("k", { maxFailures: N, windowMs: WIN, lockoutMs: LOCK }, c.t)));
  assert.equal(res.filter((r) => r.allowed).length, N);
  const blocked = res.filter((r) => !r.allowed) as { retryAfterSec: number }[];
  assert.equal(blocked.length, 50 - N); assert.ok(blocked.every((b) => b.retryAfterSec === 120));
  assert.equal((await store.stateOf("k"))!.fail_count, N, "refused hits never touch the count");
});
test("concurrency: 50 hits split over two Throttle instances sharing one D1 still run exactly N times", async () => {
  const c = { t: 1_000_000 }, d1 = new FakeD1();
  const a = new Throttle(cfg(c), new D1ThrottleStore(d1)), b = new Throttle(cfg(c), new D1ThrottleStore(d1));
  const ran = { n: 0 };
  const out = await Promise.all(Array.from({ length: 50 }, (_, i) => attempt(i % 2 ? a : b, "k", ran)));
  assert.equal(ran.n, N); assert.equal(out.filter((x) => x === "blocked").length, 50 - N);
});
test("concurrency: many keys at once stay independent (each admits exactly N)", async () => {
  const c = { t: 1_000_000 }, th = new Throttle(cfg(c), new D1ThrottleStore(new FakeD1()));
  const ran = { n: 0 };
  await Promise.all(Array.from({ length: 200 }, (_, i) => attempt(th, "k" + (i % 10), ran)));
  assert.equal(ran.n, 10 * N);
});
test("concurrency at the window edge: a rollover under load opens exactly one fresh N", async () => {
  const c = { t: 1_000_000 }, d1 = new FakeD1(), store = new D1ThrottleStore(d1), k = { maxFailures: N, windowMs: WIN, lockoutMs: 10_000 };
  for (let i = 0; i < N; i++) await store.reserve("k", k, c.t);
  c.t += WIN;                                                                         // lock (10s) and window (60s) both over
  const res = await Promise.all(Array.from({ length: 50 }, () => store.reserve("k", k, c.t)));
  assert.equal(res.filter((r) => r.allowed).length, N);
});

// ---- 3 live lockout survives 1000 keys ----
test("a live lockout survives 1000+ other keys on D1; the Memory adapter loses it (f204 known limit, negative control)", async () => {
  for (const kind of ["d1", "memory"] as const) {
    const c = { t: 1_000_000 }, d1 = new FakeD1();
    const th = new Throttle(cfg(c), kind === "d1" ? new D1ThrottleStore(d1) : new MemoryThrottleStore(1000));
    for (let i = 0; i < N; i++) await th.guard("victim", fail).catch(() => {});
    await assert.rejects(th.guard("victim", async () => 1), ThrottledError);
    for (let i = 0; i < 1500; i++) await th.guard("other" + i, fail).catch(() => {});
    c.t += 1000;
    const stillLocked = await th.guard("victim", async () => 1).then(() => false, (e) => e instanceof ThrottledError);
    assert.equal(stillLocked, kind === "d1", kind === "d1" ? "D1 must keep the live lockout" : "control: Memory evicts it");
  }
});

// ---- 4 sweep ----
test("sweep bounds rows: expired rows go, live locks and live windows stay, decisions are unchanged by the sweep", async () => {
  const c = { t: 1_000_000 }, d1 = new FakeD1(), store = new D1ThrottleStore(d1, { sweepEveryMs: 1e12, sweepBatch: 100 }), th = new Throttle(cfg(c), store);
  for (let i = 0; i < 1200; i++) await th.guard("old" + i, fail).catch(() => {});
  assert.equal(await store.count(), 1200);
  c.t += 130_000;                                                                      // past every old row's horizon (max(60s window, 120s lock) = 120s)
  for (let i = 0; i < N; i++) await th.guard("locked", fail).catch(() => {});          // live lock to t+220s
  await th.guard("window", fail).catch(() => {});                                      // live window
  const removed = await store.sweep(c.t);
  assert.equal(removed, 1200, "all 1200 expired rows swept");
  const left = await store.allKeys();
  assert.equal(left.length, 2, "only the live lock and the live window remain");
  assert.ok(left.some((k) => k === "locked") && left.some((k) => k === "window"));
  await assert.rejects(th.guard("locked", async () => 1), ThrottledError);             // lock survived the sweep
});
test("sweep horizon: a row is swept only after max(window, lockout) and then behaves exactly like an absent row", async () => {
  const c = { t: 1_000_000 }, store = new D1ThrottleStore(new FakeD1()), th = new Throttle(cfg(c), store);
  for (let i = 0; i < N; i++) await th.guard("k", fail).catch(() => {});
  c.t += LOCK - 1; assert.equal(await store.sweep(c.t), 0, "lock still live: nothing swept");
  c.t += 1; assert.equal(await store.sweep(c.t), 1, "lock over: swept");
  const ran = { n: 0 }; await Promise.all(Array.from({ length: 10 }, () => attempt(th, "k", ran)));
  assert.equal(ran.n, N, "a swept key is a fresh key: exactly N more attempts");
});
test("opportunistic sweep: reserve() trims expired rows without an explicit call, bounded to one batch", async () => {
  const c = { t: 1_000_000 }, store = new D1ThrottleStore(new FakeD1(), { sweepEveryMs: 1000, sweepBatch: 50 }), th = new Throttle(cfg(c), store);
  for (let i = 0; i < 120; i++) await th.guard("a" + i, fail).catch(() => {});
  c.t += 500_000;
  await th.guard("fresh", fail).catch(() => {});                                       // triggers one sweep batch (50 rows)
  assert.equal(await store.count(), 120 - 50 + 1);
});

// ---- hashed keys / table shape ----
test("only hashed keys reach the table; no raw email or IP", async () => {
  const c = { t: 1_000_000 }, d1 = new FakeD1(), store = new D1ThrottleStore(d1), th = new Throttle(cfg(c), store);
  const k = await throttleKey("login", "Victim@Example.com", "203.0.113.9");
  for (let i = 0; i < N + 1; i++) await th.guard(k, fail).catch(() => {});
  const blob = JSON.stringify(d1.db.prepare("SELECT * FROM throttle_state").all()) + JSON.stringify(d1.log);
  assert.ok(!/victim|example\.com|203\.0\.113/i.test(blob));
  assert.match((await store.allKeys())[0], /^login:[0-9a-f]{32}$/);
});
test("every statement is parameterised: the key and numbers never appear in the SQL text", async () => {
  const c = { t: 1_000_000 }, d1 = new FakeD1(), th = new Throttle(cfg(c), new D1ThrottleStore(d1));
  await th.guard("login:abc'; DROP TABLE throttle_state;--", fail).catch(() => {});
  assert.ok(d1.log.length > 0 && d1.log.every((l) => !/DROP TABLE|abc/.test(l.sql)));
  assert.equal(Number((d1.db.prepare("SELECT COUNT(*) c FROM throttle_state").get() as any).c), 1);
});

// ---- 5 differential: Memory vs D1, seeded random ops ----
test("differential: 400 seeded random ops (hit, success, clock jump) give identical decisions on Memory and D1", async () => {
  let seed = 20260507; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (const conf of [{ maxFailures: 1, windowMs: 5000, lockoutMs: 2000 }, { maxFailures: 3, windowMs: 60_000, lockoutMs: 10_000 }, { maxFailures: 4, windowMs: 3000, lockoutMs: 9000 }]) {
    const cm = { t: 1_000_000 }, cd = { t: 1_000_000 };
    const m = new Throttle({ ...conf, now: () => cm.t }, new MemoryThrottleStore(100000)), d = new Throttle({ ...conf, now: () => cd.t }, new D1ThrottleStore(new FakeD1()));
    for (let i = 0; i < 400; i++) {
      const op = rnd(), key = "k" + Math.floor(rnd() * 3);
      if (op < 0.2) { const dt = Math.floor(rnd() * 70_000); cm.t += dt; cd.t += dt; continue; }
      const succeed = op > 0.85;
      const f = async () => { if (!succeed) throw new Error("x"); return 1; };
      const o = (th: Throttle) => th.guard(key, f).then(() => "ok", (e) => (e instanceof ThrottledError ? "blocked:" + e.retryAfterSec : "fail"));
      assert.equal(await o(d), await o(m), `step ${i} conf ${JSON.stringify(conf)}`);
    }
  }
});

// ---- 6 mutation ----
// A read-then-write adapter over the SAME table: it reads the row, decides in JS, writes it back. Two awaits = a race window.
class ReadThenWriteStore implements AtomicThrottleStore {
  db: FakeD1; constructor(db: FakeD1) { this.db = db; }
  async reserve(key: string, c: { maxFailures: number; windowMs: number; lockoutMs: number }, now: number) {
    const s = await this.db.prepare("SELECT fail_count, window_start, locked_until FROM throttle_state WHERE key = ?1").bind(key).first<any>();
    const fresh = !s || (s.locked_until <= now && now >= s.window_start + c.windowMs);
    const cur = fresh ? { n: 0, ws: now, lu: 0 } : { n: s.fail_count, ws: s.window_start, lu: s.locked_until };
    if (cur.lu > now || cur.n >= c.maxFailures) return { allowed: false as const, retryAfterSec: 1 };
    cur.n += 1; if (cur.n >= c.maxFailures) cur.lu = now + c.lockoutMs;
    await this.db.prepare("INSERT INTO throttle_state (key, fail_count, window_start, locked_until, expires_at) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(key) DO UPDATE SET fail_count=?2, window_start=?3, locked_until=?4, expires_at=?5").bind(key, cur.n, cur.ws, cur.lu, now + 1e9).run();
    return { allowed: true as const };
  }
  async delete(key: string) { await this.db.prepare("DELETE FROM throttle_state WHERE key = ?1").bind(key).run(); }
}
async function admitted(store: AtomicThrottleStore): Promise<number> {
  const c = { t: 1_000_000 };
  const res = await Promise.all(Array.from({ length: 50 }, () => store.reserve("k", { maxFailures: N, windowMs: WIN, lockoutMs: LOCK }, c.t)));
  return res.filter((r) => r.allowed).length;
}
test("mutation: the read-then-write adapter admits MORE than N under 50 interleaved hits; the atomic one admits exactly N", async () => {
  assert.equal(await admitted(new D1ThrottleStore(new FakeD1())), N);
  const bad = await admitted(new ReadThenWriteStore(new FakeD1()));
  assert.ok(bad > N, "read-then-write admitted " + bad + " (must exceed N=" + N + ", proving the concurrency test can fail)");
});
test("mutation: source mutants of the D1 SQL are killed by the shared contract + concurrency checks", () => {
  const src = readFileSync(D1SRC, "utf8");
  const mutants: [string, string][] = [
    ["WHERE locked_until <= ?2 AND (?2 >= window_start + ?4 OR fail_count < ?3)\nRETURNING", "RETURNING"],                      // no admission guard: counts forever
    ["ELSE fail_count + 1 END", "ELSE fail_count + 2 END"],                                                                       // double count
    ["WHEN fail_count + 1 >= ?3 THEN ?2 + ?5 ELSE locked_until END", "WHEN fail_count + 1 > ?3 THEN ?2 + ?5 ELSE locked_until END"], // lock one hit late
    ["OR fail_count < ?3)\nRETURNING", "OR fail_count <= ?3)\nRETURNING"],                                                         // off-by-one admit
  ];
  for (const [from, to] of mutants) {
    assert.ok(src.includes(from), "mutation anchor missing: " + from);
    const f = fileURLToPath(new URL("../src/_mut_d1throttle.ts", import.meta.url));
    writeFileSync(f, src.replace(from, to));
    try {
      const r = runSuite({ THROTTLE_ADAPTER: "d1", THROTTLE_D1_SRC: f });
      assert.notEqual(r.status, 0, "mutant survived: " + from.slice(0, 70) + " -> " + to.slice(0, 70));
    } finally { rmSync(f, { force: true }); }
  }
});
