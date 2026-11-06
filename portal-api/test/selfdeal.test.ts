import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSelfDeal, emailDomain, normaliseEmail, FREE_MAIL, SIGNUP_WINDOW_MS } from "../src/enterprise/selfdeal.ts";
import { MemoryEntStore, availableCents } from "../src/enterprise/store.ts";
import { RATE_V1, HOLD_DAYS, recordCommission, clawback, resolveHeld, balanceCents } from "../src/enterprise/share.ts";
import type { Party, Tenant } from "../src/enterprise/types.ts";
import type { Invoice } from "../src/store.ts";

// ALL SYNTHETIC DATA. No live traffic was used; thresholds are EXAMPLES (MODELLED).
const T0 = Date.UTC(2026, 10, 6), DAY = 86_400_000;
const P = (id: string, email: string, o: Partial<Party> = {}): Party => ({ accountId: id, email, createdAt: T0, ...o });

test("normalisation: case, whitespace, plus-addressing, trailing dot", () => {
  assert.equal(normaliseEmail("  Boss+promo@Acme.COM. "), "boss@acme.com");
  assert.equal(emailDomain("X@ACME.com"), "acme.com");
  assert.equal(emailDomain("not-an-email"), undefined);
  assert.equal(emailDomain("a@"), undefined);
});
test("rule 1: shared non-free email domain fires, in any case", () => {
  const v = detectSelfDeal([P("a", "Owner@Acme-Security.com.au")], P("b", "second+x@acme-security.COM.au"));
  assert.deepEqual(v, { suspect: true, reasons: ["shared_email_domain"] });
});
test("rule 1: free-mail domains never fire, whole default list", () => {
  for (const d of FREE_MAIL) assert.equal(detectSelfDeal([P("a", `one@${d}`)], P("b", `two@${d.toUpperCase()}`)).suspect, false, d);
  assert.equal(detectSelfDeal([P("a", "x@corp.test")], P("b", "y@corp.test"), { freeMail: ["corp.test"] }).suspect, false, "injected list");
});
test("rule 2: payer fingerprint fires; empty or missing fingerprints never match", () => {
  assert.deepEqual(detectSelfDeal([P("a", "a@one.test", { payerFingerprint: "fp_card_1" })], P("b", "b@two.test", { payerFingerprint: "fp_card_1" })).reasons, ["payer_fingerprint"]);
  assert.equal(detectSelfDeal([P("a", "a@one.test", { payerFingerprint: "fp_1" })], P("b", "b@two.test", { payerFingerprint: "fp_2" })).suspect, false);
  assert.equal(detectSelfDeal([P("a", "a@one.test", { payerFingerprint: "" })], P("b", "b@two.test", { payerFingerprint: "  " })).suspect, false);
  assert.equal(detectSelfDeal([P("a", "a@one.test")], P("b", "b@two.test", { payerFingerprint: "fp_1" })).suspect, false);
});
test("rule 3: same signup network within the window fires; outside the window, other network or no token does not", () => {
  const ref = P("a", "a@one.test", { signupNet: "net_x" });
  assert.deepEqual(detectSelfDeal([ref], P("b", "b@two.test", { signupNet: "net_x", createdAt: T0 + SIGNUP_WINDOW_MS })).reasons, ["signup_burst_same_network"]);
  assert.equal(detectSelfDeal([ref], P("b", "b@two.test", { signupNet: "net_x", createdAt: T0 - SIGNUP_WINDOW_MS - 1 })).suspect, false, "outside window");
  assert.equal(detectSelfDeal([ref], P("b", "b@two.test", { signupNet: "net_y", createdAt: T0 })).suspect, false, "other network");
  assert.equal(detectSelfDeal([ref], P("b", "b@two.test", { createdAt: T0 })).suspect, false, "no token");
  assert.equal(detectSelfDeal([ref], P("b", "b@two.test", { signupNet: "net_x", createdAt: T0 + 3 * DAY }), { windowMs: 5 * DAY }).suspect, true, "custom window");
});
test("a legitimate distinct referee passes; several rules report all reasons", () => {
  assert.deepEqual(detectSelfDeal([P("a", "a@partner.test", { payerFingerprint: "fp1", signupNet: "n1" })], P("b", "b@client.test", { payerFingerprint: "fp2", signupNet: "n2", createdAt: T0 + 90 * DAY })), { suspect: false, reasons: [] });
  assert.equal(detectSelfDeal([], P("b", "b@client.test")).suspect, false, "no referrers");
  const all = detectSelfDeal([P("a", "a@x.test", { payerFingerprint: "f", signupNet: "n" })], P("b", "b@x.test", { payerFingerprint: "f", signupNet: "n" }));
  assert.deepEqual(all.reasons, ["payer_fingerprint", "shared_email_domain", "signup_burst_same_network"]);
});
test("the same account is skipped (blocked upstream by self_referral)", () => {
  assert.equal(detectSelfDeal([P("a", "a@x.test", { payerFingerprint: "f" })], P("a", "a@x.test", { payerFingerprint: "f" })).suspect, false);
});

