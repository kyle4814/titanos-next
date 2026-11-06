// test_soak_harness.mjs - C10 soak harness tests. Localhost only, synthetic, ~35 s.
import assert from 'node:assert/strict';
import { runSoak, buildBoard, Hist, assertLocal } from './soak_harness.mjs';

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
const g = await runSoak({ durationS: 20, concurrency: 8, rps: 400, intervalS: 2, seed: 7,
  faults: { drop: 0.002, err5xx: 0.002, delayRate: 0.02, delayMs: 50 } });
console.log('green run: n=%d rps=%s faultsSeen=%d', g.totals.n, (g.totals.n / 20).toFixed(0), g.faultsSeen);
assert.ok(g.totals.n > 1000, 'load delivered');
assert.ok(g.faultsSeen > 0, 'chaos observed');
assert.ok(g.windows.length >= 9);
assert.equal(g.rows.length, 15);
assert.ok(g.allGreen, 'expected GREEN: ' + JSON.stringify(g.rows.filter((r) => r.status !== 'GREEN')));
ok('20 s stub run with light chaos: board GREEN');

// 5. injected 50 percent 5xx turns the board RED
const r = await runSoak({ durationS: 6, concurrency: 8, rps: 200, intervalS: 1, seed: 3, faults: { err5xx: 0.5 } });
assert.ok(!r.allGreen, 'board must be RED');
for (const id of ['S1', 'S2', 'S12']) assert.equal(r.rows.find((x) => x.id === id).status, 'RED', id);
assert.ok(r.rows.find((x) => x.id === 'S12').value > 0.4);
ok('50% 5xx run: board RED (S1, S2, S12)');

console.log(`ALL PASS ${pass}`);
