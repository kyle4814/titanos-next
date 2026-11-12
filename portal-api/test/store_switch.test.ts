// f380: the STORE=d1 switch in owner_harness.ts / market_harness.ts really switches, and a harness that ignores it is caught.
// Run twice: default (memory) and STORE=d1. SYNTHETIC data only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rig as ownerRig } from "./owner_harness.ts";
import { rig as marketRig } from "./market_harness.ts";
import { assertStoreClass, harnessKind, makeMarketStore, makeOwnerStore, EXPECTED } from "./store_switch.ts";
import { MemoryOwnerStore } from "../src/owner/engine.ts";
import { MemoryMarketStore, type Job } from "../src/market/store.ts";

test("the owner and market harnesses hand out the store class STORE selects", () => {
  assertStoreClass("owner", ownerRig().c.store); assertStoreClass("market", marketRig().store);
  assert.equal(ownerRig().c.store.constructor.name, EXPECTED.owner[harnessKind()]);
  assert.equal(marketRig().store.constructor.name, EXPECTED.market[harnessKind()]);
});
test("the rig's wired market store IS the asserted store (not a second one)", () => { const r = marketRig(); assert.equal(r.h.deps.market!.store, r.store); });
test("explicit kinds always build the named class, whatever the environment says", () => {
  assert.equal(makeOwnerStore("d1").constructor.name, "D1OwnerStore"); assert.equal(makeOwnerStore("memory").constructor.name, "MemoryOwnerStore");
  assert.equal(makeMarketStore("d1").constructor.name, "D1MarketStore"); assert.equal(makeMarketStore("memory").constructor.name, "MemoryMarketStore");
});
test("PLANTED harness that ignores STORE=d1 (always Memory) is DETECTED", () => {
  assert.throws(() => assertStoreClass("owner", new MemoryOwnerStore(), "d1"), /harness_ignored_store_switch.*MemoryOwnerStore.*D1OwnerStore/);
  assert.throws(() => assertStoreClass("market", new MemoryMarketStore(), "d1"), /harness_ignored_store_switch.*MemoryMarketStore.*D1MarketStore/);
  // and the converse: a planted harness that is D1 when memory was asked is caught too
  assert.throws(() => assertStoreClass("market", makeMarketStore("d1"), "memory"), /harness_ignored_store_switch/);
  assert.doesNotThrow(() => assertStoreClass("owner", new MemoryOwnerStore(), "memory"));
});
test("under STORE=d1 the owner harness really persists through SQL (state survives a fresh read of the same fake D1)", async () => {
  if (harnessKind() !== "d1") return;
  const r = ownerRig(); const s = await r.open(); await r.scan(s);
  const again = await r.c.store.get("dom_1"); assert.ok(again && (again.rev ?? 0) >= 1, "row read back from SQLite with a revision");
});

// FINDING 1 (real Memory vs D1 divergence, NOT fixed here, stores not redesigned): migrations/0004_market.sql:19 uq_market_live_job
// (one live job per domain_id+check_name). D1MarketStore refuses a second live job for the same pair (raw SQLITE_CONSTRAINT error);
// MemoryMarketStore.putJob accepts it silently. The service layer checks before writing, so only direct store use sees it.
// The memory case is marked todo (runs, reports the failure, does not fail the suite); the D1 case is a hard assertion.
const J = (id: string): Job => ({ id, ownerAccountId: "o0", domainId: "d0", domain: "x0.example.com", check: "SPF", severity: "WARN", tier: "small", priceCents: 100, claimFeeCents: 10, status: "open", createdAt: 1, updatedAt: 1, baseline: { at: 1, status: "WARN", detail: "" }, abandonedBy: [], rescans: 0, warrantyChecks: 0, events: [] });
for (const kind of ["memory", "d1"] as const) {
  test(`FINDING 1: ${kind} store refuses a second live job for the same domain+check`, { todo: kind === "memory" ? "FINDING 1: MemoryMarketStore lacks the uq_market_live_job invariant" : false }, async () => {
    const st = makeMarketStore(kind); await st.putJob(J("a"));
    await assert.rejects(st.putJob(J("b")), "second live job for d0+SPF must be refused");
  });
}
