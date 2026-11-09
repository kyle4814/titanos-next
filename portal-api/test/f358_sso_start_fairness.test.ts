// f358: SSO start availability fairness. Synthetic data only. A flooder source can only displace its OWN oldest state; a new source is never locked out by a distributed flood.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sha256Hex } from "../src/util.ts";
import { makeEnt } from "./ent_harness.ts";
import { MAX_OPEN_SSO_STATES, MAX_OPEN_SSO_STATES_PER_CLIENT, SSO_NEWCOMER_RESERVE } from "../src/enterprise/service.ts";

async function world() {
  const h = makeEnt();
  const o = await h.provision("enterprise", "ciso@bigco.com.au", "BigCo", "bigco");
  await h.addVerifiedAsset(o.session, o.tenant.id, "bigco.com.au");
  await h.configureSso(o.session, o.tenant.id, "bigco.com.au");
  const start = (ip: string) => h.req("POST", "/sso/bigco/start", { headers: { "cf-connecting-ip": ip } });
  const open = (ip?: string) => h.store.openSsoStates(o.tenant.id, h.clock.t, ip);
  return { h, start, open };
}
const ipOf = (i: number) => `203.0.${Math.floor(i / 20) % 256}.${(Math.floor(i / 20) >> 8) + 1}`;

test("constants: the sub-cap and reserve are named and sit inside the tenant cap", () => {
  assert.ok(MAX_OPEN_SSO_STATES_PER_CLIENT >= 1 && MAX_OPEN_SSO_STATES_PER_CLIENT <= MAX_OPEN_SSO_STATES / 10);
  assert.equal(SSO_NEWCOMER_RESERVE, MAX_OPEN_SSO_STATES / 10);
});
test("f64 flood: 1,100 starts from 55 addresses, then a legitimate new address still gets a state (legitUserBlocked false)", async () => {
  const { start, open } = await world();
  let ok = 0;
  for (let i = 0; i < 1100; i++) { const r = await start(ipOf(i)); if (r.status === 200) ok++; await r.text(); }
  assert.equal(ok, 1100, "no flooder start is refused: each recycles its own oldest");
  const n = await open(), sources = 55;
  assert.ok(n <= MAX_OPEN_SSO_STATES - SSO_NEWCOMER_RESERVE + sources, `established sources are held at the reserve line; late sources hold at most one reserve slot each (open ${n})`);
  const legit = await start("198.51.100.77");
  assert.equal(legit.status, 200, "legitUserBlocked: false");
  assert.ok((await legit.json()).state);
});
test("one source never holds more than its sub-cap and only evicts itself", async () => {
  const { start, open, h } = await world();
  const victim = await (await start("198.51.100.5")).json();
  for (let i = 0; i < MAX_OPEN_SSO_STATES_PER_CLIENT * 3; i++) await (await start("203.0.113.9")).text();
  assert.equal(await open("203.0.113.9"), MAX_OPEN_SSO_STATES_PER_CLIENT);
  assert.equal(await open("198.51.100.5"), 1, "the other source's state was not evicted");
  assert.ok([...h.store.states.values()].some((s: any) => s.clientKey === "198.51.100.5"));
  assert.ok(victim.state);
});
test("eviction is oldest-first within the source", async () => {
  const { start, h } = await world();
  const first = await (await start("203.0.113.9")).json();
  for (let i = 0; i < MAX_OPEN_SSO_STATES_PER_CLIENT; i++) { h.clock.t += 1000; await (await start("203.0.113.9")).text(); }
  assert.equal(h.store.states.has(await sha256Hex(first.state)), false, "the oldest was dropped");
  assert.equal([...h.store.states.values()].length, MAX_OPEN_SSO_STATES_PER_CLIENT);
});
test("the tenant cap stays the outer bound (distributed flood of fresh addresses is the documented residual)", async () => {
  const { start, open } = await world();
  let blocked = 0;
  for (let i = 0; i < MAX_OPEN_SSO_STATES + 50; i++) { const r = await start(`10.${i >> 8}.${i & 255}.1`); if (r.status === 429) blocked++; await r.text(); }
  assert.ok((await open()) <= MAX_OPEN_SSO_STATES);
  assert.equal(blocked, 50, "RESIDUAL: 1,050 distinct addresses still fill the tenant cap");
});
