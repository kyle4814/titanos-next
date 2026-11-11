// C8 f426 tests. SYNTHETIC data only. Memory adapter, MockPayouts: no Stripe, no network, no money, no provider call.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeEnt } from "./ent_harness.ts";

const T0 = 1_000_000;
async function world() {
  const e = makeEnt();
  const A = await e.provision("partner", "boss-a@synthetic.example.test", "SYNTHETIC partner A", "syn-a", { termsAccepted: true, payoutAccount: "acct_SYNTH_A" });
  const B = await e.provision("partner", "boss-b@synthetic.example.test", "SYNTHETIC partner B", "syn-b", { termsAccepted: true, payoutAccount: "acct_SYNTH_B" });
  const ida = A.tenant.id as string, idb = B.tenant.id as string;
  const add = (id: string, partnerId: string, status: string, extra: Record<string, unknown> = {}) => e.store.putPayout({ id, partnerId, amountCents: 250_000, status, createdAt: T0, ...extra } as any);
  const snap = () => JSON.stringify([...(e.store as any).payouts.values()]) + JSON.stringify([...(e.store as any).ledger.values()]);
  const att = (tid: string, tok?: string, q = "") => e.req("GET", `/partners/${tid}/payouts/attention${q}`, { token: tok });
  const plan = (tid: string, tok?: string, q = "") => e.req("GET", `/partners/${tid}/payouts/retry-plan${q}`, { token: tok });
  return { ...e, A, B, ida, idb, add, snap, att, plan };
}
const seed = async (w: Awaited<ReturnType<typeof world>>) => {
  await w.add("po_h", w.ida, "held", { reason: "ambiguous", heldAt: T0 });
  await w.add("po_r", w.ida, "approved_retry", { reason: "provider_timeout", attempts: 1 });
  await w.add("po_ok", w.ida, "paid");
  await w.add("po_b", w.idb, "held", { reason: "FOREIGN_CANARY" });
  await w.add("po_br", w.idb, "approved_retry");
};

test("auth missing or junk token = 401, nothing read", async () => {
  const w = await world(); await seed(w);
  for (const f of [w.att, w.plan]) {
    assert.equal((await f(w.ida)).status, 401);
    assert.equal((await f(w.ida, "junk_token")).status, 401);
  }
});

test("owner sees own held + approved_retry only, with the card flag and wouldCallProvider false", async () => {
  const w = await world(); await seed(w);
  const r = await w.att(w.ida, w.A.session); assert.equal(r.status, 200);
  const b: any = await r.json();
  assert.deepEqual(b.items.map((i: any) => i.payoutId).sort(), ["po_h", "po_r"]);
  assert.equal(b.tenantId, w.ida); assert.equal(b.readOnly, true); assert.equal(b.executes, false);
  assert.equal(b.wouldCallProvider, false); assert.equal(b.cardNeeded, "GATE1/GATE2");
  assert.ok(!JSON.stringify(b).includes("FOREIGN_CANARY"));
  const p: any = await (await w.plan(w.ida, w.A.session)).json();
  assert.deepEqual(p.items.map((i: any) => i.payoutId), ["po_r"]);
  assert.equal(p.items[0].wouldCallProvider, false); assert.equal(p.items[0].cardNeeded, "GATE1/GATE2");
  assert.equal(p.items[0].request.idempotencyKey, "po_r");
  assert.equal(p.wouldCallProvider, false);
});

test("held is never planned: it appears only as skipped held_never_retried", async () => {
  const w = await world(); await seed(w);
  const p: any = await (await w.plan(w.ida, w.A.session)).json();
  assert.ok(!p.items.some((i: any) => i.payoutId === "po_h"));
  assert.deepEqual(p.skipped.filter((s: any) => s.payoutId === "po_h").map((s: any) => s.reason), ["held_never_retried"]);
});

