#!/usr/bin/env node
// soak_harness.mjs - C10 soak harness (plan ch.6 C10: "24 h chaos and load on the whole portal;
// S1 to S15 board green"). This builds the HARNESS only; the 24 h run is a separate, later GO.
//
// What it does: drives configurable load at LOCAL http targets, with seeded random fault
// injection (drop, delay, 5xx) via a fault server that is either a stub upstream or a
// fault-injecting reverse proxy in front of a real local target (next export, portal-api dev).
// It samples latency and error rate on an interval and writes an S-board JSON.
//
// LOCALHOST ONLY: every target host must be loopback; anything else is refused. No outbound.
//
// S-BOARD: PROPOSED. The S1-S10 rows in klinge-kernel SYSTEM_L10_PLAN_2026-10-10.md are FLEET
// metrics (budget, runway, merge flow...) and S11-S15 are not defined anywhere under
// FULL_BUSINESS_PROJECT (grep 2026-11-06), so these 15 PORTAL rows are PROPOSED from the
// plan's chunk bars (C1 "<10 s on a phone", C6 80%, C8 isolation...) and every row says so.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
export function assertLocal(url) {
  const u = new URL(url);
  if (u.protocol !== 'http:' || !LOOPBACK.has(u.hostname)) {
    throw new Error(`soak_harness: localhost http only, refused ${url}`);
  }
  return u;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- bounded latency histogram (1 ms buckets to MAXB ms, then overflow) ----
const MAXB = 10000;
export class Hist {
  constructor() { this.b = new Uint32Array(MAXB + 1); this.n = 0; }
  add(ms) { this.b[Math.min(MAXB, Math.max(0, Math.round(ms)))]++; this.n++; }
  merge(o) { for (let i = 0; i <= MAXB; i++) this.b[i] += o.b[i]; this.n += o.n; }
  pct(p) {
    if (!this.n) return 0;
    const want = Math.ceil((p / 100) * this.n);
    let c = 0;
    for (let i = 0; i <= MAXB; i++) { c += this.b[i]; if (c >= want) return i; }
    return MAXB;
  }
}

// ---- fault server: stub upstream (no upstream) or fault-injecting proxy (upstream URL) ----
export function createFaultServer({ upstream = null, faults = {}, seed = 1 } = {}) {
  const f = { drop: 0, delayRate: 0, delayMs: 0, err5xx: 0, ...faults };
  const rnd = mulberry32(seed);
  const stats = { requests: 0, dropped: 0, delayed: 0, injected5xx: 0 };
  const up = upstream ? assertLocal(upstream) : null;
  const server = http.createServer((req, res) => {
    stats.requests++;
    const r = rnd();
    if (r < f.drop) { stats.dropped++; req.socket.destroy(); return; }
    const r2 = rnd();
    const go = () => {
      if (rnd() < f.err5xx) {
        stats.injected5xx++;
        res.writeHead(503, { 'content-type': 'text/plain' });
        res.end('injected 5xx');
        return;
      }
      if (!up) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('stub ok'); return; }
      const pr = http.request({ host: up.hostname, port: up.port, path: req.url, method: req.method,
        headers: { ...req.headers, host: up.host } }, (ures) => {
        res.writeHead(ures.statusCode || 502, ures.headers);
        ures.pipe(res);
      });
      pr.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
      req.pipe(pr);
    };
    if (r2 < f.delayRate && f.delayMs > 0) { stats.delayed++; setTimeout(go, f.delayMs); } else go();
  });
  server.stats = stats;
  return server;
}

export function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

// tiny static server over a built export dir (default target when --serve-out is given)
export function createStaticServer(dir) {
  const root = path.resolve(dir);
  return http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.join(root, p);
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f) && fs.existsSync(f + '.html')) f += '.html';
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200); fs.createReadStream(f).pipe(res);
  });
}

