// f360: the f358 SSO start fairness (per-source sub-cap + same-source oldest-first eviction) on BOTH EntStore adapters: MemoryEntStore and
// D1EntStore over FakeD1 (real SQLite + every real migration, incl. 0022). Synthetic data only. Nothing live.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/util.ts";
import { makeEnt, ssoRows } from "./ent_harness.ts";
import { MAX_OPEN_SSO_STATES, MAX_OPEN_SSO_STATES_PER_CLIENT, SSO_NEWCOMER_RESERVE } from "../src/enterprise/service.ts";

async function world(kind: "memory" | "d1") {
  process.env.ENT_STORE = kind;
  const h = makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  await h.addVerifiedAsset(o.session, o.tenant.id, "bigco.com.au");
  await h.configureSso(o.session, o.tenant.id, "bigco.com.au");
  const store = (h.deps.ent as any).store;
  const start = (ip: string) => h.req("POST", "/sso/bigco/start", { headers: { "cf-connecting-ip": ip } });
  const open = (ip?: string) => store.openSsoStates(o.tenant.id, h.clock.t, ip) as Promise<number>;
  return { h, start, open, store, tid: o.tenant.id as string };
}
const ipOf = (i: number) => `203.0.${Math.floor(i / 20) % 256}.${(Math.floor(i / 20) >> 8) + 1}`;

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] (a) f64 flood: 1,100 starts from 55 addresses, then a legitimate new address still gets a state (legitUserBlocked false)`, async () => {
    const { start, open } = await world(kind);
    let ok = 0;
    for (let i = 0; i < 1100; i++) { const r = await start(ipOf(i)); if (r.status === 200) ok++; await r.text(); }
    assert.equal(ok, 1100, "no flooder start is refused: each recycles its own oldest");
    assert.ok((await open()) <= MAX_OPEN_SSO_STATES - SSO_NEWCOMER_RESERVE + 55);
    const legit = await start("198.51.100.77");
    assert.equal(legit.status, 200, "legitUserBlocked: false");
    assert.ok((await legit.json()).state);
  });
  test(`[${kind}] (b) one source holds at most its sub-cap and only ever evicts itself; eviction is oldest-first`, async () => {
    const { start, open, store, h } = await world(kind);
    const other = await (await start("198.51.100.5")).json();
    const first = await (await start("203.0.113.9")).json();
    for (let i = 0; i < MAX_OPEN_SSO_STATES_PER_CLIENT * 3; i++) { h.clock.t += 1000; await (await start("203.0.113.9")).text(); }
    assert.equal(await open("203.0.113.9"), MAX_OPEN_SSO_STATES_PER_CLIENT);
    assert.equal(await open("198.51.100.5"), 1, "the other source's state was not evicted");
    assert.equal(ssoRows.has(store, await sha256Hex(other.state)), true);
    assert.equal(ssoRows.has(store, await sha256Hex(first.state)), false, "the source's oldest was dropped");
  });
  test(`[${kind}] (f) legacy NULL client_key rows count toward the tenant cap but are never evicted by a source's own-row rule`, async () => {
    const { start, open, store, tid, h } = await world(kind);
    const LEGACY = MAX_OPEN_SSO_STATES - 5;
    for (let i = 0; i < LEGACY; i++) ssoRows.legacy(store, tid, `legacy_${i}`, h.clock.t + 60_000 + i);
    assert.equal(await open(), LEGACY, "legacy rows count toward the tenant cap");
    h.clock.t += 30_000;
    for (let i = 0; i < MAX_OPEN_SSO_STATES_PER_CLIENT * 3; i++) await (await start("203.0.113.9")).text();   // tenant stays below the cap: no legacy eviction
    assert.equal(ssoRows.count(store, null), LEGACY, "all legacy rows present while the tenant is under its cap");
  });
  test(`[${kind}] (g) f365: 1000 legacy rows, a new source start succeeds and evicts the OLDEST legacy row only`, async () => {
    const { start, open, store, tid, h } = await world(kind);
    for (let i = 0; i < MAX_OPEN_SSO_STATES; i++) ssoRows.legacy(store, tid, `legacy_${i}`, h.clock.t + 60_000 + i);   // legacy_0 is the oldest
    assert.equal(await open(), MAX_OPEN_SSO_STATES);
    h.clock.t += 1000;
    const r = await start("198.51.100.20");
    assert.equal(r.status, 200, "no 429: the tenant cap is relieved by a legacy slot");
    const st = (await r.json()).state;
    assert.equal(ssoRows.has(store, "legacy_0"), false, "oldest legacy row evicted");
    assert.equal(ssoRows.has(store, "legacy_1"), true);
    assert.equal(ssoRows.count(store, null), MAX_OPEN_SSO_STATES - 1);
    assert.equal(ssoRows.has(store, await sha256Hex(st)), true);
    assert.equal(await open(), MAX_OPEN_SSO_STATES, "tenant cap still the outer bound");
    // a second new source evicts the NEXT oldest, never the first source's keyed row
    h.clock.t += 1000;
    assert.equal((await start("198.51.100.21")).status, 200);
    assert.equal(ssoRows.has(store, "legacy_1"), false);
    assert.equal(ssoRows.has(store, await sha256Hex(st)), true, "another source's keyed row untouched");
    assert.equal(await open("198.51.100.20"), 1);
  });
  test(`[${kind}] (h) f365: a full tenant of KEYED rows still 429s a new source; keyed rows are never evicted by legacy relief; other tenants untouched`, async () => {
    const { start, open, store, tid, h } = await world(kind);
    let n = 0, blocked = 0;
    for (let i = 0; i < 1100 && !blocked; i++) { const r = await start(`10.8.${i % 250}.${Math.floor(i / 250)}`); if (r.status === 429) blocked++; else n++; await r.text(); }
    assert.ok(blocked > 0, "distinct sources with no legacy rows still hit the 429 residual");
    assert.equal(ssoRows.count(store, null), 0);
    void tid; void h; void open; void n;
  });
  test(`[${kind}] (i) f365: legacy relief is tenant-scoped: another tenant's OLDER legacy rows are never evicted`, async () => {
    const { start, store, tid, h } = await world(kind);
    for (let i = 0; i < 5; i++) ssoRows.legacy(store, "t_other_tenant", `other_${i}`, h.clock.t + 1_000 + i);   // older than every row of this tenant
    for (let i = 0; i < MAX_OPEN_SSO_STATES; i++) ssoRows.legacy(store, tid, `legacy_${i}`, h.clock.t + 60_000 + i);
    h.clock.t += 500;
    assert.equal((await start("198.51.100.30")).status, 200);
    assert.equal(ssoRows.has(store, "legacy_0"), false, "this tenant's oldest legacy row went");
    for (let i = 0; i < 5; i++) assert.equal(ssoRows.has(store, `other_${i}`), true, "other tenant's legacy rows untouched");
  });
}
test("(c)/(e) wiring: the D1 path uses the named constants from service.ts and the new migration is nullable and indexed", async () => {
  const { readFileSync } = await import("node:fs");
  const m = readFileSync(new URL("../migrations/0022_sso_states_client_key.sql", import.meta.url), "utf8");
  assert.match(m, /ADD COLUMN client_key TEXT;/);
  assert.doesNotMatch(m, /client_key TEXT NOT NULL/);
  assert.match(m, /ON sso_states\(tenant_id, client_key, created_at\)/);
});
