// f285: GET /invoices/:id and the refund credit note go through the f281 renderer. Synthetic data only (example.invalid style accounts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { make, T0 } from "./harness.ts";
import { INVOICE_GST_MODE } from "../src/service.ts";

const DAY = 86_400_000;
async function setup() {
  const h = make();
  const a = await h.login("a@acme.com.au"), b = await h.login("b@other.com.au");
  await h.verifiedDomain(a.session, "acme.com.au");
  await h.req("POST", "/checkout", { token: a.session, body: { product: "compliance_pack", domain: "acme.com.au" } });
  const { purchase } = await h.pay("compliance_pack");
  const id = (await h.j(await h.req("GET", "/invoices", { token: a.session }))).invoices[0].id as string;
  return { h, a, b, id, purchase };
}

test("config: GST mode is the one constant and defaults to not registered", () => { assert.equal(INVOICE_GST_MODE, "not_registered"); });

test("invoice text is the default; says INVOICE, never TAX INVOICE, carries email, item, ABN, no GST", async () => {
  const { h, a, id } = await setup();
  const r = await h.req("GET", `/invoices/${id}`, { token: a.session });
  assert.equal(r.status, 200); assert.match(r.headers.get("content-type")!, /^text\/plain/);
  const t = await r.text();
  assert.match(t, /^INVOICE TT-000001/); assert.doesNotMatch(t, /TAX INVOICE/);
  assert.match(t, /a@acme\.com\.au/); assert.match(t, /AU\$5,997\.00/); assert.match(t, /ABN 34 318 502 254/); assert.match(t, /No GST charged/);
});

test("Accept text/html returns the print-ready HTML", async () => {
  const { h, a, id } = await setup();
  const r = await h.req("GET", `/invoices/${id}`, { token: a.session, headers: { accept: "text/html,application/xhtml+xml" } });
  assert.match(r.headers.get("content-type")!, /^text\/html/);
  const t = await r.text();
  assert.match(t, /<!doctype html>/); assert.match(t, /@page/); assert.match(t, /<h1>INVOICE<\/h1>/);
});

test("unknown id is 404; another account's id is 404, not 403", async () => {
  const { h, a, b, id } = await setup();
  assert.equal((await h.req("GET", "/invoices/inv_nope", { token: a.session })).status, 404);
  const x = await h.req("GET", `/invoices/${id}`, { token: b.session });
  assert.equal(x.status, 404);
  assert.equal((await h.req("GET", `/invoices/${id}/credit-note`, { token: b.session })).status, 404);
  assert.equal((await h.req("GET", `/invoices/${id}`, {})).status, 401);
});

test("no refund means no credit note (404)", async () => {
  const { h, a, id } = await setup();
  assert.equal((await h.req("GET", `/invoices/${id}/credit-note`, { token: a.session })).status, 404);
});

test("refund records refundedAt and produces a credit note with refundedCents and refundedAt", async () => {
  const { h, a, b, id, purchase } = await setup();
  assert.equal(h.store.purchases.get(purchase.id)!.refundedAt, undefined);
  h.clock.t += 3 * DAY;
  const at = h.clock.t;
  const r = await h.j(await h.req("POST", "/refunds", { token: a.session, body: { purchaseId: purchase.id } }));
  assert.equal(r.status, "refunded");
  assert.equal(h.store.purchases.get(purchase.id)!.refundedAt, at);
  const t = await (await h.req("GET", `/invoices/${id}/credit-note`, { token: a.session })).text();
  assert.match(t, /^CREDIT NOTE CN-TT-000001/); assert.match(t, /-AU\$5,997\.00/); assert.match(t, new RegExp(`Date: ${new Date(at).toISOString().slice(0, 10)}`));
  assert.match(t, /Against invoice: TT-000001/); assert.doesNotMatch(t, /TAX INVOICE/);
  const html = await h.req("GET", `/invoices/${id}/credit-note`, { token: a.session, headers: { accept: "text/html" } });
  assert.match(html.headers.get("content-type")!, /^text\/html/); assert.match(await html.text(), /<h1>CREDIT NOTE<\/h1>/);
  assert.equal((await h.req("GET", `/invoices/${id}/credit-note`, { token: b.session })).status, 404);
  assert.equal(T0 < at, true);
});
