import { runScan } from "../../../lib/guestscan/scan.ts";
import { fakeDoh } from "../../../lib/guestscan/fixtures.ts";
import { healthy } from "../../test/owner_harness.ts";
const D = "acme.example.com.au";
async function t(label: string, mut: (w: any) => void, input = D) { const w = healthy(D); mut(w); const f = fakeDoh(w); const r: any = await runScan(input, f.fetch); console.log(label.padEnd(44), "grade", r.grade, "|", r.findings.map((x: any) => x.check + ":" + x.status).join(" "), "| modelCalls", r.modelCalls); }
await t("healthy", () => {});
await t("spf redirect (valid, no all)", (w) => { w.txt[D] = ["v=spf1 redirect=_spf.big.example.com"]; });
await t("spf 12 includes (lookup limit>10)", (w) => { w.txt[D] = ["v=spf1 " + Array.from({ length: 12 }, (_, i) => `include:i${i}.example.com`).join(" ") + " -all"]; });
await t("spf ptr mechanism", (w) => { w.txt[D] = ["v=spf1 ptr -all"]; });
await t("spf junk token", (w) => { w.txt[D] = ["v=spf1 bogus:thing -all"]; });
await t("dmarc pct=0 reject", (w) => { w.txt[`_dmarc.${D}`] = ["v=DMARC1; p=reject; pct=0"]; });
await t("dmarc missing p", (w) => { w.txt[`_dmarc.${D}`] = ["v=DMARC1; rua=mailto:a@b.c"]; });
await t("dmarc p=reject no rua", (w) => { w.txt[`_dmarc.${D}`] = ["v=DMARC1; p=reject"]; });
await t("spf in lookalike v=spf10", (w) => { w.txt[D] = ["v=spf10 -all"]; });
await t("all servfail", (w) => { w.servfail = [D, `_dmarc.${D}`]; });
await t("nxdomain", (w) => { w.nxdomain = true; });
for (const inp of ["HTTP://Acme.Example.com.au/path?x=1", "  acme.example.com.au.  ", "user@acme.example.com.au", "localhost", "127.0.0.1", "a..b.com", "-bad.com", "bad_name.com", "x".repeat(64) + ".com", "", "https://", "acme.example.com.au:8080", "xn--80ak6aa92e.com", "münchen.de"]) {
  try { const w = healthy(D); const f = fakeDoh(w); const r: any = await runScan(inp, f.fetch); console.log("input", JSON.stringify(inp).slice(0, 40).padEnd(44), "->", r.domain ?? r.error ?? JSON.stringify(r).slice(0, 80), "grade", r.grade, "calls", f.calls.length); } catch (e: any) { console.log("input", JSON.stringify(inp).slice(0, 40).padEnd(44), "THROWS", e.message); }
}