// ---- the S-board (PROPOSED) ----
export const DEFAULT_THRESHOLDS = {
  S1: 0.99,   // success rate >=
  S2: 0.05,   // worst window error rate <=
  S3: 200,    // p50 ms <=
  S4: 800,    // p95 ms <=
  S5: 2000,   // p99 ms <=
  S6: 5,      // throughput rps >=
  S7: 0.9,    // samples taken / expected >=
  S8: 0,      // zero-request windows <=
  S9: 2,      // windows to recover after a bad window <=
  S10: 0.005, // timeout rate <=
  S11: 0.01,  // transport (drop/reset) rate <=
  S12: 0.01,  // 5xx rate <=
  S13: 1.5,   // late-quarter median p95 / max(early-quarter median p95, S13_FLOOR_MS) <=
  S14: 0,     // dead targets (never answered 2xx) <=
  S15: 1,     // chaos observed: injected faults seen / faults configured (1 = at least one seen)
};
// S13 drift (f320). Root cause of the load flake: p95 comes from 1 ms buckets, so a quiet box has early p95 of
// 2-3 ms; a mean over only two quarter windows lets one noisy late window (8 ms) read 2.7x with no leak. Fix: use
// the MEDIAN window p95 per quarter (one spike window cannot move it) and floor the denominator at the 1 ms
// bucket noise band, S13_FLOOR_MS. A sustained drift that is real at a >=floor baseline still reads its true ratio.
export const S13_FLOOR_MS = 10;
export function latencyDrift(windows) {
  const q = Math.max(1, Math.floor(windows.length / 4));
  const med = (a) => { if (!a.length) return 0; const s = a.map((w) => w.p95).sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const early = windows.slice(0, q).filter((w) => w.n);
  const late = windows.slice(-q).filter((w) => w.n);
  if (!early.length || !late.length) return { ratio: 1, early: 0, late: 0, denominator: S13_FLOOR_MS };
  const e = med(early), l = med(late), denominator = Math.max(e, S13_FLOOR_MS);
  return { ratio: l / denominator, early: e, late: l, denominator };
}
const ROWS = [
  ['S1', 'Availability: success rate over the run', '>=', 'C1/C2 bar: 0 human touches, results always return'],
  ['S2', 'Worst single sample window error rate', '<=', 'no window may collapse'],
  ['S3', 'p50 latency ms', '<=', 'C1 bar: result in under 10 s on a phone (local floor far tighter)'],
  ['S4', 'p95 latency ms', '<=', 'C1 bar'],
  ['S5', 'p99 latency ms', '<=', 'C1 bar'],
  ['S6', 'Throughput, requests per second', '>=', 'load actually delivered'],
  ['S7', 'Sampler coverage: samples taken / expected', '>=', 'the board is not blind'],
  ['S8', 'Zero-request (stalled) windows', '<=', 'no stall'],
  ['S9', 'Windows to recover after a bad window', '<=', 'self-heal under chaos'],
  ['S10', 'Timeout rate', '<=', 'hung requests'],
  ['S11', 'Transport error rate (drop, reset)', '<=', 'connection faults tolerated'],
  ['S12', '5xx rate', '<=', 'server faults tolerated'],
  ['S13', 'Latency drift, late median p95 / max(early median p95, 10 ms floor)', '<=', 'no degradation over time (leak signal)'],
  ['S14', 'Targets that never answered 2xx', '<=', 'every surface reachable'],
  ['S15', 'Chaos observed vs configured (1 = injected faults were seen)', '>=', 'the chaos actually ran'],
];

export function buildBoard(run, thresholds = {}) {
  const T = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const { total, samples, hist, windows, durationS, intervalS, targets, faultsConfigured, faultsSeen } = run;
  const rate = (k) => (total.n ? total[k] / total.n : 0);
  const worst = windows.reduce((m, w) => Math.max(m, w.n ? w.errors / w.n : 0), 0);
  const stalled = windows.filter((w) => w.n === 0).length;
  // recovery: longest run of consecutive bad windows (error > 5%)
  let run_ = 0, longest = 0;
  for (const w of windows) { if (w.n && w.errors / w.n > 0.05) { run_++; longest = Math.max(longest, run_); } else run_ = 0; }
  const expected = Math.floor(durationS / intervalS);
  const drift = latencyDrift(windows).ratio;
  const dead = targets.filter((t) => !t.ok2xx).length;
  const chaos = faultsConfigured ? (faultsSeen > 0 ? 1 : 0) : 1;
  const values = {
    S1: total.n ? total.ok / total.n : 0, S2: worst, S3: hist.pct(50), S4: hist.pct(95), S5: hist.pct(99),
    S6: durationS ? total.n / durationS : 0, S7: expected ? samples / expected : 1, S8: stalled, S9: longest,
    S10: rate('timeouts'), S11: rate('transport'), S12: rate('e5xx'), S13: drift, S14: dead, S15: chaos,
  };
  const rows = ROWS.map(([id, name, op, basis]) => {
    const v = values[id];
    const green = total.n > 0 && (op === '>=' ? v >= T[id] : v <= T[id]);
    return { id, name, value: Number(v.toFixed(4)), op, threshold: T[id], status: green ? 'GREEN' : 'RED',
      definition: 'PROPOSED', basis };
  });
  return { rows, allGreen: rows.every((r) => r.status === 'GREEN') };
}

// ---- the runner ----
export async function runSoak(opts = {}) {
  const o = { durationS: 20, concurrency: 8, rps: 400, intervalS: 2, timeoutMs: 3000, seed: 1,
    faults: {}, thresholds: {}, targets: [], latencyClock: null, ...opts };
  const cleanup = [];
  let targets = o.targets.map((u) => assertLocal(u) && u);
  const fcfg = { drop: 0, delayRate: 0, delayMs: 0, err5xx: 0, ...o.faults };
  const faultsConfigured = fcfg.drop > 0 || fcfg.err5xx > 0 || (fcfg.delayRate > 0 && fcfg.delayMs > 0);
  const fservers = [];
  if (!targets.length) {
    const s = createFaultServer({ faults: fcfg, seed: o.seed }); fservers.push(s);
    cleanup.push(s); targets = [await listen(s)];
  } else if (faultsConfigured) {
    const wrapped = [];
    for (const [i, t] of targets.entries()) {
      const s = createFaultServer({ upstream: t, faults: fcfg, seed: o.seed + i }); fservers.push(s);
      cleanup.push(s); wrapped.push(await listen(s));
    }
    targets = wrapped;
  }
  const tstate = targets.map((u) => ({ url: u, ok2xx: false }));
  const mk = () => ({ n: 0, ok: 0, errors: 0, e5xx: 0, transport: 0, timeouts: 0 });
  const total = mk();
  const hist = new Hist();
  let win = mk(), whist = new Hist();
  const windows = [];
  const agent = new http.Agent({ keepAlive: true, maxSockets: o.concurrency * 2 });
  const rnd = mulberry32(o.seed + 99);
  // latencyClock (tests): { start(): token, end(token): ms } replaces the wall-clock latency read. Sockets stay real.
  const clk = o.latencyClock || { start: () => performance.now(), end: (t0) => performance.now() - t0 };
  const once = (t) => new Promise((resolve) => {
    const t0 = clk.start();
    const u = new URL(t.url);
    const req = http.get({ host: u.hostname, port: u.port, path: '/', agent, timeout: o.timeoutMs }, (res) => {
      res.resume();
      res.on('end', () => resolve({ ms: clk.end(t0), status: res.statusCode }));
      res.on('error', () => resolve({ ms: clk.end(t0), kind: 'transport' }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ms: clk.end(t0), kind: 'timeout' }); });
    req.on('error', () => resolve({ ms: clk.end(t0), kind: 'transport' }));
  });
  let stop = false;
  const perWorkerGap = (1000 * o.concurrency) / o.rps;
  const worker = async () => {
    while (!stop) {
      const started = performance.now();
      const t = tstate[Math.floor(rnd() * tstate.length)];
      const r = await once(t);
      for (const c of [total, win]) {
        c.n++;
        if (r.kind === 'timeout') { c.timeouts++; c.errors++; }
        else if (r.kind === 'transport') { c.transport++; c.errors++; }
        else if (r.status >= 500) { c.e5xx++; c.errors++; }
        else if (r.status >= 400) { c.errors++; }
        else c.ok++;
      }
      if (!r.kind && r.status >= 200 && r.status < 300) t.ok2xx = true;
      hist.add(r.ms); whist.add(r.ms);
      const wait = perWorkerGap - (performance.now() - started);
      if (wait > 1) await new Promise((res) => setTimeout(res, wait));
    }
  };
  let samples = 0;
  const sample = () => {
    samples++;
    windows.push({ t: new Date().toISOString(), ...win, p50: whist.pct(50), p95: whist.pct(95), p99: whist.pct(99) });
    win = mk(); whist = new Hist();
  };
  const timer = setInterval(sample, o.intervalS * 1000);
  const workers = Array.from({ length: o.concurrency }, worker);
  await new Promise((res) => setTimeout(res, o.durationS * 1000));
  stop = true; clearInterval(timer);
  await Promise.all(workers);
  if (win.n) sample();
  agent.destroy();
  const faultsSeen = fservers.reduce((s, x) => s + x.stats.dropped + x.stats.delayed + x.stats.injected5xx, 0);
  for (const s of cleanup) await new Promise((r) => { s.closeAllConnections?.(); s.close(r); });
  const run = { total, samples: Math.min(samples, Math.floor(o.durationS / o.intervalS)), hist, windows,
    durationS: o.durationS, intervalS: o.intervalS, targets: tstate, faultsConfigured, faultsSeen };
  const board = buildBoard(run, o.thresholds);
  return {
    generated: new Date().toISOString(), board_definition: 'PROPOSED (see header of scripts/soak_harness.mjs)',
    synthetic: true, localhost_only: true,
    config: { durationS: o.durationS, concurrency: o.concurrency, rps: o.rps, intervalS: o.intervalS,
      seed: o.seed, faults: fcfg, targets: tstate.map((t) => t.url) },
    totals: total, faultsSeen, windows, ...board,
  };
}

// ---- CLI ----
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
  return a;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = parseArgs(process.argv.slice(2));
  const num = (k, d) => (a[k] !== undefined ? Number(a[k]) : d);
  const extra = [];
  let targets = a.targets ? String(a.targets).split(',') : [];
  if (!targets.length && a['serve-out']) {
    const s = createStaticServer(a['serve-out']); extra.push(s); targets = [await listen(s)];
  }
  // SOAK RULE (f412): the pin gate runs before the soak and again after it; a head that moved mid-soak means the result does not count.
  const pinGate = async () => {
    if (!a['pin-gate']) return;
    const { tickGate } = await import('./soak_pin_wire.mjs');
    const r = tickGate({ matrix: a.matrix, pin: a.pin, x3: a.x3 ? String(a.x3).split(',') : [], repo: a.repo, ref: a.ref, marker: a.marker });
    console.log(r.line);
    if (r.code !== 0) { for (const s of extra) s.close(); process.exit(1); }
  };
  await pinGate();
  const result = await runSoak({
    durationS: num('duration', 20), concurrency: num('concurrency', 8), rps: num('rps', 400),
    intervalS: num('interval', 2), seed: num('seed', 1), targets,
    faults: { drop: num('drop', 0), delayRate: num('delay-rate', 0), delayMs: num('delay-ms', 0), err5xx: num('err5xx', 0) },
    thresholds: a.thresholds ? JSON.parse(a.thresholds) : {},
  });
  for (const s of extra) s.close();
  await pinGate();
  const out = a.out || 'soak_board.json';
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  for (const r of result.rows) console.log(`${r.status.padEnd(5)} ${r.id.padEnd(3)} ${String(r.value).padStart(10)} ${r.op} ${r.threshold}  ${r.name}`);
  console.log(`${result.allGreen ? 'BOARD GREEN' : 'BOARD RED'} -> ${out}`);
  process.exit(result.allGreen ? 0 : 1);
}
