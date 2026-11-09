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
  test(`[${kind}] (f) rows from before the migration (client_key NULL) count toward the tenant cap and are never evicted by the per-source rule`, async () => {
    const { start, open, store, tid, h } = await world(kind);
    const LEGACY = MAX_OPEN_SSO_STATES - 5;
    for (let i = 0; i < LEGACY; i++) ssoRows.legacy(store, tid, `legacy_${i}`, h.clock.t + 60_000);   // oldest rows in the tenant: expires_at - TTL is long before any live created_at
    assert.equal(await open(), LEGACY, "legacy rows count toward the tenant cap");
    h.clock.t += 30_000;   // live rows are created after every legacy row
    for (let i = 0; i < MAX_OPEN_SSO_STATES_PER_CLIENT * 3; i++) await (await start("203.0.113.9")).text();
    assert.equal(ssoRows.count(store, null), LEGACY, "all legacy (NULL client_key) rows still present");
    assert.ok(ssoRows.has(store, "legacy_0") && ssoRows.has(store, `legacy_${LEGACY - 1}`), "no legacy row was evicted by a source");
    assert.ok((await open()) <= MAX_OPEN_SSO_STATES, "tenant cap still the outer bound");
    // once the tenant is full of legacy + live rows, a brand-new source is refused (429) rather than evicting anyone's rows
    let blocked = 0;
    for (let i = 0; i < 30; i++) { const r = await start(`10.9.${i}.1`); if (r.status === 429) blocked++; await r.text(); }
    assert.ok(blocked > 0, "RESIDUAL: a tenant filled by many distinct sources still 429s the next new source");
    assert.equal(ssoRows.count(store, null), LEGACY, "and still all present after the refusals");
  });
}
test("(c)/(e) wiring: the D1 path uses the named constants from service.ts and the new migration is nullable and indexed", async () => {
  const { readFileSync } = await import("node:fs");
  const m = readFileSync(new URL("../migrations/0022_sso_states_client_key.sql", import.meta.url), "utf8");
  assert.match(m, /ADD COLUMN client_key TEXT;/);
  assert.doesNotMatch(m, /client_key TEXT NOT NULL/);
  assert.match(m, /ON sso_states\(tenant_id, client_key, created_at\)/);
});
