// f378: ONE contract suite over MemorySeatEntitlements and D1SeatEntitlements (real SQLite via fake_d1.ts, every real migration), plus a mutant
// that the suite must kill. Synthetic accounts only (example.test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemorySeatEntitlements, type SeatEntitlements, type SeatSubscription } from "../src/market/entitlements.ts";
import { D1SeatEntitlements } from "../src/market/d1seats.ts";
import { FakeD1 } from "./fake_d1.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const T = Date.UTC(2026, 10, 10), DAY = 86_400_000;
type Seats = SeatEntitlements & { set(s: SeatSubscription): void | Promise<void> };
const seedAcct = (d: FakeD1, id: string) => d.db.prepare("INSERT OR IGNORE INTO accounts (id, email) VALUES (?, ?)").run(id, `${id}@example.test`);
const adapters: { name: string; make: () => { seats: Seats; seed: (id: string) => void } }[] = [
  { name: "MemorySeatEntitlements", make: () => ({ seats: new MemorySeatEntitlements(), seed: () => {} }) },
  { name: "D1SeatEntitlements", make: () => { const d = new FakeD1(); return { seats: new D1SeatEntitlements(d, () => T), seed: (id) => seedAcct(d, id) }; } },
];

// The contract. Returns nothing; throws on the first violated rule. Reused unchanged for the mutant.
export async function seatContract({ seats, seed }: { seats: Seats; seed: (id: string) => void }) {
  for (const a of ["a1", "a2", "a3", "a4", "a5"]) seed(a);
  assert.equal(await seats.isActiveSeat("a1", T), false, "no record -> no seat");
  await seats.set({ accountId: "a1", status: "active", paidThroughMs: T + DAY });
  assert.equal(await seats.isActiveSeat("a1", T), true, "active inside the paid period");
  assert.equal(await seats.isActiveSeat("a1", T + DAY), true, "boundary: now == paidThrough is still a seat");
  assert.equal(await seats.isActiveSeat("a1", T + DAY + 1), false, "a lapsed active row fails closed");
  await seats.set({ accountId: "a2", status: "past_due", paidThroughMs: T + 30 * DAY });
  assert.equal(await seats.isActiveSeat("a2", T), false, "past_due is never a seat, even with future paidThrough");
  await seats.set({ accountId: "a3", status: "cancelled", paidThroughMs: T + DAY });
  assert.equal(await seats.isActiveSeat("a3", T), true, "cancelled keeps the seat until paidThrough");
  assert.equal(await seats.isActiveSeat("a3", T + 2 * DAY), false, "cancelled is over after paidThrough");
  await Promise.resolve().then(() => seats.set({ accountId: "a4", status: "active", paidThroughMs: Number.POSITIVE_INFINITY })).catch(() => {});   // an adapter may refuse or store it; either way it must grant nothing
  assert.equal(await seats.isActiveSeat("a4", T), false, "a refused/non-finite record grants nothing");
  await seats.set({ accountId: "a5", status: "past_due", paidThroughMs: T + DAY });
  await seats.set({ accountId: "a5", status: "active", paidThroughMs: T + DAY });
  assert.equal(await seats.isActiveSeat("a5", T), true, "upsert replaces: past_due -> active");
  await seats.set({ accountId: "a5", status: "active", paidThroughMs: T + DAY });
  assert.equal(await seats.isActiveSeat("a5", T), true, "a replayed webhook is idempotent");
  assert.equal(await seats.isActiveSeat("a2", T + 5 * DAY), false, "one account's row never grants another's seat");
  assert.equal(await seats.isActiveSeat("nobody", T), false);
}

for (const { name, make } of adapters) test(`${name}: seat entitlement contract`, async () => { await seatContract(make()); });

test("D1: invalid status is refused by the adapter and by the CHECK constraint", async () => {
  const d = new FakeD1(); seedAcct(d, "a1");
  await assert.rejects(new D1SeatEntitlements(d).set({ accountId: "a1", status: "bogus" as never, paidThroughMs: T }));
  assert.throws(() => d.db.prepare("INSERT INTO seat_subscriptions (account_id, status, paid_through_ms, updated_at) VALUES ('a1','bogus',1,1)").run());
});
test("D1: unknown account is refused by the foreign key (no orphan seat rows)", async () => {
  await assert.rejects(new D1SeatEntitlements(new FakeD1()).set({ accountId: "ghost", status: "active", paidThroughMs: T }));
});
test("D1: the migration is idempotent (applied twice, no error)", () => {
  const d = new FakeD1(); const sql = readFileSync(fileURLToPath(new URL("../migrations/0026_seat_subscriptions.sql", import.meta.url)), "utf8");
  d.db.exec(sql); d.db.exec(sql);
});

// MUTANT: reads the row but ignores the paid period (the classic "active forever" bug). The contract MUST fail on it.
class IgnoresPaidThrough extends D1SeatEntitlements {
  override async isActiveSeat(accountId: string) { const s = await this.get(accountId); return !!s && s.status !== "past_due"; }
}
test("MUTANT killed: an adapter that ignores paidThrough fails the contract", async () => {
  const d = new FakeD1();
  await assert.rejects(seatContract({ seats: new IgnoresPaidThrough(d, () => T), seed: (id) => seedAcct(d, id) }));
});
