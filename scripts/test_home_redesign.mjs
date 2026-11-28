// Homepage redesign gate (2026-11-28): the built / must carry the sourced metrics, none of the unsourced reference placeholders, the concept-image
// disclosure, real proof files with their real byte sizes, one h1, year 2026, and every internal link must resolve in the export.
// Usage: node scripts/test_home_redesign.mjs [outDir=out]   (needs a built export)
import fs from "node:fs";
import path from "node:path";
const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const html = fs.readFileSync(`${out}/index.html`, "utf8");
const body = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
const text = body.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
ok((html.match(/<h1[ >]/g) || []).length === 1, "exactly one h1");
ok(/Economy is <em>Live<\/em>/i.test(html), "h1 carries the gold LIVE");
for (const bad of ["1,240,000", "98.7%", "36,000+", "72%", "4.8x", "-86%", "Trusted by", "4.2 MB", "2.9 MB", "7.6 MB", "72% Higher Margin"]) ok(!text.includes(bad), `no unsourced placeholder "${bad}"`);
for (const good of ["3,543", "652 / 666", "256,217", "8.4x", "Illustrative render", "not a real TITANOS office", "Built for operators who want receipts", "© 2026 TITANOS"]) ok(text.includes(good) || text.includes(good.replace("©", "©")), `page carries "${good}"`);
ok(!/[–—]/.test(text.slice(text.indexOf("The Proof"), text.indexOf("Everything else is one tap away"))), "no em or en dash in the redesigned sections");
// real proof files and real sizes
for (const [f, label] of [["declaration/TITANOS_Declaration_2026-11.pdf", "Declaration"], ["sample-evidence-pack-excerpt.pdf", "evidence pack"], ["proof/trading-app-build-replay.log", "replay log"]]) {
  const p = path.join(out, f);
  ok(fs.existsSync(p), `${label} file exported`);
  const b = fs.statSync(p).size;
  const shown = b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  ok(text.includes(shown), `${label} size ${shown} matches the file on disk`);
}
// every internal link resolves
const hrefs = [...new Set([...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]))].filter((h) => !h.startsWith("/_next"));
let broken = [];
for (const h of hrefs) {
  const c = [h, h + ".html", path.join(h, "index.html")].map((x) => path.join(out, x));
  if (!c.some((x) => fs.existsSync(x) && fs.statSync(x).isFile())) broken.push(h);
}
ok(broken.length === 0, `${hrefs.length} internal links resolve${broken.length ? " BROKEN: " + broken.join(", ") : ""}`);
// image derivatives referenced exist
const imgs = [...new Set([...html.matchAll(/\/site-redesign\/[A-Za-z0-9._-]+\.(?:avif|webp|png)/g)].map((m) => m[0]))];
ok(imgs.length >= 5 && imgs.every((i) => fs.existsSync(path.join(out, i))), `${imgs.length} redesign images referenced and exported`);
ok(/fetchPriority="high"|fetchpriority="high"/i.test(html), "hero image is fetchpriority high");
process.exit(fail);