test("wrong tenant: a foreign owner gets the same 404 as a fabricated id, with an identical body, on both routes", async () => {
  const w = await world(); await seed(w);
  for (const f of [w.att, w.plan]) {
    const foreign = await f(w.idb, w.A.session), fake = await f("t_does_not_exist", w.A.session);
    assert.equal(foreign.status, 404); assert.equal(fake.status, 404);
    const fb = (await foreign.text()).replaceAll(w.idb, "X"), kb = (await fake.text()).replaceAll("t_does_not_exist", "X");
    assert.equal(fb, kb);
    assert.ok(!fb.includes("FOREIGN_CANARY"));
  }
});

test("tenant comes from the session: a query tenantId or partnerId is ignored", async () => {
  const w = await world(); await seed(w);
  for (const q of [`?tenantId=${w.idb}`, `?partnerId=${w.idb}`, `?tenant_id=${w.idb}&tenantId=${w.idb}`]) {
    for (const f of [w.att, w.plan]) {
      const b: any = await (await f(w.ida, w.A.session, q)).json();
      assert.equal(b.tenantId, w.ida, q);
      assert.ok(!JSON.stringify(b).includes("po_b"), q);
      assert.ok(!JSON.stringify(b).includes("FOREIGN_CANARY"), q);
    }
  }
});

test("a non-owner seat (viewer) is refused 403, a non-partner seat is 404", async () => {
  const w = await world(); await seed(w);
  const v = await w.login("viewer@synthetic.example.test");
  const acc = (v as any).account?.id ?? (v as any).accountId ?? (v as any).id;
  assert.ok(acc, "harness login exposes an account id");
  await w.store.putMember({ tenantId: w.ida, accountId: acc, role: "viewer", addedAt: 5 });
  for (const f of [w.att, w.plan]) assert.equal((await f(w.ida, v.session)).status, 403);
  const E = await w.provision("enterprise", "boss-e@synthetic.example.test", "SYNTHETIC enterprise", "syn-e");
  for (const f of [w.att, w.plan]) assert.equal((await f(E.tenant.id, E.session)).status, 404);
});

test("empty store: 200, zero items, zero planned", async () => {
  const w = await world();
  const a: any = await (await w.att(w.ida, w.A.session)).json(), p: any = await (await w.plan(w.ida, w.A.session)).json();
  assert.equal(a.count, 0); assert.deepEqual(a.items, []);
  assert.equal(p.plannedCount, 0); assert.deepEqual(p.items, []);
});

test("GET only: POST/PUT/PATCH/DELETE on both paths never answer 2xx and change nothing", async () => {
  const w = await world(); await seed(w);
  const before = w.snap();
  for (const path of ["attention", "retry-plan"]) for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
    const r = await w.req(m, `/partners/${w.ida}/payouts/${path}`, { token: w.A.session, body: { status: "paid" } });
    assert.ok(r.status >= 400, `${m} ${path} -> ${r.status}`);
  }
  assert.equal(w.snap(), before);
  assert.equal(w.payouts.sent.length, 0);
});

test("no writes: store snapshot equal before and after every GET, and the provider is never called", async () => {
  const w = await world(); await seed(w);
  const before = w.snap();
  for (let i = 0; i < 3; i++) for (const f of [w.att, w.plan]) { await f(w.ida, w.A.session); await f(w.idb, w.A.session); await f(w.ida); }
  assert.equal(w.snap(), before);
  assert.equal(w.payouts.sent.length, 0);
});

test("operator copy has no em or en dashes", async () => {
  const w = await world(); await seed(w);
  for (const f of [w.att, w.plan]) assert.ok(!/[–—]/.test(await (await f(w.ida, w.A.session)).text()));
  for (const file of ["../src/enterprise/payout_held_view.ts", "../src/enterprise/service.ts", "../src/enterprise/routes.ts"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8").split("\n").filter((l) => /ATTENTION_NOTE|NEXT_ACTION|held:|approved_retry:/.test(l)).join("\n");
    assert.ok(!/[–—]/.test(src), file);
  }
});
