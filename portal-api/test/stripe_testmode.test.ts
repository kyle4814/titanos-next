import { test } from "node:test";
import assert from "node:assert/strict";
import { readTestKey, KeyRefused, runHarness, main } from "../scripts/stripe_testmode.ts";
import { FakeStripe } from "../scripts/stripe_fake.ts";
import { PRODUCTS } from "../src/catalogue.ts";

const KEY = "sk_test_FIXTUREabcdefgh12345678";
test("key reader: accepts sk_test_, refuses live, restricted, publishable, junk; never leaks the value", () => {
  assert.equal(readTestKey({ STRIPE_TEST_SECRET: KEY }, ""), KEY);
  assert.equal(readTestKey({}, `# x\nexport STRIPE_TEST_SECRET="${KEY}"\n`), KEY);
  assert.equal(readTestKey({}, "STRIPE_RESTRICTED_KEY=rk_live_abcdefghijkl\n"), undefined);   // other names are never read
  for (const bad of ["sk_live_abcdefghijkl1234", "rk_test_abcdefghijkl1234", "pk_test_abcdefghijkl1234", "sk_test_", "whsec_abcdefgh1234", " "]) {
    if (bad.trim() === "") continue;
    try { readTestKey({ STRIPE_TEST_SECRET: bad }, ""); assert.fail("accepted " + bad); }
    catch (e) { assert.ok(e instanceof KeyRefused); if (bad.length > 12) assert.ok(!(e as Error).message.includes(bad), "message leaked the key"); }
  }
});

test("harness (FakeStripe): the whole flow passes, prices equal the portal catalogue, ids recorded", async () => {
  const fake = new FakeStripe();
  const r = await runHarness({ key: KEY, fetchFn: fake.fetch as typeof fetch, fixture: true, runId: "t1" });
  assert.deepEqual(r.failures, []);
  assert.equal(r.pass, true);
  for (const p of Object.values(PRODUCTS)) {
    assert.match(r.ids[p.id].price, /^price_/);
    const pr = fake.calls.find((c) => c.path === "prices" && c.form["metadata[catalogue_id]"] === p.id)!;
    assert.equal(Number(pr.form.unit_amount), p.amountCents);
    assert.equal(pr.form.currency, "aud");
    assert.equal(!!pr.form["recurring[interval]"], p.mode === "subscription");
  }
  // the portal drove the real adapter: sessions, one refund (compliance only), two period-end cancels
  assert.equal(fake.calls.filter((c) => c.path === "checkout/sessions").length, Object.keys(PRODUCTS).length);
  assert.equal(fake.calls.filter((c) => c.path === "refunds").length, 1);
  assert.equal(fake.calls.filter((c) => /^subscriptions\/sub_/.test(c.path) && c.form.cancel_at_period_end === "true").length, 2);
  assert.ok(fake.calls.every((c) => !JSON.stringify(c).includes("sk_live_")));
});

test("harness: idempotency keys make a rerun with the same run id reuse the same Stripe objects", async () => {
  const fake = new FakeStripe();
  const a = await runHarness({ key: KEY, fetchFn: fake.fetch as typeof fetch, fixture: true, runId: "same" });
  const b = await runHarness({ key: KEY, fetchFn: fake.fetch as typeof fetch, fixture: true, runId: "same" });
  assert.equal(a.ids.monitor_monthly.price, b.ids.monitor_monthly.price);
});

test("FakeStripe: rejects a live key and any non-stripe origin", async () => {
  const fake = new FakeStripe();
  const r = await fake.fetch("https://api.stripe.com/v1/products", { method: "POST", headers: { authorization: "Bearer sk_live_nope" }, body: "name=x" });
  assert.equal(r.status, 401);
  await assert.rejects(() => fake.fetch("https://evil.example/v1/products", { method: "POST" }), /blocked_origin/);
});

test("mutation: a price drift between harness and catalogue is caught (unit_amount mismatch fails the step)", async () => {
  const fake = new FakeStripe();
  const orig = fake.fetch;
  fake.fetch = async (u: any, i?: RequestInit) => {
    if (String(u).endsWith("/prices")) i = { ...i, body: String(i?.body).replace(/unit_amount=\d+/, "unit_amount=1") };
    return orig(u, i);
  };
  const r = await runHarness({ key: KEY, fetchFn: fake.fetch as typeof fetch, fixture: true, runId: "mut" });
  assert.equal(r.pass, false);
  assert.ok(r.failures.some((f) => f.startsWith("stripe.product_price")));
});

test("main(): no key => FIXTURE run, exit 0, CARD NEEDED printed; bad key => exit 2 and nothing run", async () => {
  const saved = { ...process.env }; const log = console.log; const err = console.error; let out = "";
  console.log = (...a: unknown[]) => { out += a.join(" ") + "\n"; }; console.error = (...a: unknown[]) => { out += a.join(" ") + "\n"; };
  try {
    delete process.env.STRIPE_TEST_SECRET; process.env.HOME = "/nonexistent-x2";
    assert.equal(await main(["--out", "/tmp/x2_stripe_main_test/out.json"]), 0);
    assert.match(out, /FIXTURE \(FakeStripe, no network\)/); assert.match(out, /CARD NEEDED: add a Stripe test-mode secret/);
    out = ""; process.env.STRIPE_TEST_SECRET = "sk_live_" + "x".repeat(24);
    assert.equal(await main(["--out", "/tmp/x2_stripe_main_test/out2.json"]), 2);
    assert.match(out, /REFUSED/); assert.ok(!out.includes("xxxxxxxx"));
  } finally { console.log = log; console.error = err; process.env = saved as any; }
});
