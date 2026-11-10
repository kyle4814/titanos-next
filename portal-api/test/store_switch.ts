// STORE=d1 switch for the owner and market harnesses (f380), same shape as ent_harness.ts:34 (ENT_STORE=d1).
// STORE=d1 runs the owner and market suites against D1OwnerStore / D1MarketStore on a FakeD1 (real SQLite + every real migration).
// Foreign keys are OFF in this mode only because the portal accounts and domains live in MemoryStore in these harnesses.
// test/owner_store_contract.test.ts and test/d1_store_parity.test.ts run FK ON.
import { MemoryOwnerStore, type OwnerStore } from "../src/owner/engine.ts";
import { D1OwnerStore } from "../src/owner/d1ownerstore.ts";
import { MemoryMarketStore, type MarketStore } from "../src/market/store.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
import { FakeD1 } from "./fake_d1.ts";

export type HarnessKind = "memory" | "d1";
export const harnessKind = (): HarnessKind => (process.env.STORE === "d1" ? "d1" : "memory");
function fakeNoFk(): FakeD1 { const f = new FakeD1(); f.db.exec("PRAGMA foreign_keys = OFF"); return f; }
export function makeOwnerStore(kind: HarnessKind = harnessKind(), clock?: () => number): OwnerStore {
  return kind === "d1" ? new D1OwnerStore(fakeNoFk(), clock) : new MemoryOwnerStore();
}
export function makeMarketStore(kind: HarnessKind = harnessKind()): MarketStore {
  return kind === "d1" ? new D1MarketStore(fakeNoFk()) : new MemoryMarketStore();
}

// The detector: what class the harness MUST have handed out for a kind. A harness that ignores STORE=d1 fails assertStoreClass.
export const EXPECTED = { owner: { memory: "MemoryOwnerStore", d1: "D1OwnerStore" }, market: { memory: "MemoryMarketStore", d1: "D1MarketStore" } } as const;
export function assertStoreClass(which: "owner" | "market", store: object, kind: HarnessKind = harnessKind()): void {
  const want = EXPECTED[which][kind], got = store.constructor.name;
  if (got !== want) throw new Error(`harness_ignored_store_switch: ${which} store is ${got}, STORE=${kind} requires ${want}`);
}
