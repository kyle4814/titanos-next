// test_soak_harness.mjs - C10 soak harness tests. Localhost only, synthetic, ~35 s.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import http from 'node:http';
import { runSoak, buildBoard, Hist, assertLocal, mulberry32, chaosProfile, s1Value, memSlope, DEFAULT_THRESHOLDS } from './soak_harness.mjs';

let pass = 0;
const ok = (n) => { pass++; console.log('PASS', n); };

// 1. localhost guard
for (const bad of ['http://example.com/', 'https://127.0.0.1/', 'http://10.0.0.5:80/']) {
  assert.throws(() => assertLocal(bad), /localhost http only/);
}
assert.ok(assertLocal('http://127.0.0.1:3000/'));
ok('non-loopback and https targets refused');

// 2. histogram percentiles
const h = new Hist(); for (let i = 1; i <= 100; i++) h.add(i);
const near = (got, want, tol, msg) => assert.ok(Math.abs(got - want) <= tol * want, `${msg}: got ${got} want ${want} +-${tol * 100}%`);
near(h.pct(50), 50, 0.02, 'p50'); near(h.pct(95), 95, 0.02, 'p95');
ok('histogram percentiles (integers 1..100 within 2 percent)');

// 2b. S13 quantisation fix: sub-millisecond known distributions. Analytic percentiles, seeded sample.
//   uniform(0.2, 0.9) ms: p50 = 0.55, p95 = 0.865 (a 1 ms bucket histogram collapses all of this to 0 or 1)
//   lognormal(mu=ln 3 ms, sigma=0.4): p50 = 3.0, p95 = 3 * exp(0.4 * 1.6449) = 5.1897
{
  const rnd = mulberry32(42), N = 200000;
  const hu = new Hist(), hl = new Hist();
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  for (let i = 0; i < N; i++) { hu.add(0.2 + 0.7 * rnd()); hl.add(Math.exp(Math.log(3) + 0.4 * normal())); }
  near(hu.pct(50), 0.55, 0.02, 'uniform p50'); near(hu.pct(95), 0.865, 0.02, 'uniform p95');
  near(hl.pct(50), 3.0, 0.02, 'lognormal p50'); near(hl.pct(95), 3 * Math.exp(0.4 * 1.6449), 0.02, 'lognormal p95');
  // regression: the old 1 ms rounding could not tell 0.4 ms from 0.6 ms
  const a = new Hist(), b = new Hist(); for (let i = 0; i < 100; i++) { a.add(0.4); b.add(0.6); }
  assert.ok(b.pct(50) / a.pct(50) > 1.45 && b.pct(50) / a.pct(50) < 1.55, 'resolves 0.4 vs 0.6 ms');
  // merge keeps the answer
  const m = new Hist(); m.merge(hu); m.merge(hl); assert.equal(m.n, 2 * N);
}
ok('sub-millisecond histogram: p50/p95 of known distributions within 2 percent');

// 3. board maths: synthetic windows, a stalled window and a dead target turn rows RED
const mkRun = (over = {}) => ({
  total: { n: 1000, ok: 1000, errors: 0, e5xx: 0, transport: 0, timeouts: 0 }, samples: 10,
  hist: (() => { const x = new Hist(); for (let i = 0; i < 1000; i++) x.add(5); return x; })(),
  windows: Array.from({ length: 10 }, () => ({ n: 100, errors: 0, p95: 5 })),
  durationS: 20, intervalS: 2, targets: [{ ok2xx: true }], faultsConfigured: false, faultsSeen: 0,
  memSeries: Array.from({ length: 10 }, (_, i) => ({ t: i * 2, heapUsed: 12e6, rss: 80e6 })), ...over });
