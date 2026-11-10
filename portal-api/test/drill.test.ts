import { test } from "node:test";
import assert from "node:assert/strict";
import { make } from "./harness.ts";
import { FLOWS } from "../src/flows.ts";
import { PRODUCTS } from "../src/catalogue.ts";

test("flows: the registry lists exactly the 16 flows the plan names, once each, with a known owner", () => {
  assert.equal(FLOWS.length, 16);
  assert.equal(new Set(FLOWS.map((f) => f.id)).size, 16);
  const want = ["scan", "read", "signup", "verify_domain", "buy", "cancel", "refund", "hire", "get_paid", "dispute", "docs", "status", "api_keys", "invoices", "data_export", "account_deletion"];
  assert.deepEqual(FLOWS.map((f) => f.id), want);
  assert.ok(FLOWS.every((f) => f.owner !== "C2" || f.route));
});

// THE 50-RUN DRILL (kill test: 0 human touches). A scripted stranger, HTTP calls only, every run fresh.
// Customer-side steps (publish a TXT record, pay on Stripe's page) are simulated the way the real world does them.
// "Human touch" = any review card, any 4xx/5xx where a customer walked the happy path, any step needing an operator.
const SUBS = ["monitor_monthly", "monitor_annual", "ai_growth", "ai_ops", "ai_embedded", "leads_retainer"];
test("DRILL: 50 strangers complete every C2-owned self-serve flow with 0 human touches", async () => {
  const h = make();
  const products = Object.keys(PRODUCTS);
  const hits = new Map<string, number>();
  const touched: string[] = [];
  const call = async (label: string, method: string, path: string, opts: { token?: string; body?: unknown } = {}, expect = 200) => {
    const r = await h.req(method, path, opts);
    hits.set(label, (hits.get(label) ?? 0) + 1);
    if (r.status !== expect) touched.push(`${label} -> ${r.status}`);
    return r;
  };
  for (let i = 0; i < 50; i++) {
    const email = `stranger${i}@biz${i}.com.au`, domain = `biz${i}.com.au`;
    await call("signup.request", "POST", "/auth/request", { body: { email } }, 202);
    const lt = h.mailer.outbox.filter((m) => m.to === email).at(-1)!.text.match(/token=(ll_[0-9a-f]+)/)![1];
    const { session } = await h.j(await call("signup.verify", "POST", "/auth/verify", { body: { token: lt } }));
    const d = await h.j(await call("verify_domain.add", "POST", "/domains", { token: session, body: { domain } }, 201));
    h.dns.zone[d.record.name] = [d.record.value]; // the stranger publishes the TXT record
    await call("verify_domain.verify", "POST", `/domains/${d.id}/verify`, { token: session });
    // buy a rotating product, plus the compliance pack (the in-policy refund path)
    for (const pid of [products[i % products.length], "compliance_pack"]) {
      await call("buy.checkout", "POST", "/checkout", { token: session, body: { product: pid, domain } }, 201);
      await h.pay(pid);
    }
    const inv = await h.j(await call("invoices.list", "GET", "/invoices", { token: session }));
    assert.ok(inv.invoices.length >= 2);
    await call("invoices.get", "GET", `/invoices/${inv.invoices[0].id}`, { token: session });
    await call("status", "GET", "/health");
    const k = await h.j(await call("api_keys.create", "POST", "/keys", { token: session, body: { scopes: ["scan:read"] } }, 201));
    await call("api_keys.list", "GET", "/keys", { token: session });
    await call("api_keys.revoke", "DELETE", `/keys/${k.id}`, { token: session });
    const bill = await h.j(await call("billing", "GET", "/billing", { token: session }));
    for (const s of bill.subscriptions) await call("cancel", "POST", `/subscriptions/${s.id}/cancel`, { token: session });
    const comp = bill.purchases.find((p: any) => p.productId === "compliance_pack");
    h.clock.t += 3 * 86_400_000; // day 3: inside the 14-day window
    const rf = await h.j(await call("refund", "POST", "/refunds", { token: session, body: { purchaseId: comp.id } }));
    assert.equal(rf.status, "refunded", `run ${i}`);
    const ex = await h.j(await call("data_export", "GET", "/account/export", { token: session }));
    assert.equal(ex.account.email, email);
    await call("account_deletion", "DELETE", "/account", { token: session, body: { confirm: "DELETE" } });
    await call("after_delete.me", "GET", "/me", { token: session }, 401);
  }
  assert.deepEqual(touched, [], "any unexpected response is a human touch");
  assert.equal((await h.store.openCards()).length, 0, "0 review cards = 0 operator taps on the happy path");
  assert.equal(h.store.purchases.size, 100);
  assert.equal([...h.store.accounts.values()].filter((a) => a.deletedAt).length, 50);
  assert.equal(h.store.domains.size, 0);
  // every C2-owned flow was exercised in all 50 runs through its real route
  for (const label of ["signup.request", "signup.verify", "verify_domain.add", "verify_domain.verify", "buy.checkout", "invoices.list", "invoices.get", "status", "api_keys.create", "api_keys.revoke", "refund", "data_export", "account_deletion"])
    assert.equal(hits.get(label), label === "buy.checkout" ? 100 : 50, label);
  const subRuns = Array.from({ length: 50 }, (_, i) => products[i % products.length]).filter((p) => SUBS.includes(p)).length;
  assert.equal(hits.get("cancel"), subRuns, "cancel exercised on every subscription bought");
  assert.ok(SUBS.every((s) => products.includes(s)));
  console.log(`# DRILL: 50 runs, ${[...hits.values()].reduce((a, b) => a + b, 0)} HTTP calls, human touches: ${touched.length}, open cards: 0`);
});
