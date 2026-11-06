// f44: the Pro seat discount is a server-side entitlement, never a client flag. All subscription records are SYNTHETIC.
import test from "node:test";
import assert from "node:assert/strict";
import { rig } from "./market_harness.ts";
import { MemorySeatEntitlements, seatActive } from "../src/market/entitlements.ts";
import { SEAT_FEE_FACTOR, TIERS } from "../src/market/service.ts";

const DAY = 86_400_000;
const setup = async (email: string, opts: Parameters<ReturnType<typeof rig>["pro"]>[1], domain = "se.com.au") => {
  const r = rig(); const o = await r.owner("o@" + domain, domain); const p = await r.pro(email, opts); const id = (await r.hire(o)).job.id;
  const fee = async (s: string) => (await r.h.j(await r.h.req("GET", "/pro/board", { token: s }))).jobs[0].claimFeeCents as number;
  return { r, o, p, id, fee };
};
const FULL = TIERS.standard.claimFeeCents;   // the synthetic SPF job is standard tier (asserted below)

test("forged plan:seat from a non-subscriber pays the full fee on the board and at claim", async () => {
  const { r, p, id, fee } = await setup("forger@x.com", { plan: "seat" });
  assert.equal(await fee(p.session), FULL);
  const prof = await r.h.j(await r.h.req("POST", "/pro/join", { token: p.session, body: { acceptTerms: true, plan: "seat" } }));
  assert.equal(prof.plan, "payg");            // re-joining with plan:seat changes nothing
  assert.equal((await r.claim(p.session, id)).status, 200);
  assert.equal((await r.store.getJob(id))!.tier, "standard");
  assert.equal(r.payments.calls.find((c) => c.op === "claim_fee")!.args.cents, FULL);
});

test("active seat: fee maths unchanged (half, rounded), at board and charged at claim", async () => {
  const { r, p, id, fee } = await setup("act@x.com", { sub: { status: "active", paidThroughMs: 4e12 } });
  assert.equal(await fee(p.session), Math.round(FULL * SEAT_FEE_FACTOR));
  assert.equal(Math.round(FULL * SEAT_FEE_FACTOR), 2_950);   // unchanged maths: round(5900 * 0.5)
  assert.equal((await r.claim(p.session, id)).status, 200);
  assert.equal(r.payments.calls.find((c) => c.op === "claim_fee")!.args.cents, 2_950);
});

test("cancelled seat keeps the discount until paid-through, then loses it", async () => {
  const { r, p, fee } = await setup("can@x.com", { sub: { status: "cancelled", paidThroughMs: 0 } });
  r.seats.set({ accountId: p.account.id, status: "cancelled", paidThroughMs: r.h.clock.t + 10 * DAY });
  assert.equal(await fee(p.session), Math.round(FULL * SEAT_FEE_FACTOR));
  r.h.clock.t += 10 * DAY;                     // exactly at paid-through: still covered
  assert.equal(await fee(p.session), Math.round(FULL * SEAT_FEE_FACTOR));
  r.h.clock.t += 1;                            // one ms after: gone
  assert.equal(await fee(p.session), FULL);
});

test("past_due loses the discount even with a future paid-through date", async () => {
  const { p, fee } = await setup("pd@x.com", { sub: { status: "past_due", paidThroughMs: 4e12 } });
  assert.equal(await fee(p.session), FULL);
});

test("a lapsed 'active' row (webhook never updated it) fails closed", () => {
  assert.equal(seatActive({ accountId: "a", status: "active", paidThroughMs: 1000 }, 1001), false);
  assert.equal(seatActive({ accountId: "a", status: "active", paidThroughMs: NaN }, 1), false);
  assert.equal(seatActive({ accountId: "a", status: "bogus" as any, paidThroughMs: 9e15 }, 1), false);
  assert.equal(seatActive(undefined, 1), false);
});

test("entitlement is per account: a subscriber's seat never discounts another account, even same email domain or display name", async () => {
  const r = rig(); const o = await r.owner("o@pa.com.au", "pa.com.au");
  const a = await r.pro("team1@acme.com", { sub: { status: "active", paidThroughMs: r.h.clock.t + 99 * DAY } });
  const b = await r.pro("team2@acme.com", { plan: "seat" });
  await r.hire(o);
  const board = async (k: string) => (await r.h.j(await r.h.req("GET", "/pro/board", { token: k }))).jobs[0].claimFeeCents;
  assert.equal(await board(a.session), Math.round(FULL * SEAT_FEE_FACTOR));
  assert.equal(await board(b.session), FULL);
  const m = new MemorySeatEntitlements(); m.set({ accountId: "acc_1", status: "active", paidThroughMs: 5 });
  assert.equal(await m.isActiveSeat("acc_1", 5), true); assert.equal(await m.isActiveSeat("acc_10", 5), false); assert.equal(await m.isActiveSeat("ACC_1", 5), false);
});

test("never subscribed, and no adapter wired at all: full fee (fail closed)", async () => {
  const { r, p, fee } = await setup("never@x.com", {});
  assert.equal(await fee(p.session), FULL);
  (r.h.deps.market as any).seats = undefined;
  assert.equal(await fee(p.session), FULL);
  (r.h.deps.market as any).seats = { isActiveSeat: async () => { throw new Error("adapter down"); } };
  assert.equal(await fee(p.session), FULL);   // an erroring adapter never grants a discount
});

test("subscription appearing after join takes effect with no re-join; the stored profile holds no plan", async () => {
  const { r, p, fee } = await setup("late@x.com", {});
  assert.equal(await fee(p.session), FULL);
  r.seats.set({ accountId: p.account.id, status: "active", paidThroughMs: r.h.clock.t + DAY });
  assert.equal(await fee(p.session), Math.round(FULL * SEAT_FEE_FACTOR));
  assert.equal("plan" in (await r.store.getPro(p.account.id))!, false);
});