let b = buildBoard(mkRun());
assert.equal(b.rows.length, 16); assert.ok(b.allGreen);
assert.ok(b.rows.every((r) => r.definition === 'PROPOSED'));
b = buildBoard(mkRun({ targets: [{ ok2xx: false }], windows: [{ n: 0, errors: 0, p95: 0 }, ...mkRun().windows.slice(1)] }));
assert.equal(b.rows.find((r) => r.id === 'S14').status, 'RED');
assert.equal(b.rows.find((r) => r.id === 'S8').status, 'RED');
b = buildBoard(mkRun({ faultsConfigured: true, faultsSeen: 0 }));
assert.equal(b.rows.find((r) => r.id === 'S15').status, 'RED');
ok('board maths (stall, dead target, chaos-never-ran)');

// 4. 20 s run against the local stub with light chaos passes, board GREEN
const g = await runSoak({ durationS: 20, concurrency: 8, rps: 400, intervalS: 2, seed: 7,
  faults: { drop: 0.002, err5xx: 0.002, delayRate: 0.02, delayMs: 50 } });
console.log('green run: n=%d rps=%s faultsSeen=%d', g.totals.n, (g.totals.n / 20).toFixed(0), g.faultsSeen);
assert.ok(g.totals.n > 1000, 'load delivered');
assert.ok(g.faultsSeen > 0, 'chaos observed');
assert.ok(g.windows.length >= 9);
assert.equal(g.rows.length, 16);
assert.ok(g.allGreen, 'expected GREEN: ' + JSON.stringify(g.rows.filter((r) => r.status !== 'GREEN')));
ok('20 s stub run with light chaos: board GREEN');

// 5. injected 50 percent 5xx turns the board RED
const r = await runSoak({ durationS: 6, concurrency: 8, rps: 200, intervalS: 1, seed: 3, faults: { err5xx: 0.5 } });
assert.ok(!r.allGreen, 'board must be RED');
for (const id of ['S1', 'S2', 'S12']) assert.equal(r.rows.find((x) => x.id === id).status, 'RED', id);
assert.ok(r.rows.find((x) => x.id === 'S12').value > 0.4);
ok('50% 5xx run: board RED (S1, S2, S12)');

// ---- S9 (recovery) was never exercised in f81; these tests exercise it ----
// board maths on synthetic windows: k consecutive bad windows (error > 5 percent) -> S9 = k, threshold 2
const winsWith = (pattern) => pattern.map((bad) => ({ n: 100, errors: bad ? 40 : 0, p95: 5 }));
const s9 = (m, pattern) => buildBoard(m(winsWith(pattern))).rows.find((x) => x.id === 'S9');
const withWindows = (w) => mkRun({ windows: w });
const S9_CASES = [
  ['clean', [0,0,0,0,0,0,0,0,0,0], 'GREEN', 0],
  ['one bad window recovers inside the limit', [0,0,1,0,0,0,0,0,0,0], 'GREEN', 1],
  ['two bad windows is the limit', [0,0,1,1,0,0,0,0,0,0], 'GREEN', 2],
  ['three bad windows in a row is RED', [0,0,1,1,1,0,0,0,0,0], 'RED', 3],
  ['two separate bad windows do not add up', [0,1,0,1,0,0,0,0,0,0], 'GREEN', 1],
  ['never recovers', [0,0,1,1,1,1,1,1,1,1], 'RED', 8],
];
export function s9Behaviour(build) {
  // returns true when the board judges every S9 case as expected
  return S9_CASES.every(([, pat, status, val]) => {
    const r = build(withWindows(winsWith(pat))).rows.find((x) => x.id === 'S9');
    return r.status === status && r.value === val;
  });
}
for (const [name, pat, status, val] of S9_CASES) {
  const r = s9(withWindows, pat); assert.equal(r.status, status, name); assert.equal(r.value, val, name);
}
ok('S9 board maths: GREEN on clean/1/2 bad windows, RED at 3 in a row');

// exactly 5 percent is not bad (strictly above)
{ const w = Array.from({ length: 10 }, (_, i) => ({ n: 100, errors: i === 3 ? 5 : 0, p95: 5 }));
  assert.equal(buildBoard(withWindows(w)).rows.find((x) => x.id === 'S9').value, 0); 
  w[3].errors = 6; assert.equal(buildBoard(withWindows(w)).rows.find((x) => x.id === 'S9').value, 1); }
