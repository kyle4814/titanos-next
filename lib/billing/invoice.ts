/**
 * Plan C2: Australian tax invoice + credit note renderer.
 * Pure: no clock, no network, no randomness. All money is integer cents.
 * The only side effect is the injected counter (idempotent per key).
 * NOT wired to any route; nothing is sent.
 */
import { SELLER, CURRENCY } from "./invoiceConfig.ts";

export type OrderLine = { description: string; qty: number; unitIncGstCents: number };
export type Order = { id: string; issuedAtIso: string; currency: string; lines: OrderLine[] };
export type Account = { name: string; abn?: string };
export type Refund = { id: string; issuedAtIso: string; amountIncGstCents: number; reason: string; priorRefundedIncGstCents?: number };

/** Monotonic counter. assign(kind, key) returns the SAME number for the same key and a new higher one for a new key. */
export interface InvoiceCounter { assign(kind: "INV" | "CN", key: string): number }

export type DocLine = { description: string; qty: number; unitIncGstCents: number; totalIncGstCents: number; gstCents: number; exGstCents: number };
export type InvoiceDoc = {
  title: string;
  kind: "INV" | "CN";
  number: string;
  originalNumber?: string;
  issueDate: string;
  currency: string;
  seller: { name: string; abn: string };
  buyer: { name: string; abn?: string };
  lines: DocLine[];
  reason?: string;
  subtotalExGstCents: number;
  gstCents: number;
  totalIncGstCents: number;
  note: string;
};
export type Rendered = { json: InvoiceDoc; text: string; html: string };

type Head = { issueDate: string; buyer: { name: string; abn?: string }; reason?: string };

export function memoryCounter(start = 1): InvoiceCounter {
  const seen = new Map<string, number>();
  const next: Record<string, number> = { INV: start, CN: start };
  return {
    assign(kind, key) {
      const k = kind + ":" + key;
      const have = seen.get(k);
      if (have !== undefined) return have;
      const n = next[kind]++;
      seen.set(k, n);
      return n;
    },
  };
}

/** GST content of a GST-inclusive amount: total/11 rounded half-up to whole cents (non-negative input). */
export function gstOf(totalIncCents: number): number {
  return Math.floor((2 * totalIncCents + 11) / 22);
}

/** Split the invoice GST across lines by largest remainder so the parts sum exactly. */
function allocateGst(totals: number[]): number[] {
  const target = gstOf(totals.reduce((a, b) => a + b, 0));
  const out = totals.map((t) => Math.floor(t / 11));
  const order = totals.map((t, i) => ({ i, r: t % 11 })).sort((a, b) => b.r - a.r || a.i - b.i);
  let left = target - out.reduce((a, b) => a + b, 0);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i] += 1;
  return out;
}

/** Brisbane is UTC+10 all year (no DST). */
function brisbaneDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new Error("invoice: bad issuedAtIso");
  return new Date(t + 10 * 3600_000).toISOString().slice(0, 10);
}

function pad(n: number): string { return String(n).padStart(6, "0"); }
export function fmt(cents: number): string {
  const s = cents < 0 ? "-" : "";
  const a = Math.abs(cents);
  return s + "$" + Math.floor(a / 100).toLocaleString("en-AU") + "." + String(a % 100).padStart(2, "0");
}
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function checkOrder(order: Order, account: Account): void {
  if (!order || !order.id) throw new Error("invoice: order id required");
  if (!account || !account.name || !account.name.trim()) throw new Error("invoice: buyer name required");
  if (order.currency !== CURRENCY) throw new Error("invoice: currency must be " + CURRENCY);
  if (!Array.isArray(order.lines) || order.lines.length === 0) throw new Error("invoice: at least one line");
  for (const l of order.lines) {
    if (!l.description) throw new Error("invoice: line description required");
    if (!Number.isSafeInteger(l.qty) || l.qty < 1) throw new Error("invoice: qty must be a positive integer");
    if (!Number.isSafeInteger(l.unitIncGstCents) || l.unitIncGstCents < 0) throw new Error("invoice: unit price must be non-negative integer cents");
  }
}

function build(kind: "INV" | "CN", number: string, head: Head, lines: DocLine[], originalNumber?: string): InvoiceDoc {
  const total = lines.reduce((a, l) => a + l.totalIncGstCents, 0);
  const gst = lines.reduce((a, l) => a + l.gstCents, 0);
  return {
    title: kind === "INV" ? "Tax invoice" : "Credit note",
    kind,
    number,
    ...(originalNumber ? { originalNumber } : {}),
    issueDate: head.issueDate,
    currency: CURRENCY,
    seller: { name: SELLER.name, abn: SELLER.abn },
    buyer: head.buyer,
    lines,
    ...(head.reason ? { reason: head.reason } : {}),
    subtotalExGstCents: total - gst,
    gstCents: gst,
    totalIncGstCents: total,
    note: kind === "INV"
      ? "All amounts in AUD. Total includes GST of one eleventh."
      : "Credit note (adjustment note) against tax invoice " + originalNumber + ". All amounts in AUD. Negative amounts reduce what is owed.",
  };
}