// ---- integration with the ledger: hold, tap, clawback ----
const partner: Tenant = { id: "t_p", slug: "p", name: "Partner", kind: "partner", createdAt: T0, ssoEnforced: false, partnerAccess: false, refCode: "pr_code", termsAcceptedAt: T0 };
async function setup(refereeParty: Party) {
  const e = new MemoryEntStore();
  await e.putTenant(partner);
  await e.putMember({ tenantId: partner.id, accountId: "acc_staff", role: "admin", addedAt: T0 });
  await e.putReferral({ accountId: refereeParty.accountId, partnerId: partner.id, claimedAt: T0 });
  const parties = new Map<string, Party>([["acc_staff", P("acc_staff", "owner@partnerco.test", { payerFingerprint: "fp_staff" })], [refereeParty.accountId, refereeParty]]);
  const check = { party: async (id: string) => parties.get(id) };
  const inv = (id: string, cents: number): Invoice => ({ id, accountId: refereeParty.accountId, number: id, productId: "ai_growth", amountCents: cents, issuedAt: T0, stripeEventId: "evt_" + id });
  return { e, check, inv };
}
test("flagged commission is held through the 30-day window and beyond; only the tap releases it", async () => {
  const { e, check, inv } = await setup(P("acc_two", "Second@PartnerCo.test"));
  const c = await recordCommission(e, RATE_V1, inv("inv_1", 150_000), T0, check);
  assert.ok(c && c.held && c.amountCents === 45_000 && c.holdReasons?.includes("shared_email_domain"));
  assert.equal(await balanceCents(e, "t_p", T0), 0);
  assert.equal(await balanceCents(e, "t_p", T0 + (HOLD_DAYS + 1) * DAY), 0, "past the window it is STILL held");
  assert.equal(await balanceCents(e, "t_p", T0 + 400 * DAY), 0, "a year on, still held: never auto-released");
  assert.equal((await e.ledgerOf("t_p")).length, 1, "never auto-denied: the entry is kept, not reversed");
  assert.equal(await resolveHeld(e, "t_p", c.id, true), true);
  assert.equal(await balanceCents(e, "t_p", T0 + 29 * DAY), 0, "release keeps the original 30-day availability");
  assert.equal(await balanceCents(e, "t_p", T0 + 31 * DAY), 45_000);
  assert.equal(await resolveHeld(e, "t_p", c.id, true), false, "nothing left to release");
});
test("reject keeps it held for good; payout flow sees zero", async () => {
  const { e, check, inv } = await setup(P("acc_two", "x@partnerco.test"));
  const c = (await recordCommission(e, RATE_V1, inv("inv_1", 150_000), T0, check))!;
  assert.equal(await resolveHeld(e, "t_p", c.id, false), true);
  assert.equal(await resolveHeld(e, "t_p", c.id, false), true);
  const row = (await e.ledgerOf("t_p"))[0];
  assert.equal(row.held, true); assert.equal(row.holdReasons!.filter((r) => r === "rejected_by_operator").length, 1);
  assert.equal(await balanceCents(e, "t_p", T0 + 365 * DAY), 0);
  assert.equal(await resolveHeld(e, "t_p", "led_nope", true), false);
});
test("a distinct legitimate referee earns normally (available after 30 days)", async () => {
  const { e, check, inv } = await setup(P("acc_cust", "ops@realclient.test", { payerFingerprint: "fp_other", signupNet: "net_z", createdAt: T0 + 40 * DAY }));
  const c = (await recordCommission(e, RATE_V1, inv("inv_1", 150_000), T0, check))!;
  assert.ok(!c.held);
  assert.equal(await balanceCents(e, "t_p", T0 + 31 * DAY), 45_000);
});
test("no check supplied: behaviour is unchanged (not held)", async () => {
  const { e, inv } = await setup(P("acc_two", "x@partnerco.test"));
  const c = (await recordCommission(e, RATE_V1, inv("inv_1", 150_000), T0))!;
  assert.ok(!c.held);
});
test("payer fingerprint from the billing adapter holds even with different email domains", async () => {
  const { e, check, inv } = await setup(P("acc_two", "me@elsewhere.test", { payerFingerprint: "fp_staff" }));
  const c = (await recordCommission(e, RATE_V1, inv("inv_1", 100_000), T0, check))!;
  assert.deepEqual(c.holdReasons, ["payer_fingerprint"]);
});
test("clawback on refund: unheld unchanged; held commission's clawback is held with it and nets to zero on release", async () => {
  // unheld: the existing maths
  const a = await setup(P("acc_cust", "ops@realclient.test"));
  const i1 = a.inv("inv_1", 100_000);
  await recordCommission(a.e, RATE_V1, i1, T0, a.check);
  await clawback(a.e, [i1], 100_000, T0 + 2 * DAY);
  assert.equal(await balanceCents(a.e, "t_p", T0 + 31 * DAY), 0);
  assert.equal((await a.e.ledgerOf("t_p")).map((x) => x.amountCents).join(), "30000,-30000");
  assert.ok((await a.e.ledgerOf("t_p")).every((x) => !x.held));
  // held: a full refund must not push the partner's balance negative against OTHER earnings
  const b = await setup(P("acc_two", "x@partnerco.test"));
  const i2 = b.inv("inv_2", 100_000);
  const c = (await recordCommission(b.e, RATE_V1, i2, T0, b.check))!;
  await b.e.addLedger({ id: "led_other", uniq: "other", partnerId: "t_p", kind: "commission", amountCents: 7_000, at: T0, availableAt: T0 });
  await clawback(b.e, [i2], 100_000, T0 + 2 * DAY);
  const rows = await b.e.ledgerOf("t_p");
  assert.ok(rows.find((x) => x.kind === "clawback")!.held);
  assert.equal(await balanceCents(b.e, "t_p", T0 + 31 * DAY), 7_000, "other earnings untouched");
  await resolveHeld(b.e, "t_p", c.id, true);
  assert.equal(await balanceCents(b.e, "t_p", T0 + 31 * DAY), 7_000, "released commission and its clawback net to zero");
  assert.equal(availableCents(await b.e.ledgerOf("t_p"), T0 + 31 * DAY), 7_000);
});