ok('S9 bad-window cut is strictly above 5 percent');

// seeded profile is deterministic and distinct per seed range
assert.deepEqual(chaosProfile('bad_window', { seed: 5 }), chaosProfile('bad_window', { seed: 5 }));
assert.deepEqual(chaosProfile('clean'), {});
assert.throws(() => chaosProfile('nope'), /unknown chaos profile/);
ok('chaos profiles deterministic by seed');

// live runs: bad_window forces S9 RED (and S2 RED); clean stays GREEN on S9 and on the whole board
const bad = await runSoak({ durationS: 14, concurrency: 8, rps: 200, intervalS: 1, seed: 11, profile: 'bad_window' });
const rowOf = (res, id) => res.rows.find((x) => x.id === id);
console.log('bad_window: S9=%s S2=%s S1=%s injected=%d', rowOf(bad, 'S9').value, rowOf(bad, 'S2').value, rowOf(bad, 'S1').value, bad.injected_vs_organic.injected_errors);
assert.equal(rowOf(bad, 'S9').status, 'RED', 'S9 must go RED on the bad-window profile');
assert.ok(rowOf(bad, 'S9').value >= 3);
assert.equal(rowOf(bad, 'S2').status, 'RED');
assert.ok(bad.windows.filter((w) => w.n && w.errors / w.n > 0.05).length >= 3, 'forced windows really are bad');
assert.ok(bad.windows.some((w) => w.n && w.errors === 0), 'and there are clean windows around it');
ok('bad_window profile: S9 RED (>= 3 consecutive bad windows), S2 RED');

const clean = await runSoak({ durationS: 10, concurrency: 8, rps: 200, intervalS: 1, seed: 11, profile: 'clean' });
assert.equal(rowOf(clean, 'S9').status, 'GREEN'); assert.equal(rowOf(clean, 'S9').value, 0);
assert.ok(clean.allGreen, 'clean profile board GREEN: ' + JSON.stringify(clean.rows.filter((r) => r.status !== 'GREEN')));
assert.equal(clean.injected_vs_organic.injected_errors, 0);
ok('clean profile: S9 GREEN (0), whole board GREEN');

// MUTATION: break the harness source, the S9 behaviour check must then FAIL (the test has teeth)
{
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, 'soak_harness.mjs'), 'utf8');
  const mutate = async (tag, from, to) => {
    assert.ok(src.includes(from), 'mutation anchor present: ' + from);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soakmut-'));
    const f = path.join(dir, `m_${tag}.mjs`);
    fs.writeFileSync(f, src.replace(from, to));
    try { return await import(pathToFileURL(f).href); } finally { fs.rmSync(f, { force: true }); fs.rmdirSync(dir); }
  };
  const real = await import('./soak_harness.mjs');
  assert.ok(s9Behaviour((r) => real.buildBoard(r)), 'control: unmutated harness passes the S9 cases');
  const m1 = await mutate('thr', 'S9: 2, ', 'S9: 99,');
  assert.ok(!s9Behaviour((r) => m1.buildBoard(r)), 'mutant S9 threshold 99 must be caught');
  const m2 = await mutate('cut', 'w.errors / w.n > 0.05) { run_++', 'w.errors / w.n > 0.95) { run_++');
  assert.ok(!s9Behaviour((r) => m2.buildBoard(r)), 'mutant bad-window cut 0.95 must be caught');
  const m3 = await mutate('op', "['S9', 'Windows to recover after a bad window', '<='", "['S9', 'Windows to recover after a bad window', '>='");
  assert.ok(!s9Behaviour((r) => m3.buildBoard(r)), 'mutant S9 operator must be caught');
}
ok('S9 mutations (threshold, bad-window cut, operator) are all caught');

