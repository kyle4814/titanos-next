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
import v8 from 'node:v8';
import vm from 'node:vm';

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

// ---- bounded latency histogram: log-spaced buckets, sub-millisecond resolution ----
// Bucket k covers [MINMS*G^k, MINMS*G^(k+1)); G = 1.01 so the reported value (geometric midpoint)
// is within 0.5 percent of any sample in the bucket. Range 0.001 ms (1 us) to 10 s; below the floor
// goes in bucket 0, above the ceiling in the last. Inputs are performance.now() deltas (hrtime based).
// (f81 used 1 ms buckets, which made S13 quantisation noise at single-digit ms.)
export const HIST_MIN_MS = 0.001, HIST_MAX_MS = 10000, HIST_G = 1.01;
const LOGG = Math.log(HIST_G);
const NB = Math.ceil(Math.log(HIST_MAX_MS / HIST_MIN_MS) / LOGG) + 1;
export class Hist {
  constructor() { this.b = new Uint32Array(NB); this.n = 0; }
  add(ms) {
    const k = ms <= HIST_MIN_MS ? 0 : Math.min(NB - 1, Math.floor(Math.log(ms / HIST_MIN_MS) / LOGG));
    this.b[k]++; this.n++;
  }
  merge(o) { for (let i = 0; i < NB; i++) this.b[i] += o.b[i]; this.n += o.n; }
  pct(p) {
    if (!this.n) return 0;
    const want = Math.ceil((p / 100) * this.n);
    let c = 0;
    for (let i = 0; i < NB; i++) {
      c += this.b[i];
      if (c >= want) return HIST_MIN_MS * Math.pow(HIST_G, i + 0.5);
    }
    return HIST_MAX_MS;
  }
}

// ---- memory growth (S16, PROPOSED) ----
// The sampler records process.memoryUsage() once per window. The heap series is taken after a forced GC
// (exposed at runtime via v8 flags, no CLI flag needed) so it is the RETAINED heap, not allocator noise.
// memSlope fits a least-squares line to the samples after a warm-up and returns bytes per second.
// Self mode measures THIS process, so it only sees targets served in-process (the stub, a test handler,
// serve-out). A target in another process needs memPid: its VmRSS is read from /proc/<pid>/status (Linux).
export const MEM_WARMUP_FRAC = 0.25;   // first quarter of the run is warm-up (JIT, caches, pools) and is ignored
export const MEM_MIN_POINTS = 4;       // fewer post-warm-up samples than this is BLIND, so the row is RED
let gcFn = null;
export function forceGc() {
  if (!gcFn) {
    if (typeof globalThis.gc === 'function') gcFn = globalThis.gc;
    else { v8.setFlagsFromString('--expose_gc'); gcFn = vm.runInNewContext('gc'); }
  }
  gcFn();
}
export function readMem(memPid = null) {
  if (memPid) {
    const m = /VmRSS:\s+(\d+) kB/.exec(fs.readFileSync(`/proc/${memPid}/status`, 'utf8'));
    return { rss: m ? Number(m[1]) * 1024 : 0, heapUsed: 0, source: `pid:${memPid}` };
  }
  forceGc();
  const u = process.memoryUsage();
  return { rss: u.rss, heapUsed: u.heapUsed + u.external, source: 'self' };
}
// series: [{ t: seconds since start, heapUsed, rss }]. field: 'heapUsed' (self) or 'rss' (memPid).
// Returns { slope (bytes/s), points, warmupS } or { slope: null, points } when there are too few points.
export function memSlope(series, field = 'heapUsed', warmupFrac = MEM_WARMUP_FRAC, minPoints = MEM_MIN_POINTS) {
  if (!series || series.length < 2) return { slope: null, points: series ? series.length : 0, warmupS: 0 };
  const t0 = series[0].t, tN = series[series.length - 1].t;
  const warmupS = t0 + (tN - t0) * warmupFrac;
  const pts = series.filter((p) => p.t >= warmupS);
  if (pts.length < minPoints) return { slope: null, points: pts.length, warmupS };
  const n = pts.length;
  const mx = pts.reduce((a, p) => a + p.t, 0) / n, my = pts.reduce((a, p) => a + p[field], 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.t - mx) ** 2; sxy += (p.t - mx) * (p[field] - my); }
  return { slope: sxx > 0 ? sxy / sxx : null, points: n, warmupS };
}

