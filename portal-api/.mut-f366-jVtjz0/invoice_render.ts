// C2 invoice document renderer. PURE and DETERMINISTIC: same input, same bytes. No clock, no I/O, no Stripe, no PDF engine.
// Input is the stored Invoice record (store.ts, f192/f215 shape) plus facts the caller looks up. Output is print-ready HTML
// (A4 @page, no scripts, no external assets) and a plain-text twin. A credit note variant covers refunds.
// GST: the terms page (app/terms/page.tsx) says the seller is NOT registered for GST, so the default mode is "not_registered":
// the document is titled INVOICE (not TAX INVOICE), shows no GST line and says so. "registered" is built for the day that
// changes: prices are GST-inclusive, GST = total / 11 rounded half up, document titled TAX INVOICE / ADJUSTMENT NOTE.
import type { Invoice } from "./store.ts";

export type GstMode = "not_registered" | "registered";
export interface Supplier { name: string; abn: string; place: string }
// CORE ID2: sole trader, ABN 34 318 502 254, Brisbane QLD.
export const SUPPLIER: Supplier = { name: "Kyle Montrose Deligny", abn: "34 318 502 254", place: "Brisbane QLD" };
export interface CreditNote { amountCents: number; issuedAt: number; reason: string }
export interface RenderInput { invoice: Invoice; billedToEmail: string; itemName: string; gst?: GstMode; supplier?: Supplier; creditNote?: CreditNote }
export interface RenderedDoc { kind: "invoice" | "credit_note"; number: string; title: string; totalCents: number; gstCents: number | undefined; html: string; text: string }

export const aud = (c: number): string => `${c < 0 ? "-" : ""}AU$${(Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
// GST-inclusive total -> GST component, half up, integer maths only.
export const gstOf = (totalCents: number): number => Math.floor((totalCents + 5) / 11);
const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
export const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// Never lets a multi-line or control-char value forge extra lines in the text twin.
const oneLine = (s: string): string => s.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();

function check(inp: RenderInput): void {
  const { invoice: i, creditNote: c } = inp;
  if (!Number.isInteger(i.amountCents) || i.amountCents < 0) throw new RangeError("invoice amountCents must be a non-negative integer");
  if (!Number.isFinite(i.issuedAt)) throw new RangeError("invoice issuedAt must be a finite ms timestamp");
  if (!/^TT-\d{6,}$/.test(i.number)) throw new RangeError("invoice number must look like TT-000001");
  if (c) {
    if (!Number.isInteger(c.amountCents) || c.amountCents <= 0) throw new RangeError("credit note amountCents must be a positive integer");
    if (c.amountCents > i.amountCents) throw new RangeError("credit note exceeds the invoice amount");
    if (!Number.isFinite(c.issuedAt)) throw new RangeError("credit note issuedAt must be a finite ms timestamp");
  }
}

export function renderInvoiceDoc(inp: RenderInput): RenderedDoc {
  check(inp);
  const gst = inp.gst ?? "not_registered", sup = inp.supplier ?? SUPPLIER, i = inp.invoice, cn = inp.creditNote;
  const isCn = !!cn, sign = isCn ? -1 : 1;
  const total = sign * (cn ? cn.amountCents : i.amountCents);
  const number = isCn ? `CN-${i.number}` : i.number;
  const date = ymd(isCn ? cn!.issuedAt : i.issuedAt);
  const reg = gst === "registered";
  const title = isCn ? (reg ? "ADJUSTMENT NOTE" : "CREDIT NOTE") : (reg ? "TAX INVOICE" : "INVOICE");
  const gstCents = reg ? sign * gstOf(Math.abs(total)) : undefined;
  const gstLine = reg ? `Total includes GST of ${aud(gstCents!)}` : "No GST charged: the supplier is not registered for GST";
  const rows: [string, string][] = [
    [isCn ? "Credit note number" : "Invoice number", number], ["Date", date],
    ...(isCn ? ([["Against invoice", `${i.number} (${ymd(i.issuedAt)})`], ["Reason", oneLine(cn!.reason)]] as [string, string][]) : []),
    ["Supplier", `${sup.name}, ABN ${sup.abn}, ${sup.place}`], ["Billed to", oneLine(inp.billedToEmail)],
  ];
  const item = oneLine(inp.itemName);
  const amountLabel = isCn ? "Amount credited" : "Amount";
  const refundNote = isCn ? " This amount is refunded to the original payment method." : "";
  const text = [`${title} ${number}`, ...rows.map(([k, v]) => `${k}: ${v}`), `Item: ${item}`, `${amountLabel}: ${aud(total)} (AUD)`, `${gstLine}.${refundNote}`, ""].join("\n");
  const html = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><title>${esc(title)} ${esc(number)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@page{size:A4;margin:18mm}body{font:11pt/1.5 Helvetica,Arial,sans-serif;color:#111;background:#fff;max-width:170mm;margin:0 auto}
h1{font-size:20pt;margin:0 0 4mm}table{border-collapse:collapse;width:100%;margin:4mm 0}th,td{text-align:left;padding:2mm 3mm;border-bottom:1px solid #999;vertical-align:top}
th{width:38%;font-weight:600}.num{text-align:right;white-space:nowrap}.total td{font-weight:700;border-top:2px solid #111}.note{font-size:9.5pt;color:#333}</style></head>
<body><h1>${esc(title)}</h1>
<table>
${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("\n")}
</table>
<table>
<tr><th scope="col">Item</th><th scope="col" class="num">${esc(amountLabel)}</th></tr>
<tr><td>${esc(item)}</td><td class="num">${esc(aud(total))}</td></tr>
<tr class="total"><td>Total (AUD)</td><td class="num">${esc(aud(total))}</td></tr>
</table>
<p class="note">${esc(gstLine)}.${esc(refundNote)}</p>
</body></html>
`;
  return { kind: isCn ? "credit_note" : "invoice", number, title, totalCents: total, gstCents, html, text };
}