// ---- (c) S1 treatment of injected faults is explicit ----
{
  const tot = { n: 1000, ok: 980, errors: 20, injected: 15 };
  assert.equal(s1Value(tot, 'raw'), 0.98);
  assert.ok(Math.abs(s1Value(tot, 'organic') - 980 / 985) < 1e-12);
  assert.equal(s1Value({ n: 0 }, 'organic'), 0);
}
const inj = await runSoak({ durationS: 8, concurrency: 8, rps: 200, intervalS: 1, seed: 21, faults: { err5xx: 0.05, drop: 0.02 } });
const io = inj.injected_vs_organic;
assert.ok(io.injected_errors > 0, 'injected faults counted');
assert.equal(io.injected_errors + io.organic_errors, inj.totals.errors, 'injected + organic = all errors');
assert.equal(io.organic_errors, 0, 'stub target has no organic errors');
assert.equal(inj.s1.mode, 'raw'); assert.match(inj.s1.treatment, /RAW/);
assert.ok(inj.s1.s1_organic > inj.s1.s1_raw && inj.s1.s1_organic === 1);
assert.equal(rowOf(inj, 'S1').value, Number(inj.s1.s1_raw.toFixed(4)), 'default S1 row is the raw value');
const org = await runSoak({ durationS: 6, concurrency: 8, rps: 200, intervalS: 1, seed: 21, faults: { err5xx: 0.05 }, s1Mode: 'organic' });
assert.equal(rowOf(org, 'S1').value, 1, 'organic mode removes injected faults from S1');
assert.equal(org.s1.mode, 'organic');
ok('S1 treatment explicit: raw default, organic option, injected vs organic counts in the JSON');

// ---- S16 memory growth: slope of retained heap after a warm-up, threshold stated in the row ----
const MB = 1024 * 1024;
// synthetic series, t = 0..19 s: `warm` ramps hard for the first 5 points (warm-up), then grows `perS` bytes/s
const memRun = (perS, { warm = false, n = 20, over = {} } = {}) => mkRun({
  memSeries: Array.from({ length: n }, (_, t) => ({ t, rss: 80 * MB,
    heapUsed: 12 * MB + (warm && t < 5 ? t * 10 * MB : (warm ? 40 * MB : 0)) + perS * t })), ...over });
const s16 = (r, bb = buildBoard) => bb(r).rows.find((x) => x.id === 'S16');
const THR = DEFAULT_THRESHOLDS.S16;
function s16Behaviour(bb) {
  return s16(memRun(0), bb).status === 'GREEN'                       // flat heap
    && s16(memRun(THR * 0.9), bb).status === 'GREEN'                 // just under the stated threshold
    && s16(memRun(THR * 1.1), bb).status === 'RED'                   // just over it
    && s16(memRun(THR * 10), bb).status === 'RED'                    // obvious leak
    && s16(memRun(0, { warm: true }), bb).status === 'GREEN'         // warm-up ramp ignored
    && s16(mkRun({ memSeries: undefined }), bb).status === 'RED'     // no series at all: blind, fail closed
    && s16(memRun(0, { n: 4 }), bb).status === 'RED';                // too few post-warm-up points: blind
}
assert.ok(s16Behaviour((r) => buildBoard(r)), 'S16 boundary cases');
const sl = memSlope(memRun(5000).memSeries);
near(sl.slope, 5000, 0.001, 'memSlope recovers a known slope'); assert.ok(sl.warmupS > 0 && sl.points < 20);
assert.equal(memSlope([{ t: 0, heapUsed: 1 }]).slope, null);
ok('S16 board maths: flat/under GREEN, over/leak RED, warm-up ignored, blind runs RED');