// ---- fault server: stub upstream (no upstream) or fault-injecting proxy (upstream URL) ----
export function createFaultServer({ upstream = null, faults = {}, seed = 1 } = {}) {
  const f = { drop: 0, delayRate: 0, delayMs: 0, err5xx: 0, burst: null, ...faults };
  const t0 = Date.now();
  const rnd = mulberry32(seed);
  const stats = { requests: 0, dropped: 0, delayed: 0, injected5xx: 0, burst5xx: 0 };
  const up = upstream ? assertLocal(upstream) : null;
  const server = http.createServer((req, res) => {
    stats.requests++;
    const r = rnd();
    if (r < f.drop) { stats.dropped++; req.socket.destroy(); return; }
    const r2 = rnd();
    const go = () => {
      const el = (Date.now() - t0) / 1000;
      const inBurst = f.burst && el >= f.burst.startS && el < f.burst.startS + f.burst.lenS;
      const pErr = inBurst ? Math.max(f.err5xx, f.burst.err5xx) : f.err5xx;
      if (rnd() < pErr) {
        stats.injected5xx++;
        if (inBurst) stats.burst5xx++;
        res.writeHead(503, { 'content-type': 'text/plain', 'x-soak-injected': '5xx' });
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

// ---- seeded chaos profiles ----
// clean: no faults. light: the f81 profile. bad_window: ONE seeded burst of 100 percent
// injected 5xx lasting `windows` sample windows, started at a seeded offset after a clean lead-in, so the
// S2 and S9 rows are actually exercised. Same seed, same profile.
export function chaosProfile(name, { seed = 1, intervalS = 1, windows = 4 } = {}) {
  if (name === 'clean') return {};
  if (name === 'light') return { drop: 0.002, err5xx: 0.003, delayRate: 0.02, delayMs: 150 };
  if (name === 'bad_window') {
    const r = mulberry32(seed + 7)();
    const startS = intervalS * (2 + Math.floor(r * 3)); // 2..4 windows of clean lead-in
    return { burst: { startS, lenS: intervalS * windows, err5xx: 1 } };
  }
  throw new Error(`soak_harness: unknown chaos profile ${name}`);
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
  S1: 0.99,   // success rate >= (raw: injected faults count against it; see s1_mode)
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
  S13: 1.5,   // late-quarter p95 / early-quarter p95 <=
  S14: 0,     // dead targets (never answered 2xx) <=
  S15: 1,     // chaos observed: injected faults seen / faults configured (1 = at least one seen)
  S16: 131072, // retained-memory growth slope, bytes per second after warm-up <= (128 KiB/s, a SHORT-RUN guard; a 24 h run needs a far tighter value, see docs/soak)
};
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
  ['S13', 'Latency drift, late p95 / early p95', '<=', 'no degradation over time (leak signal)'],
  ['S14', 'Targets that never answered 2xx', '<=', 'every surface reachable'],
  ['S15', 'Chaos observed vs configured (1 = injected faults were seen)', '>=', 'the chaos actually ran'],
  ['S16', 'Memory growth: slope of retained heap (forced GC, plus external buffers) or RSS (memPid), bytes/s, after a 25% warm-up', '<=', 'leak signal: a handler that retains per request shows a steady positive slope; fewer than 4 post-warm-up samples is BLIND and RED (fail closed)'],
];

// S1 treatment, explicit: 'raw' = every non-2xx/3xx counts against availability, injected or not (f81
// behaviour, the default, so boards stay comparable). 'organic' = injected faults are removed from both
// numerator and denominator, so S1 measures the target alone. Both are always reported in the JSON.
export function s1Value(total, mode = 'raw') {
  if (!total.n) return 0;
  if (mode === 'organic') {
    const d = total.n - (total.injected || 0);
    return d > 0 ? total.ok / d : 0;
  }
  return total.ok / total.n;
}
export function s1Report(total, mode) {
  const injected = total.injected || 0;
  return {
    mode, treatment: mode === 'organic'
      ? 'injected faults removed from numerator and denominator (S1 = ok / (n - injected))'
      : 'RAW: injected faults count against S1 (S1 = ok / n); organic value reported alongside',
    requests: total.n, ok: total.ok, errors: total.errors,
    injected_errors: injected, organic_errors: total.errors - injected,
    injected_breakdown: { five_xx_by_header: total.injected5xx || 0, transport_attributed_to_drops: total.injectedDrops || 0 },
    s1_raw: total.n ? total.ok / total.n : 0,
    s1_organic: total.n - injected > 0 ? total.ok / (total.n - injected) : 0,
  };
}

export function buildBoard(run, thresholds = {}, s1Mode = 'raw') {
  const T = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const { total, samples, hist, windows, durationS, intervalS, targets, faultsConfigured, faultsSeen, memSeries, memField } = run;
  const rate = (k) => (total.n ? total[k] / total.n : 0);
  const worst = windows.reduce((m, w) => Math.max(m, w.n ? w.errors / w.n : 0), 0);
  const stalled = windows.filter((w) => w.n === 0).length;
  // recovery: longest run of consecutive bad windows (error > 5%)
  let run_ = 0, longest = 0;
  for (const w of windows) { if (w.n && w.errors / w.n > 0.05) { run_++; longest = Math.max(longest, run_); } else run_ = 0; }
  const expected = Math.floor(durationS / intervalS);
  const q = Math.max(1, Math.floor(windows.length / 4));
  const early = windows.slice(0, q).filter((w) => w.n);
  const late = windows.slice(-q).filter((w) => w.n);
  const avg = (a) => (a.length ? a.reduce((s, w) => s + w.p95, 0) / a.length : 0);
  const drift = early.length && late.length && avg(early) > 0 ? avg(late) / avg(early) : 1;
  const dead = targets.filter((t) => !t.ok2xx).length;
  const chaos = faultsConfigured ? (faultsSeen > 0 ? 1 : 0) : 1;
  const mem = memSlope(memSeries, memField || 'heapUsed');
  const values = {
    S1: s1Value(total, s1Mode), S2: worst, S3: hist.pct(50), S4: hist.pct(95), S5: hist.pct(99),
    S6: durationS ? total.n / durationS : 0, S7: expected ? samples / expected : 1, S8: stalled, S9: longest,
    S10: rate('timeouts'), S11: rate('transport'), S12: rate('e5xx'), S13: drift, S14: dead, S15: chaos,
    S16: mem.slope === null ? Infinity : mem.slope,
  };
  const rows = ROWS.map(([id, name, op, basis]) => {
    const v = values[id];
    const green = total.n > 0 && (op === '>=' ? v >= T[id] : v <= T[id]);
    return { id, name, value: Number.isFinite(v) ? Number(v.toFixed(4)) : null, op, threshold: T[id], status: green ? 'GREEN' : 'RED',
      definition: 'PROPOSED', basis };
  });
  return { rows, allGreen: rows.every((r) => r.status === 'GREEN'), memory: { ...mem, field: memField || 'heapUsed', thresholdBytesPerS: T.S16 } };
}

// ---- the runner ----
export async function runSoak(opts = {}) {
  const o = { s1Mode: 'raw', profile: null, durationS: 20, concurrency: 8, rps: 400, intervalS: 2, timeoutMs: 3000, seed: 1,
    faults: {}, thresholds: {}, targets: [], memPid: null, ...opts };
  const cleanup = [];
  let targets = o.targets.map((u) => assertLocal(u) && u);
  const fcfg = { drop: 0, delayRate: 0, delayMs: 0, err5xx: 0, ...(o.profile ? chaosProfile(o.profile, { seed: o.seed, intervalS: o.intervalS }) : {}), ...o.faults };
  const faultsConfigured = fcfg.drop > 0 || fcfg.err5xx > 0 || !!fcfg.burst || (fcfg.delayRate > 0 && fcfg.delayMs > 0);
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
  const mk = () => ({ n: 0, ok: 0, errors: 0, e5xx: 0, transport: 0, timeouts: 0, injected: 0, injected5xx: 0, injectedDrops: 0 });
  const total = mk();
  const hist = new Hist();
  let win = mk(), whist = new Hist();
  const windows = [];
  const agent = new http.Agent({ keepAlive: true, maxSockets: o.concurrency * 2 });
  const rnd = mulberry32(o.seed + 99);
  const once = (t) => new Promise((resolve) => {
    const t0 = performance.now();
    const u = new URL(t.url);
    const req = http.get({ host: u.hostname, port: u.port, path: '/', agent, timeout: o.timeoutMs }, (res) => {
      res.resume();
      const injected = res.headers['x-soak-injected'] === '5xx';
      res.on('end', () => resolve({ ms: performance.now() - t0, status: res.statusCode, injected }));
      res.on('error', () => resolve({ ms: performance.now() - t0, kind: 'transport' }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ms: performance.now() - t0, kind: 'timeout' }); });
    req.on('error', () => resolve({ ms: performance.now() - t0, kind: 'transport' }));
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
        else if (r.status >= 500) { c.e5xx++; c.errors++; if (r.injected) { c.injected++; c.injected5xx++; } }
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
  const memSeries = [];
  const tStart = performance.now();
  const sample = () => {
    samples++;
    const m = readMem(o.memPid);
    memSeries.push({ t: Number(((performance.now() - tStart) / 1000).toFixed(3)), heapUsed: m.heapUsed, rss: m.rss });
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
  const drops = fservers.reduce((s, x) => s + x.stats.dropped, 0);
  // a proxy never resets a socket except for an injected drop, so observed transport errors are attributed
  // to drops up to the server-side drop count (the rest, if any, stay organic)
  total.injectedDrops = Math.min(total.transport, drops);
  total.injected += total.injectedDrops;
  for (const s of cleanup) await new Promise((r) => { s.closeAllConnections?.(); s.close(r); });
  const run = { total, samples: Math.min(samples, Math.floor(o.durationS / o.intervalS)), hist, windows,
    durationS: o.durationS, intervalS: o.intervalS, targets: tstate, faultsConfigured, faultsSeen,
    memSeries, memField: o.memPid ? 'rss' : 'heapUsed' };
  const board = buildBoard(run, o.thresholds, o.s1Mode);
  return {
    generated: new Date().toISOString(), board_definition: 'PROPOSED (see header of scripts/soak_harness.mjs)',
    synthetic: true, localhost_only: true,
    config: { durationS: o.durationS, concurrency: o.concurrency, rps: o.rps, intervalS: o.intervalS,
      seed: o.seed, profile: o.profile, s1Mode: o.s1Mode, faults: fcfg, targets: tstate.map((t) => t.url) },
    totals: total, faultsSeen, s1: s1Report(total, o.s1Mode),
    injected_vs_organic: { injected_errors: total.injected, organic_errors: total.errors - total.injected, injected_delays: fservers.reduce((s, x) => s + x.stats.delayed, 0) },
    mem_series: memSeries, windows, ...board,
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
  const result = await runSoak({
    durationS: num('duration', 20), concurrency: num('concurrency', 8), rps: num('rps', 400),
    intervalS: num('interval', 2), seed: num('seed', 1), targets,
    faults: { drop: num('drop', 0), delayRate: num('delay-rate', 0), delayMs: num('delay-ms', 0), err5xx: num('err5xx', 0) },
    thresholds: a.thresholds ? JSON.parse(a.thresholds) : {},
    profile: a.profile || null, s1Mode: a['s1-mode'] || 'raw', memPid: a['mem-pid'] ? Number(a['mem-pid']) : null,
  });
  for (const s of extra) s.close();
  const out = a.out || 'soak_board.json';
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  for (const r of result.rows) console.log(`${r.status.padEnd(5)} ${r.id.padEnd(3)} ${String(r.value).padStart(10)} ${r.op} ${r.threshold}  ${r.name}`);
  console.log(`${result.allGreen ? 'BOARD GREEN' : 'BOARD RED'} -> ${out}`);
  process.exit(result.allGreen ? 0 : 1);
}
