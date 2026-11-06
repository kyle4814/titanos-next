// Reruns the ENTIRE C4 service suite (test/market.test.ts, 24 tests incl. the first-10-jobs drill and forced races)
// with MarketStore = D1MarketStore over real SQLite. The query string forces a fresh module instance.
(globalThis as { MARKET_ADAPTER?: string }).MARKET_ADAPTER = "d1";
await import("./market.test.ts?adapter=d1");
import { test } from "node:test";
import assert from "node:assert/strict";
import { rig } from "./market_harness.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
test("the service rerun really is on the D1 adapter", () => { assert.ok(rig().store instanceof D1MarketStore); });
