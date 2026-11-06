// test_soak_portal_run.mjs - the portal soak shim: every target answers 2xx on correct portal output,
// the validators BITE (a wrong portal answer is counted as portal_wrong, not ok), keyless MCP is 401.
// Run: node --experimental-strip-types scripts/test_soak_portal_run.mjs   (~12 s, loopback only)
import assert from 'node:assert/strict';
import http from 'node:http';
import { bootPortal, portalSoak } from './soak_portal_run.mjs';

let pass = 0;
const ok = (n) => { pass++; console.log('PASS', n); };
const get = (url) => new Promise((res, rej) => http.get(url, (r) => { r.resume(); r.on('end', () => res(r.statusCode)); }).on('error', rej));

const p = await bootPortal();
assert.deepEqual(p.names, ['scan', 'concierge', 'mcp_tools_list', 'agent_tools_public']);
for (const u of p.targets) { assert.ok(u.startsWith('http://127.0.0.1:')); for (let i = 0; i < 25; i++) assert.equal(await get(u), 200); }
for (const n of p.names) { assert.equal(p.stats[n].ok, 25); assert.equal(p.stats[n].wrong + p.stats[n].threw, 0); }
ok('four loopback targets answer 200 on correct portal output (25 each, incl. every scan fixture)');
assert.equal(p.keylessProbe.status, 401);
assert.equal(p.keylessProbe.body.error.code, -32001);
ok('key-less MCP tools/list is 401 (authenticated by design), probed outside the load');
await p.close();

// mutation: a wrong portal answer must show as portal_wrong (502), never ok
const bad = await bootPortal();
const { FIXTURES } = await import('../lib/guestscan/fixtures.ts');
const saved = FIXTURES[0].expect.SPF;
FIXTURES[0].expect.SPF = 'FAIL'; // the real scan says PASS for the perfect fixture, so this must be caught
assert.equal(await get(bad.targets[0]), 502);
assert.equal(bad.stats.scan.wrong, 1);
FIXTURES[0].expect.SPF = saved;
await bad.close();
ok('mutation: a mismatched scan result is counted portal_wrong (502), not ok');

const r = await portalSoak({ durationS: 6, rps: 40, seed: 3, faults: { drop: 0.01, err5xx: 0.01, delayRate: 0.05, delayMs: 50 } });
assert.equal(r.rows.length, 16);
assert.ok(r.per_target.every((t) => t.portal_wrong === 0 && t.portal_threw === 0), JSON.stringify(r.per_target));
assert.ok(r.per_target.every((t) => t.requests_reaching_portal > 0));
assert.ok(r.synthetic && r.localhost_only);
assert.deepEqual(r.not_http_routes_in_portal_api, ['guest scan', 'concierge ask']);
ok('6 s run with chaos: 16 rows, portal_wrong 0, portal_threw 0, every target reached');
console.log(`ALL PASS ${pass}`);
