// Integration guides gate (seo2 lane, 2026-11-28): the hub and five guides must each carry a unique title (<= 60 chars), a 140 to 160 character
// description, a canonical, one h1, valid Article + FAQPage + BreadcrumbList JSON-LD, the named author, the "not tested" disclaimer, at least 600 words,
// no em or en dashes, vendor source links, and the money links. Usage: node scripts/test_integrations.mjs [outDir=out]   (needs a built export)
import fs from "node:fs";
import path from "node:path";
const out = process.argv[2] || "out";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const ROUTES = ["integrations", "integrations/servicem8", "integrations/tradify", "integrations/simpro", "integrations/fergus", "integrations/jobber"];
const titles = new Set(), bodies = [];
for (const r of ROUTES) {
  const f = path.join(out, r + ".html");
  const file = fs.existsSync(f) ? f : path.join(out, r, "index.html");
  ok(fs.existsSync(file), `/${r} exported`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const desc = ((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
  ok(title.length > 0 && title.length <= 60, `/${r} title ${title.length} chars: ${title}`);
  ok(!titles.has(title), `/${r} title unique`); titles.add(title);
  ok(desc.length >= 140 && desc.length <= 160, `/${r} description ${desc.length} chars`);
  ok(html.includes(`<link rel="canonical" href="https://titanos.tech/${r}"`), `/${r} canonical`);
  ok(/<html[^>]*lang="en-AU"/.test(html), `/${r} lang en-AU`);
  ok((html.match(/<h1[ >]/g) || []).length === 1, `/${r} one h1`);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } });
  ok(ld.length >= 3 && ld.every(Boolean), `/${r} ${ld.length} JSON-LD blocks all parse`);
  const types = ld.filter(Boolean).map((d) => d["@type"]);
  for (const t of ["Article", "FAQPage", "BreadcrumbList"]) ok(types.includes(t), `/${r} JSON-LD ${t}`);
  ok(!types.includes("HowTo"), `/${r} no HowTo (steps are untested)`);
  const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  const main = text.slice(Math.max(0, text.indexOf("Last reviewed") - 200));
  const words = main.split(" ").length;
  ok(words >= 600, `/${r} ${words} words`);
  ok(/We have not tested these integrations ourselves/.test(text), `/${r} carries the not-tested disclaimer`);
  ok(/as at November 2026/.test(text), `/${r} states "as at November 2026"`);
  ok(!/we tested|we have tested it|tested and works|our testing/i.test(text.replace(/We have not tested/g, "")), `/${r} never claims testing`);
  ok(!/[–—]/.test(main), `/${r} no em or en dash in copy`);
  ok(/href="\/about"/.test(html) && /Kyle Deligny/.test(text) && /Last reviewed 28 November 2026/.test(text), `/${r} author link and reviewed date`);
  for (const l of ["/tradies", "/audit", "/shop"]) ok(html.includes(`href="${l}"`), `/${r} links ${l}`);
  ok(/href="\/products\/[a-z-]+"/.test(html), `/${r} links a product page`);
  const ext = [...html.matchAll(/href="(https:\/\/[^"]+)"[^>]*rel="noopener noreferrer"/g)].map((m) => m[1]);
  ok(ext.length >= (r === "integrations" ? 2 : 8), `/${r} ${ext.length} external source links`);
  bodies.push([r, new Set(main.toLowerCase().split(/(?<=[.!?])\s+/).filter((s) => s.length > 40))]);
}
// at least 40% of each guide's sentences differ from every sibling
for (const [r, set] of bodies) {
  if (r === "integrations") continue;
  let worst = 1;
  for (const [r2, set2] of bodies) { if (r2 === r || r2 === "integrations") continue; const same = [...set].filter((s) => set2.has(s)).length; worst = Math.min(worst, 1 - same / set.size); }
  ok(worst >= 0.4, `/${r} at least 40% of sentences differ from every sibling (worst ${(worst * 100).toFixed(0)}%)`);
}
process.exit(fail);
