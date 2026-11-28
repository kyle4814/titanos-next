// AI-search entity lane tests: glossary content, author page, llms.txt / llms-full.txt, IndexNow key.
// Source checks always run. With `--built out` (and out/ present) the built HTML is checked too:
// title <= 60, description 140 to 160, canonical, valid JSON-LD, one H1.
// Run: node --experimental-strip-types --no-warnings scripts/test_ai_search_entity.mjs [--built out]
import fs from "node:fs";
import path from "node:path";
import { GLOSSARY } from "../lib/glossary.ts";

let fail = 0;
const ok = (c, m) => { if (!c) { fail += 1; console.error("FAIL", m); } else console.log("ok  ", m); };
const words = (t) => t.trim().split(/\s+/).length;

// ---- glossary
ok(GLOSSARY.length >= 25 && GLOSSARY.length <= 40, `glossary has ${GLOSSARY.length} entries (25 to 40)`);
const ids = new Set(GLOSSARY.map((e) => e.id));
ok(ids.size === GLOSSARY.length, "glossary ids are unique");
for (const e of GLOSSARY) {
  const w = words(e.definition);
  ok(w >= 80 && w <= 200, `${e.id}: ${w} words (80 to 200)`);
  ok(/^https:\/\//.test(e.source.url), `${e.id}: https source`);
  ok(!/[–—]/.test(e.definition + e.term), `${e.id}: no em or en dash`);
  if (e.related?.href.startsWith("/glossary#")) ok(ids.has(e.related.href.split("#")[1]), `${e.id}: related anchor exists`);
}

// ---- sources: titles and descriptions in the page files
function meta(file) {
  const t = fs.readFileSync(file, "utf8");
  const title = t.match(/title:\s*\n?\s*"([^"]+)"/)?.[1];
  const desc = t.match(/description:\s*\n?\s*"([^"]+)"/)?.[1];
  return { t, title, desc };
}
for (const [f, route] of [["app/glossary/page.tsx", "/glossary"], ["app/authors/kyle-deligny/page.tsx", "/authors/kyle-deligny"]]) {
  const { t, title, desc } = meta(f);
  ok(title && title.length <= 60, `${route} title ${title?.length} <= 60`);
  ok(desc && desc.length >= 140 && desc.length <= 160, `${route} description ${desc?.length} in 140..160`);
  ok(t.includes(`withSeo("${route}"`), `${route} uses withSeo (canonical)`);
  ok(t.includes("<JsonLd"), `${route} emits JSON-LD`);
}

// ---- IndexNow key
const keyFiles = fs.readdirSync("public").filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
ok(keyFiles.length === 1 && fs.readFileSync(path.join("public", keyFiles[0]), "utf8").trim() === keyFiles[0].replace(".txt", ""), "exactly one IndexNow key file, content equals name");
ok(fs.existsSync("app/llms-full.txt/route.ts"), "llms-full.txt route exists");

// ---- built output
const i = process.argv.indexOf("--built");
const out = i >= 0 ? process.argv[i + 1] : null;
if (out && fs.existsSync(out)) {
  const read = (p) => fs.readFileSync(path.join(out, p), "utf8");
  for (const [p, route] of [["glossary.html", "/glossary"], ["authors/kyle-deligny.html", "/authors/kyle-deligny"]]) {
    const h = read(p);
    const title = h.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const desc = h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";
    ok(title.length > 0 && title.length <= 60, `built ${route} title "${title}" (${title.length})`);
    ok(desc.length >= 140 && desc.length <= 160, `built ${route} description ${desc.length}`);
    ok(h.includes(`rel="canonical" href="https://titanos.tech${route}"`), `built ${route} canonical`);
    ok((h.match(/<h1[ >]/g) || []).length === 1, `built ${route} has one h1`);
    const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    let parsed = 0;
    for (const b of blocks) { try { JSON.parse(b); parsed += 1; } catch { /* counted below */ } }
    ok(blocks.length >= 2 && parsed === blocks.length, `built ${route} JSON-LD blocks all parse (${parsed}/${blocks.length}, plus site-wide)`);
    const body = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ");
    ok(words(body) >= 600, `built ${route} has ${words(body)} words (>= 600)`);
  }
  const g = read("glossary.html");
  const set = [...g.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((j) => j["@type"] === "DefinedTermSet");
  ok(set && set.hasDefinedTerm.length === GLOSSARY.length, "built glossary DefinedTermSet carries every entry");
  const a = read("authors/kyle-deligny.html");
  ok(/"@type":"Person"/.test(a) && /"founder":\{"@id":"https:\/\/titanos.tech\/authors\/kyle-deligny#person"\}/.test(a), "built author page has Person linked to the Organization");
  ok(!/prison|had a stroke|JobSeeker|akathisia|street address/i.test(a), "author page leaks no private history");
  for (const f of ["llms.txt", "llms-full.txt"]) ok(read(f).includes("/glossary") && read(f).includes("AUD"), `built ${f} carries glossary link and AUD prices`);
  ok(fs.existsSync(path.join(out, keyFiles[0])), "IndexNow key file is in the build output");
  const sm = read("sitemap.xml");
  ok(sm.includes("https://titanos.tech/glossary") && sm.includes("https://titanos.tech/authors/kyle-deligny"), "sitemap lists both new pages");
} else console.log("note: built checks skipped (no out/)");

console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);
