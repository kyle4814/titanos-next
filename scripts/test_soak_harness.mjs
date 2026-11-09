// test_soak_harness.mjs - C10 soak harness tests. Localhost only, synthetic, ~55 s.
import assert from 'node:assert/strict';
import { runSoak, buildBoard, Hist, assertLocal, latencyDrift, S13_FLOOR_MS } from './soak_harness.mjs';

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
assert.equal(h.pct(50), 50); assert.equal(h.pct(95), 95);
ok('histogram percentiles');

// 3. board maths: synthetic windows, a stalled window and a dead target turn rows RED
const mkRun = (over = {}) => ({
  total: { n: 1000, ok: 1000, errors: 0, e5xx: 0, transport: 0, timeouts: 0 }, samples: 10,
  hist: (() => { const x = new Hist(); for (let i = 0; i < 1000; i++) x.add(5); return x; })(),
  windows: Array.from({ length: 10 }, () => ({ n: 100, errors: 0, p95: 5 })),
  durationS: 20, intervalS: 2, targets: [{ ok2xx: true }], faultsConfigured: false, faultsSeen: 0, ...over });
let b = buildBoard(mkRun());
assert.equal(b.rows.length, 15); assert.ok(b.allGreen);
assert.ok(b.rows.every((r) => r.definition === 'PROPOSED'));
b = buildBoard(mkRun({ targets: [{ ok2xx: false }], windows: [{ n: 0, errors: 0, p95: 0 }, ...mkRun().windows.slice(1)] }));
assert.equal(b.rows.find((r) => r.id === 'S14').status, 'RED');
assert.equal(b.rows.find((r) => r.id === 'S8').status, 'RED');
b = buildBoard(mkRun({ faultsConfigured: true, faultsSeen: 0 }));
assert.equal(b.rows.find((r) => r.id === 'S15').status, 'RED');
ok('board maths (stall, dead target, chaos-never-ran)');

// 4. 20 s run against the local stub with light chaos passes, board GREEN
// S13 on the wall clock is a gross-leak smoke only: threshold 4x the same-run baseline (default 1.5 stays for the
// injected-clock tests below). 11 runs at 2x nproc busy loops read 0.05 to 2.29 (one 2.29 failed the 1.5 rule), so
// 4x clears box-load swing with margin; a real 3x drift is pinned deterministically in tests 6 and 7.
const SMOKE_S13 = 4;
const g = await runSoak({ durationS: 20, concurrency: 8, rps: 400, intervalS: 2, seed: 7, thresholds: { S13: SMOKE_S13 },
  faults: { drop: 0.002, err5xx: 0.002, delayRate: 0.02, delayMs: 50 } });
console.log('green run: n=%d rps=%s faultsSeen=%d', g.totals.n, (g.totals.n / 20).toFixed(0), g.faultsSeen);
assert.ok(g.totals.n > 1000, 'load delivered');
assert.ok(g.faultsSeen > 0, 'chaos observed');
assert.ok(g.windows.length >= 9);
assert.equal(g.rows.length, 15);
assert.ok(g.allGreen, 'expected GREEN: ' + JSON.stringify(g.rows.filter((r) => r.status !== 'GREEN')));
{ const d = latencyDrift(g.windows); // wall-clock smoke: ratio of the same-run baseline, denominator printed (f320)
  console.log('S13 smoke: ratio=%s late=%s ms early=%s ms denominator=%s ms (floor %s ms) threshold<=%s (same-run baseline)',
    d.ratio.toFixed(3), d.late, d.early, d.denominator, S13_FLOOR_MS, SMOKE_S13);
  assert.equal(g.rows.find((x) => x.id === 'S13').status, 'GREEN', 'S13 smoke'); }
ok('20 s stub run with light chaos: board GREEN');

