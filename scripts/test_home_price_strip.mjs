// The home page carries a compact price strip: the three retainers and the Compliance Monitor, read from lib/pricing.ts, plus a link to /pricing.
import fs from "node:fs";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const read = (p) => fs.readFileSync(p, "utf8");
const { PRICING, formatAUD } = await import(new URL("../lib/pricing.ts", import.meta.url).href);
const src = read("components/home/PriceStrip.tsx");
const page = read("app/page.tsx");
for (const k of ["AI_GROWTH_PARTNER", "AI_OPS_PARTNER", "AI_EMBEDDED_PARTNER", "MONITOR_MONTHLY"]) ok(new RegExp(`PRICING\\.${k}\\b`).test(src), `strip reads ${k} from lib/pricing.ts`);
ok(!/AU\$\s*\d|\b\d{1,3},\d{3}\b/.test(src), "strip types no amount");
ok(/PRICING\.AI_RETAINER_MIN_MONTHS/.test(src), "strip states the 3-month minimum from the price file");
ok(/href="\/pricing"/.test(src) && /See all pricing/.test(src) && fs.existsSync("app/pricing/page.tsx"), "strip links to /pricing, which exists");
ok(/<PriceStrip \/>/.test(page) && page.indexOf("<PriceStrip />") > page.indexOf("<Hero />") && page.indexOf("<PriceStrip />") < page.indexOf("Find the right offer"), "strip sits high on the home page, just under the hero");
ok(PRICING.AI_GROWTH_PARTNER === 1500 && PRICING.AI_OPS_PARTNER === 2500 && PRICING.AI_EMBEDDED_PARTNER === 5000 && PRICING.MONITOR_MONTHLY === 149 && PRICING.AI_RETAINER_MIN_MONTHS === 3, "price file holds the four figures the strip shows");
// built output, when given
const bi = process.argv.indexOf("--built");
if (bi > -1) {
  const html = read((process.argv[bi + 1] || "out") + "/index.html");
  for (const k of ["AI_GROWTH_PARTNER", "AI_OPS_PARTNER", "AI_EMBEDDED_PARTNER", "MONITOR_MONTHLY"]) ok(html.includes(formatAUD(PRICING[k])), `built home page shows ${formatAUD(PRICING[k])}`);
  ok(/data-price-strip/.test(html) && /href="\/pricing"[^>]*>See all pricing/.test(html), "built home page has the strip and the See all pricing link");
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