// live loopback runs (seconds): a leaking handler must FAIL S16, a clean handler must PASS it
const serveHandler = async (handler) => {
  const srv = http.createServer(handler);
  await new Promise((res) => srv.listen(0, '127.0.0.1', res));
  return { srv, url: `http://127.0.0.1:${srv.address().port}`, close: () => { srv.closeAllConnections(); srv.close(); } };
};
const memOpts = { durationS: 6, intervalS: 0.5, concurrency: 8, rps: 400, seed: 3 };
{
  const keep = [];   // LEAK: retains 4 KiB per request forever
  const lk = await serveHandler((q, r) => { keep.push(Buffer.alloc(4096, 1), { q: q.url, pad: new Array(64).fill(keep.length) }); r.end('ok'); });
  const leak = await runSoak({ ...memOpts, targets: [lk.url] }); lk.close();
  const row = rowOf(leak, 'S16');
  assert.equal(row.status, 'RED', 'leaking handler must FAIL S16: ' + JSON.stringify(row));
  assert.ok(row.value > 4 * THR, 'leak slope is far over the threshold: ' + row.value);
  assert.equal(leak.allGreen, false);
  assert.equal(leak.memory.field, 'heapUsed'); assert.ok(leak.mem_series.length >= 8);
  const cl = await serveHandler((q, r) => { r.end('ok'); });
  const cleanM = await runSoak({ ...memOpts, targets: [cl.url] }); cl.close();
  const crow = rowOf(cleanM, 'S16');
  assert.equal(crow.status, 'GREEN', 'clean handler must PASS S16: ' + JSON.stringify(crow));
  assert.ok(crow.value < THR / 2, 'clean slope has headroom under the threshold: ' + crow.value);
  assert.ok(cleanM.allGreen, 'clean memory run, whole board GREEN: ' + JSON.stringify(cleanM.rows.filter((r) => r.status !== 'GREEN')));
}
ok('S16 live loopback: leaking handler FAILS, clean handler PASSES (6 s runs)');

// MUTATION: break the S16 threshold comparison in the source; the boundary check must then FAIL
{
  const here2 = path.dirname(fileURLToPath(import.meta.url));
  const src2 = fs.readFileSync(path.join(here2, 'soak_harness.mjs'), 'utf8');
  const mutate2 = async (tag, from, to) => {
    assert.ok(src2.includes(from), 'mutation anchor present: ' + from);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soakmem-'));
    const f = path.join(dir, `m_${tag}.mjs`);
    fs.writeFileSync(f, src2.replace(from, to));
    try { return await import(pathToFileURL(f).href); } finally { fs.rmSync(f, { force: true }); fs.rmdirSync(dir); }
  };
  const real2 = await import('./soak_harness.mjs');
  assert.ok(s16Behaviour((r) => real2.buildBoard(r)), 'control: unmutated harness passes the S16 cases');
  const mk = async (tag, from, to) => { const m = await mutate2(tag, from, to); return !s16Behaviour((r) => m.buildBoard(r)); };
  assert.ok(await mk('op', "['S16', 'Memory growth: slope of retained heap (forced GC, plus external buffers) or RSS (memPid), bytes/s, after a 25% warm-up', '<='", "['S16', 'Memory growth: slope of retained heap (forced GC, plus external buffers) or RSS (memPid), bytes/s, after a 25% warm-up', '>='"), 'mutant: comparison operator flipped must be caught');
  assert.ok(await mk('thr', 'S16: 131072,', 'S16: 999999999,'), 'mutant: threshold loosened must be caught');
  assert.ok(await mk('thr0', 'S16: 131072,', 'S16: 1,'), 'mutant: threshold tightened must be caught');
  assert.ok(await mk('blind', 'S16: mem.slope === null ? Infinity : mem.slope', 'S16: mem.slope === null ? 0 : mem.slope'), 'mutant: blind run passes must be caught');
  assert.ok(await mk('warm', 'export const MEM_WARMUP_FRAC = 0.25;', 'export const MEM_WARMUP_FRAC = 0;'), 'mutant: warm-up not ignored must be caught');
}
ok('S16 mutations (operator, threshold up and down, blind passes, warm-up) are all caught');

console.log(`ALL PASS ${pass}`);
