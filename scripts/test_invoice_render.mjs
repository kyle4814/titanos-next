// Plan C2 backfill: tax invoice + credit note renderer. SYNTHETIC DATA ONLY. Run via `npm test`.
// Checks: reconcile to the cent over 200 generated orders, GST >= 0, credit <= original,
// byte-identical re-render, and 6 mutants (source rewrites) that the same checks must catch.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(HERE, "..", "lib", "billing");

// deterministic PRNG (mulberry32): no clock, no Math.random
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const genOrders = (n) => {
  const r = rng(20261107);
  return Array.from({ length: n }, (_, k) => ({
    id: "SYN-" + k,
    issuedAtIso: new Date(Date.UTC(2026, 10, 1 + (k % 28), k % 24, 0, 0)).toISOString(),
    currency: "AUD",
    lines: Array.from({ length: 1 + Math.floor(r() * 5) }, (_, j) => ({
      description: "Synthetic item " + j, qty: 1 + Math.floor(r() * 4), unitIncGstCents: Math.floor(r() * 500000) + (k % 7 === 0 ? 1 : 0),
    })),
  }));
};
const ACCOUNT = { name: "Synthetic Buyer Pty Ltd" };
const validAbn = (abn) => { const d = abn.replace(/\s/g, ""); if (!/^\d{11}$/.test(d)) return false; const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]; const x = d.split("").map(Number); x[0] -= 1; return x.reduce((a, v, i) => a + v * w[i], 0) % 89 === 0; };

// returns a list of failure strings for the module at `dir`
async function suite(dir) {
  const bad = [];
  const chk = (c, m) => { if (!c) bad.push(m); };
  const inv = await import(pathToFileURL(path.join(dir, "invoice.ts")).href + "?v=" + Math.random());
  const cfg = await import(pathToFileURL(path.join(dir, "invoiceConfig.ts")).href + "?v=" + Math.random());
  const counter = inv.memoryCounter();
  const orders = genOrders(200);
  const nums = new Set();
  let docs = 0;
  for (const o of orders) {
    let r;
    try { r = inv.renderInvoice(o, ACCOUNT, counter); } catch (e) { bad.push("render threw " + o.id + ": " + e.message); continue; }
    docs++;
    const j = r.json;
    const total = o.lines.reduce((a, l) => a + l.qty * l.unitIncGstCents, 0);
    const wantGst = Math.round(total / 11); // oracle: t/11 never lands on .5
    chk(j.totalIncGstCents === total, o.id + " total");
    chk(j.gstCents === wantGst, o.id + " gst " + j.gstCents + " want " + wantGst);
    chk(j.gstCents >= 0, o.id + " gst negative");
    chk(j.lines.reduce((a, l) => a + l.gstCents, 0) === j.gstCents, o.id + " line gst sum");
    chk(j.lines.reduce((a, l) => a + l.totalIncGstCents, 0) === j.totalIncGstCents, o.id + " line total sum");
    chk(j.lines.every((l) => l.exGstCents + l.gstCents === l.totalIncGstCents && l.gstCents >= 0), o.id + " line ex+gst");
    chk(j.subtotalExGstCents + j.gstCents === j.totalIncGstCents, o.id + " ex+gst=inc");
    chk(j.title === "Tax invoice" && r.text.startsWith("Tax invoice"), o.id + " title");
    chk(j.seller.abn === "34 318 502 254" && r.text.includes("ABN 34 318 502 254") && r.html.includes("ABN 34 318 502 254"), o.id + " seller ABN missing");
    chk(j.currency === "AUD" && r.text.includes("Currency: AUD") && r.html.includes("Currency: AUD"), o.id + " currency");
    chk(j.buyer.name === ACCOUNT.name && r.text.includes(ACCOUNT.name), o.id + " buyer");
    chk(/^\d{4}-\d{2}-\d{2}$/.test(j.issueDate), o.id + " date");
    chk(!nums.has(j.number), o.id + " invoice number reused " + j.number);
    nums.add(j.number);
    const again = inv.renderInvoice(o, ACCOUNT, counter);
    chk(again.text === r.text && again.html === r.html && JSON.stringify(again.json) === JSON.stringify(r.json), o.id + " not byte-identical on re-render");
    // credit note: refund half (>=1 when total>=1), then try to exceed
    if (total >= 2) {
      const amt = Math.floor(total / 2);
      const cn = inv.renderCreditNote(o, ACCOUNT, { id: "R1", issuedAtIso: o.issuedAtIso, amountIncGstCents: amt, reason: "Synthetic refund" }, counter);
      const c = cn.json;
      chk(c.title === "Credit note" && c.originalNumber === j.number && cn.text.includes(j.number), o.id + " cn ref");
      chk(c.number !== j.number && c.number.startsWith("CN-"), o.id + " cn number");
      chk(c.totalIncGstCents === -amt, o.id + " cn sign/total " + c.totalIncGstCents);
      chk(c.gstCents === -Math.round(amt / 11) && c.gstCents <= 0, o.id + " cn gst");
      chk(c.lines.reduce((a, l) => a + l.totalIncGstCents, 0) === c.totalIncGstCents, o.id + " cn reconcile");
      chk(c.subtotalExGstCents + c.gstCents === c.totalIncGstCents, o.id + " cn ex+gst");
      chk(Math.abs(c.totalIncGstCents) <= j.totalIncGstCents, o.id + " cn exceeds original");
      chk(c.seller.abn === "34 318 502 254" && c.currency === "AUD", o.id + " cn abn/currency");
      let threw = false;
      try { inv.renderCreditNote(o, ACCOUNT, { id: "R2", issuedAtIso: o.issuedAtIso, amountIncGstCents: total - amt + 1, reason: "x", priorRefundedIncGstCents: amt }, counter); } catch { threw = true; }
      chk(threw, o.id + " cn over-refund not rejected");
      const cn2 = inv.renderCreditNote(o, ACCOUNT, { id: "R1", issuedAtIso: o.issuedAtIso, amountIncGstCents: amt, reason: "Synthetic refund" }, counter);
      chk(cn2.text === cn.text && cn2.html === cn.html, o.id + " cn not byte-identical");
      docs++;
    }
  }
  chk(cfg.SELLER.abn === "34 318 502 254" && validAbn(cfg.SELLER.abn), "config ABN fails checksum or value");
  for (const [m, o] of [["bad currency", { ...orders[0], currency: "USD" }], ["no lines", { ...orders[0], lines: [] }], ["bad qty", { ...orders[0], lines: [{ description: "x", qty: 0, unitIncGstCents: 1 }] }], ["fractional cents", { ...orders[0], lines: [{ description: "x", qty: 1, unitIncGstCents: 1.5 }] }]]) {
    let threw = false; try { inv.renderInvoice(o, ACCOUNT, inv.memoryCounter()); } catch { threw = true; }
    chk(threw, "should reject " + m);
  }
  let threw = false; try { inv.renderInvoice(orders[0], { name: " " }, inv.memoryCounter()); } catch { threw = true; }
  chk(threw, "should reject blank buyer");
  chk(inv.renderInvoice({ ...orders[0], lines: [{ description: "<b>&", qty: 1, unitIncGstCents: 1100 }] }, ACCOUNT, inv.memoryCounter()).html.includes("&lt;b&gt;&amp;"), "html escape");
  return { bad, docs };
}

