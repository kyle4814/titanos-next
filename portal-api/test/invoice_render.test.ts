// Golden-file + property tests for src/invoice_render.ts. Synthetic data only (example.invalid). No Stripe, no clock, no I/O in the renderer.
// Regenerate goldens (review the diff!): UPDATE_GOLDEN=1 node --test --experimental-strip-types test/invoice_render.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderInvoiceDoc, gstOf, aud, type RenderInput } from "../src/invoice_render.ts";
import type { Invoice } from "../src/store.ts";

const dir = fileURLToPath(new URL("./golden/", import.meta.url));
const INV: Invoice = { id: "inv_synthetic01", accountId: "acc_synthetic01", purchaseId: "pur_synthetic01", number: "TT-000042", productId: "leads_starter", amountCents: 49700, issuedAt: Date.UTC(2026, 10, 6, 3, 4, 5), stripeEventId: "evt_synthetic01" };
const BASE: RenderInput = { invoice: INV, billedToEmail: "buyer@example.invalid", itemName: "Leads Starter (250 contacts)" };
const CN = { amountCents: 49700, issuedAt: Date.UTC(2026, 10, 9, 1, 0, 0), reason: "Refund within the terms refund window" };

function golden(name: string, got: string) {
  const p = dir + name;
  if (process.env.UPDATE_GOLDEN) { mkdirSync(dir, { recursive: true }); writeFileSync(p, got); return; }
  assert.equal(got, readFileSync(p, "utf8"), `golden mismatch: ${name}`);
}

const CASES: [string, RenderInput][] = [
  ["invoice_unregistered", BASE],
  ["invoice_registered", { ...BASE, gst: "registered" }],
  ["credit_note_unregistered", { ...BASE, creditNote: CN }],
  ["credit_note_registered_partial", { ...BASE, gst: "registered", creditNote: { ...CN, amountCents: 12345 } }],
];
for (const [name, inp] of CASES) {
  test(`golden: ${name} html and text`, () => {
    const d = renderInvoiceDoc(inp);
    golden(`${name}.html`, d.html);
    golden(`${name}.txt`, d.text);
  });
}

test("deterministic: same input twice gives identical bytes, and input is not mutated", () => {
  const before = JSON.stringify(BASE);
  const a = renderInvoiceDoc(BASE), b = renderInvoiceDoc(BASE);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(BASE), before);
});

test("default is not registered: titled INVOICE, no GST amount, says so, still carries the ABN", () => {
  const d = renderInvoiceDoc(BASE);
  assert.equal(d.title, "INVOICE"); assert.equal(d.gstCents, undefined);
  assert.doesNotMatch(d.text, /TAX INVOICE/); assert.match(d.text, /No GST charged/); assert.match(d.text, /ABN 34 318 502 254/);
  assert.match(d.text, /AU\$497\.00/);
});

test("registered: GST is one eleventh of the inclusive total, half up, titled TAX INVOICE", () => {
  const d = renderInvoiceDoc({ ...BASE, gst: "registered" });
  assert.equal(d.title, "TAX INVOICE"); assert.equal(d.gstCents, 4518); // 49700/11 = 4518.18
  assert.match(d.text, /Total includes GST of AU\$45\.18/);
  assert.equal(gstOf(11000), 1000); assert.equal(gstOf(0), 0); assert.equal(gstOf(5), 0); assert.equal(gstOf(6), 1); // 6/11 = 0.545 rounds up
  for (let c = 0; c <= 2000; c++) assert.ok(Math.abs(gstOf(c) - c / 11) <= 0.5 + 1e-9);
});

test("credit note: negative total, CN number tied to the invoice, ADJUSTMENT NOTE when registered, GST sign follows", () => {
  const u = renderInvoiceDoc({ ...BASE, creditNote: CN }), r = renderInvoiceDoc({ ...BASE, gst: "registered", creditNote: CN });
  assert.equal(u.kind, "credit_note"); assert.equal(u.number, "CN-TT-000042"); assert.equal(u.totalCents, -49700); assert.equal(u.title, "CREDIT NOTE");
  assert.match(u.text, /Against invoice: TT-000042 \(2026-11-06\)/); assert.match(u.text, /-AU\$497\.00/);
  assert.equal(r.title, "ADJUSTMENT NOTE"); assert.equal(r.gstCents, -4518); assert.match(r.text, /GST of -AU\$45\.18/);
  assert.equal(renderInvoiceDoc(BASE).totalCents + u.totalCents, 0); // invoice + full credit nets to zero
});

test("refuses bad input: fractional/negative cents, bad number, credit over the invoice, zero credit, bad dates", () => {
  const bad = (f: (x: RenderInput) => RenderInput) => assert.throws(() => renderInvoiceDoc(f(BASE)), RangeError);
  bad((x) => ({ ...x, invoice: { ...x.invoice, amountCents: 10.5 } }));
  bad((x) => ({ ...x, invoice: { ...x.invoice, amountCents: -1 } }));
  bad((x) => ({ ...x, invoice: { ...x.invoice, number: "TT-1" } }));
  bad((x) => ({ ...x, invoice: { ...x.invoice, issuedAt: NaN } }));
  bad((x) => ({ ...x, creditNote: { ...CN, amountCents: 49701 } }));
  bad((x) => ({ ...x, creditNote: { ...CN, amountCents: 0 } }));
  bad((x) => ({ ...x, creditNote: { ...CN, issuedAt: Infinity } }));
});

test("escaping: markup in email, item and reason cannot break out of the HTML; control chars cannot forge text lines", () => {
  const d = renderInvoiceDoc({ ...BASE, billedToEmail: '"><script>alert(1)</script>@example.invalid', itemName: "A & B <b>x</b>\nTotal: AU$0.00", creditNote: { ...CN, reason: "x\r\nSupplier: forged" } });
  assert.doesNotMatch(d.html, /<script/i); assert.doesNotMatch(d.html, /<b>/); assert.match(d.html, /A &amp; B &lt;b&gt;x&lt;\/b&gt;/);
  const lines = d.text.split("\n");
  assert.equal(lines.filter((l) => l.startsWith("Supplier:")).length, 1); assert.equal(lines.filter((l) => l.startsWith("Total:")).length, 0);
});

test("print-ready and self-contained: A4 @page, no script, no external resource, no em or en dash, AU English lang", () => {
  for (const [, inp] of CASES) {
    const { html, text } = renderInvoiceDoc(inp);
    assert.match(html, /@page\{size:A4/); assert.match(html, /lang="en-AU"/); assert.doesNotMatch(html, /<script|<link|<img|https?:\/\//i);
    assert.doesNotMatch(html + text, /[–—]/);
  }
});

test("money formatting: thousands separators, zero, negatives", () => {
  assert.equal(aud(599700), "AU$5,997.00"); assert.equal(aud(0), "AU$0.00"); assert.equal(aud(-4518), "-AU$45.18"); assert.equal(aud(100000000), "AU$1,000,000.00");
});

test("supplier override is honoured (ABN comes from the input, not a hidden global)", () => {
  const d = renderInvoiceDoc({ ...BASE, supplier: { name: "Test Pty Ltd", abn: "00 000 000 000", place: "Nowhere" } });
  assert.match(d.text, /Test Pty Ltd, ABN 00 000 000 000/); assert.doesNotMatch(d.text, /34 318 502 254/);
});
