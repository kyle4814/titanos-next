#!/usr/bin/env node
// soak_portal_run.mjs - C10 soak run against the REAL local portal code, loopback only.
// Usage: node --experimental-strip-types scripts/soak_portal_run.mjs --duration 600 --out docs/soak/board.json
//
// What is real: the portal-api Worker `handle()` (MCP tools/list, GET /agent/tools), lib/guestscan runScan
// (the guest scan engine), lib/concierge route() (the concierge router over the real shelves).
// What is synthetic: DNS answers (fakeDoh over lib/guestscan fixtures), the key + account (MemoryStore, mock
// mailer/billing), the asks (lib/concierge/questions.tsv). No model call, no network beyond loopback.
// What is NOT a Worker route: guest scan and concierge ask have no HTTP route in portal-api today (they are
// libraries), so this shim fronts the library call on a loopback port. That is stated in the board JSON.
// Chaos (drop, delay, 5xx) is injected by soak_harness.mjs in front of every target, not by the portal.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runSoak, listen, Hist } from './soak_harness.mjs';

const root = new URL('..', import.meta.url).pathname;
const R = (p) => import(pathToFileURL(root + p).href);

export async function bootPortal() {
  const { make } = await R('portal-api/test/harness.ts');
  const { FIXTURES, fakeDoh } = await R('lib/guestscan/fixtures.ts');
  const { runScan } = await R('lib/guestscan/scan.ts');
  const { buildIndex, route } = await R('lib/concierge/router.ts');
  const { PORTAL } = await R('lib/concierge/portal.ts');
  const { shelfFromOffer } = await R('lib/concierge/offers.ts');
  const offers = [];
  for (const f of fs.readdirSync(root + 'lib/offers/data').filter((x) => x.endsWith('.ts'))) {
    const m = await R('lib/offers/data/' + f);
    for (const v of Object.values(m)) if (Array.isArray(v)) offers.push(...v);
  }
  const index = buildIndex([...PORTAL, ...offers.map(shelfFromOffer)]);
  const asks = fs.readFileSync(root + 'lib/concierge/questions.tsv', 'utf8').split('\n').filter(Boolean).map((l) => { const [seat, expect, q] = l.split('\t'); return { seat, q }; });

  // synthetic account + a read-scoped key, through the real /auth and /keys routes
  const h = make();
  const s = await h.login('soak@example.com.au');
  const k = await h.j(await h.req('POST', '/keys', { token: s.session, body: { scopes: ['catalogue:read', 'scan:read'] } }));
  const key = k.key;
  let rid = 0;
  const rpc = (token, method) => h.req('POST', '/mcp', { token, body: { jsonrpc: '2.0', id: ++rid, method } });

  const ops = {
    // each returns true when the portal answered correctly, false when it answered wrong
    scan: async (n) => {
      const fx = FIXTURES[n % FIXTURES.length];
      const r = await runScan(fx.domain, fakeDoh(fx.world).fetch);
      if (r.modelCalls !== 0) return false;
      for (const [id, st] of Object.entries(fx.expect)) { const f = r.findings.find((x) => x.check === id); if (!f || f.status !== st) return false; }
      return !fx.grade || r.grade === fx.grade;
    },
    concierge: async (n) => {
      const a = asks[n % asks.length];
      const r = route(index, a.q, a.seat);
      return r.kind === 'match' || r.kind === 'ask' || r.kind === 'unmatched';
    },
    mcp_tools_list: async () => {
      const r = await rpc(key, 'tools/list');
      if (r.status !== 200) return false;
      const j = await r.json();
      return Array.isArray(j.result?.tools) && j.result.tools.length > 0;
    },
    agent_tools_public: async () => {
      const r = await h.req('GET', '/agent/tools');
      if (r.status !== 200) return false;
      const j = await r.json();
      return Array.isArray(j.tools) && j.tools.length > 0;
    },
  };

  // key-less probe, once, outside the load: the MCP route is authenticated by design
  const keyless = await rpc(undefined, 'tools/list');
  const keylessProbe = { status: keyless.status, body: await keyless.json(), www_authenticate: keyless.headers.get('www-authenticate') };

  const stats = Object.fromEntries(Object.keys(ops).map((n) => [n, { n: 0, ok: 0, wrong: 0, threw: 0, hist: new Hist() }]));
  const servers = [];
  const targets = [];
  for (const [name, fn] of Object.entries(ops)) {
    let n = 0;
    const srv = http.createServer(async (req, res) => {
      const st = stats[name]; st.n++;
      const t0 = performance.now();
      try {
        const good = await fn(n++);
        st.hist.add(performance.now() - t0);
        if (good) { st.ok++; res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); }
        else { st.wrong++; res.writeHead(502); res.end('{"portal_wrong":true}'); }
      } catch (e) {
        st.threw++; st.lastError = String(e?.message ?? e).slice(0, 200);
        res.writeHead(500); res.end('{"portal_threw":true}');
      }
    });
    servers.push(srv);
    targets.push(await listen(srv));
  }
  return { targets, names: Object.keys(ops), stats, keylessProbe, store: h.store, close: () => Promise.all(servers.map((s) => new Promise((r) => { s.closeAllConnections?.(); s.close(r); }))) };
}