let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };

const base = await suite(LIB);
ok(base.bad.length === 0, "real module passes every check over 200 generated orders (" + base.docs + " documents rendered)" + (base.bad.length ? ": " + base.bad.slice(0, 5).join("; ") : ""));

const SRC = fs.readFileSync(path.join(LIB, "invoice.ts"), "utf8");
const CFG = fs.readFileSync(path.join(LIB, "invoiceConfig.ts"), "utf8");
const MUTANTS = [
  ["wrong GST divisor", "invoice.ts", "Math.floor((2 * totalIncCents + 11) / 22)", "Math.floor((2 * totalIncCents + 10) / 20)"],
  ["rounding (truncate not round)", "invoice.ts", "Math.floor((2 * totalIncCents + 11) / 22)", "Math.floor(totalIncCents / 11)"],
  ["missing ABN", "invoiceConfig.ts", 'abn: "34 318 502 254"', 'abn: ""'],
  ["wrong sign on credit note", "invoice.ts", "totalIncGstCents: -amt, gstCents: -gst", "totalIncGstCents: amt, gstCents: gst"],
  ["number reuse", "invoice.ts", "const n = next[kind]++;", "const n = next[kind];"],
  ["currency drop", "invoice.ts", "currency: CURRENCY,", ""],
];
let caught = 0;
for (const [name, file, from, to] of MUTANTS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inv-mut-"));
  if (!dir.startsWith(os.tmpdir())) throw new Error("bad tmp");
  const s = file === "invoice.ts" ? SRC : CFG;
  if (!s.includes(from)) { ok(false, "mutant anchor missing: " + name); continue; }
  fs.writeFileSync(path.join(dir, "invoice.ts"), file === "invoice.ts" ? SRC.replace(from, to) : SRC);
  fs.writeFileSync(path.join(dir, "invoiceConfig.ts"), file === "invoiceConfig.ts" ? CFG.replace(from, to) : CFG);
  let res;
  try { res = await suite(dir); } catch (e) { res = { bad: ["threw " + e.message] }; }
  const c = res.bad.length > 0;
  if (c) caught++;
  ok(c, "mutant caught: " + name + " (" + res.bad.length + " failing checks)");
  fs.rmSync(path.join(dir, "invoice.ts")); fs.rmSync(path.join(dir, "invoiceConfig.ts")); fs.rmdirSync(dir);
}
ok(caught === 6, "6 of 6 mutants caught (" + caught + ")");
console.log("CASES orders=200 documents=" + base.docs + " mutants=" + caught + "/6");
process.exit(fail ? 1 : 0);