// 5. injected 50 percent 5xx turns the board RED
const r = await runSoak({ durationS: 6, concurrency: 8, rps: 200, intervalS: 1, seed: 3, faults: { err5xx: 0.5 } });
assert.ok(!r.allGreen, 'board must be RED');
for (const id of ['S1', 'S2', 'S12']) assert.equal(r.rows.find((x) => x.id === id).status, 'RED', id);
assert.ok(r.rows.find((x) => x.id === 'S12').value > 0.4);
ok('50% 5xx run: board RED (S1, S2, S12)');

// 6. S13 logic on synthetic windows (deterministic): real sustained drift RED, scheduling jitter GREEN (f320)
const wins = (p95s) => p95s.map((p95) => ({ n: 100, errors: 0, p95 }));
const s13 = (p95s) => buildBoard(mkRun({ windows: wins(p95s) })).rows.find((x) => x.id === 'S13');
const flat = (n, v) => Array.from({ length: n }, () => v);
assert.equal(s13([...flat(9, 20), ...flat(3, 60)]).status, 'RED', 'sustained 3x drift at 20 ms baseline');
assert.equal(s13([...flat(6, 20), ...flat(3, 40), ...flat(3, 60)]).status, 'RED', 'gradual drift to 3x');
assert.equal(s13([...flat(12, 20)].map((v, i) => (i === 10 ? 80 : v))).status, 'GREEN', 'one spike window is jitter');
assert.equal(s13([2, 3, 2, 3, 2, 3, 2, 3, 8, 2, 8, 2]).status, 'GREEN', 'ms-bucket noise on a 2 ms baseline is jitter');
assert.equal(s13([3, 2, 3, 2, 2, 2, 2, 2, 2, 2, 9, 3]).status, 'GREEN', 'noisy tail, quiet median');
// the old mean-of-two-windows rule read this as 2.8x: pin that the new rule does not
assert.equal(latencyDrift(wins([3, 2, 5, 3, 4, 5, 6, 3, 4, 2, 8, 9])).denominator, S13_FLOOR_MS);
ok('S13 logic on synthetic windows: real drift RED, jitter GREEN');

// 7. S13 mutation on an INJECTED latency clock (real sockets, deterministic latency model). Not wall-clock.
// A real 3x drift in the clock must turn S13 RED; pure scheduling jitter must not. The model keys on run progress.
const fakeClock = (durationS, model) => {
  let t00 = null, seq = 0;
  return { start: () => { const now = performance.now(); if (t00 === null) t00 = now; return { p: Math.min(1, (now - t00) / (durationS * 1000)), k: seq++ }; },
    end: (tok) => model(tok.p, tok.k) };
};
const noise = (k) => ((k * 2654435761) >>> 0) % 5; // deterministic 0..4 ms, no trend
const soakWith = (model) => runSoak({ durationS: 12, concurrency: 8, rps: 200, intervalS: 1, seed: 5, latencyClock: fakeClock(12, model) });
const drifted = await soakWith((p, k) => 20 + noise(k) + (p >= 0.75 ? 40 : p >= 0.5 ? 20 : 0));
const dd = latencyDrift(drifted.windows);
console.log('S13 injected 3x drift: ratio=%s late=%s early=%s denominator=%s ms', dd.ratio.toFixed(3), dd.late, dd.early, dd.denominator);
assert.equal(drifted.rows.find((x) => x.id === 'S13').status, 'RED', 'injected 3x drift must be RED');
assert.ok(dd.ratio > 2.2);
const jitter = await soakWith((p, k) => 20 + noise(k) + (p >= 0.4 && p < 0.47 ? 50 : 0) + ((k % 97) === 0 ? 30 : 0));
const jd = latencyDrift(jitter.windows);
console.log('S13 injected jitter only: ratio=%s late=%s early=%s denominator=%s ms', jd.ratio.toFixed(3), jd.late, jd.early, jd.denominator);
assert.equal(jitter.rows.find((x) => x.id === 'S13').status, 'GREEN', 'jitter must not be RED');
ok('S13 mutation on injected clock: 3x drift RED, jitter GREEN');

console.log(`ALL PASS ${pass}`);