export async function portalSoak({ durationS, rps = 60, concurrency = 8, seed = 1, faults, thresholds } = {}) {
  const portal = await bootPortal();
  const mem0 = process.memoryUsage();
  const result = await runSoak({ durationS, rps, concurrency, seed, targets: portal.targets, faults, thresholds });
  const mem1 = process.memoryUsage();
  await portal.close();
  const perTarget = portal.names.map((name, i) => {
    const s = portal.stats[name];
    return { name, url: portal.targets[i], requests_reaching_portal: s.n, ok: s.ok, portal_wrong: s.wrong, portal_threw: s.threw, handler_p50_ms: s.hist.pct(50), handler_p95_ms: s.hist.pct(95), handler_p99_ms: s.hist.pct(99), lastError: s.lastError };
  });
  return { ...result, kind: 'C10 portal soak against local portal code', real: ['portal-api handle() (MCP tools/list, GET /agent/tools)', 'lib/guestscan runScan', 'lib/concierge route()'],
    synthetic_inputs: ['fakeDoh DNS fixtures', 'MemoryStore account and key', 'questions.tsv asks'],
    not_http_routes_in_portal_api: ['guest scan', 'concierge ask'], keyless_mcp_probe: portal.keylessProbe, per_target: perTarget,
    portal_memory: { heapUsedStartMB: +(mem0.heapUsed / 1048576).toFixed(1), heapUsedEndMB: +(mem1.heapUsed / 1048576).toFixed(1), rssStartMB: +(mem0.rss / 1048576).toFixed(1), rssEndMB: +(mem1.rss / 1048576).toFixed(1), note: 'harness and portal share one process; no forced GC, so this is a rough leak signal only' } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) if (v[i].startsWith('--')) a[v[i].slice(2)] = v[i + 1];
  const num = (k, d) => (a[k] !== undefined ? Number(a[k]) : d);
  const result = await portalSoak({ durationS: num('duration', 600), rps: num('rps', 60), concurrency: num('concurrency', 8), seed: num('seed', 1),
    faults: { drop: num('drop', 0.002), delayRate: num('delay-rate', 0.02), delayMs: num('delay-ms', 150), err5xx: num('err5xx', 0.003) } });
  const out = a.out || 'soak_portal_board.json';
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  for (const r of result.rows) console.log(`${r.status.padEnd(5)} ${r.id.padEnd(3)} ${String(r.value).padStart(10)} ${r.op} ${r.threshold}  ${r.name}`);
  for (const t of result.per_target) console.log(JSON.stringify(t));
  console.log(`${result.allGreen ? 'BOARD GREEN' : 'BOARD RED'} -> ${out}`);
  process.exit(result.allGreen ? 0 : 1);
}