function bodies(d: InvoiceDoc): { text: string; html: string } {
  const buyer = d.buyer.name + (d.buyer.abn ? ", ABN " + d.buyer.abn : "");
  const head = [
    d.title,
    "Number: " + d.number,
    ...(d.originalNumber ? ["Original tax invoice: " + d.originalNumber] : []),
    "Issue date: " + d.issueDate,
    "Seller: " + d.seller.name + ", ABN " + d.seller.abn,
    "Buyer: " + buyer,
    "Currency: " + d.currency,
    ...(d.reason ? ["Reason: " + d.reason] : []),
    "",
  ];
  const rows = d.lines.map((l) => l.description + " | qty " + l.qty + " | " + fmt(l.unitIncGstCents) + " | total " + fmt(l.totalIncGstCents) + " | GST " + fmt(l.gstCents));
  const foot = ["", "Subtotal excluding GST: " + fmt(d.subtotalExGstCents), "GST: " + fmt(d.gstCents), "Total including GST: " + fmt(d.totalIncGstCents), "", d.note];
  const text = [...head, ...rows, ...foot].join("\n") + "\n";
  const tr = d.lines.map((l) => "<tr><td>" + esc(l.description) + "</td><td>" + l.qty + "</td><td>" + fmt(l.unitIncGstCents) + "</td><td>" + fmt(l.totalIncGstCents) + "</td><td>" + fmt(l.gstCents) + "</td></tr>").join("");
  const html = '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>' + esc(d.title) + " " + esc(d.number) + "</title></head><body>" +
    "<h1>" + esc(d.title) + "</h1><p>Number: " + esc(d.number) + "</p>" +
    (d.originalNumber ? "<p>Original tax invoice: " + esc(d.originalNumber) + "</p>" : "") +
    "<p>Issue date: " + d.issueDate + "</p><p>Seller: " + esc(d.seller.name) + ", ABN " + esc(d.seller.abn) + "</p>" +
    "<p>Buyer: " + esc(buyer) + "</p><p>Currency: " + d.currency + "</p>" +
    (d.reason ? "<p>Reason: " + esc(d.reason) + "</p>" : "") +
    "<table><thead><tr><th>Description</th><th>Qty</th><th>Unit (inc GST)</th><th>Total (inc GST)</th><th>GST</th></tr></thead><tbody>" + tr + "</tbody></table>" +
    "<p>Subtotal excluding GST: " + fmt(d.subtotalExGstCents) + "</p><p>GST: " + fmt(d.gstCents) + "</p><p>Total including GST: " + fmt(d.totalIncGstCents) + "</p><p>" + esc(d.note) + "</p></body></html>\n";
  return { text, html };
}

export function renderInvoice(order: Order, account: Account, counter: InvoiceCounter): Rendered {
  checkOrder(order, account);
  const totals = order.lines.map((l) => l.qty * l.unitIncGstCents);
  const gsts = allocateGst(totals);
  const lines: DocLine[] = order.lines.map((l, i) => ({
    description: l.description, qty: l.qty, unitIncGstCents: l.unitIncGstCents,
    totalIncGstCents: totals[i], gstCents: gsts[i], exGstCents: totals[i] - gsts[i],
  }));
  const number = "INV-" + pad(counter.assign("INV", order.id));
  const buyer = { name: account.name.trim(), ...(account.abn ? { abn: account.abn } : {}) };
  const json = build("INV", number, { issueDate: brisbaneDate(order.issuedAtIso), buyer }, lines);
  return { json, ...bodies(json) };
}

/** Refund as a separate credit note. Amounts are NEGATIVE. Cumulative refunds may never exceed the original total. */
export function renderCreditNote(order: Order, account: Account, refund: Refund, counter: InvoiceCounter): Rendered {
  const original = renderInvoice(order, account, counter);
  const prior = refund.priorRefundedIncGstCents ?? 0;
  if (!Number.isSafeInteger(refund.amountIncGstCents) || refund.amountIncGstCents < 1) throw new Error("credit note: amount must be positive integer cents");
  if (!Number.isSafeInteger(prior) || prior < 0) throw new Error("credit note: bad prior refunded amount");
  if (!refund.id) throw new Error("credit note: refund id required");
  if (prior + refund.amountIncGstCents > original.json.totalIncGstCents) throw new Error("credit note: refund exceeds original invoice total");
  const amt = refund.amountIncGstCents;
  const gst = gstOf(amt);
  const line: DocLine = { description: "Refund: " + refund.reason, qty: 1, unitIncGstCents: -amt, totalIncGstCents: -amt, gstCents: -gst, exGstCents: -(amt - gst) };
  const number = "CN-" + pad(counter.assign("CN", order.id + ":" + refund.id));
  const head: Head = { issueDate: brisbaneDate(refund.issuedAtIso), buyer: original.json.buyer, reason: refund.reason };
  const json = build("CN", number, head, [line], original.json.number);
  return { json, ...bodies(json) };
}
