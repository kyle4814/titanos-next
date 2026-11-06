// C9 gate (Trust, investor room, Proof Wall, Sector Index, open data). Kill test: every number on the page traces to a file;
// content_lint 0 tells and 0 unlabelled figures. Source layers always run; `--built <dir>` adds the rendered-HTML layers.
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const P = (p) => new URL(p, root);
const R = (p) => readFileSync(P(p), "utf8");
const J = (p) => JSON.parse(R(p));
const DASH = /[–—]/;

// 1. EV6: every evidence page carries a system + date stamp
const prov = J("lib/site-data/provenance.json");
const routes = Object.keys(prov).filter((k) => k.startsWith("/"));
const ledger = J("lib/ledger.json");
ok(routes.length === 9, "nine evidence routes stamped (our-scan is a redirect page, no numbers)");
for (const r of routes) {
  const e = prov[r];
  const date = e.dateFrom === "ledger" ? ledger.facts_as_of : e.date;
  ok(e.system && /^\d{4}-\d{2}-\d{2}$/.test(date || "") && e.source && e.scope, `${r}: system, ISO date, source and scope present`);
  const page = R(`app${r}/page.tsx`);
  ok(page.includes(`<Provenance route="${r}" />`), `${r}: page renders its provenance stamp`);
  ok(!e.source.includes("*") ? existsSync(P(e.source)) : readdirSync(P(e.source.replace(/\*.*/, "").replace(/[^/]*$/, ""))).length > 0, `${r}: named source exists on disk (${e.source})`);
}
ok(readFileSync(P("public/proof/trading-app-tests.log"), "utf8").startsWith(prov["/proof"].date), "/proof literal date matches the first line of the test log it cites");
ok(prov["/efficiency"].date === J("lib/site-data/proof.json").generated.baselineTs.slice(0, 10), "/efficiency date equals the baseline snapshot date in proof.json");

// 2. Trust page: every claim names a file, and the file really says it
const trust = J("lib/site-data/trust.json");
const ids = trust.sections.map((s) => s.id);
for (const need of ["scan", "never", "privacy", "ai", "refunds", "status"]) ok(ids.includes(need), `trust page has the ${need} section`);
for (const s of trust.sections) ok(existsSync(P(s.source)) && R(s.source).includes(s.needle), `trust/${s.id}: source ${s.source} contains the cited text`);
ok(trust.sections.find((s) => s.id === "status").body.includes("UNKNOWN"), "trust/status says UNKNOWN, no invented uptime figure");
const trustSrc = R("app/trust/page.tsx");
const lit = [...trustSrc.matchAll(/>([^<>{}]*\d[^<>{}]*)</g)].map((m) => m[1]);
ok(lit.length === 0, "trust page has no hand-typed figure in its JSX text" + (lit.length ? " :: " + lit.join("|") : ""));
ok(!DASH.test(JSON.stringify(trust)) && !DASH.test(trustSrc), "trust copy has zero em or en dashes");

// 3. Investor room is a private link (D6)
const inv = R("app/investors/page.tsx");
ok(/robots:\s*\{\s*index:\s*false/.test(inv), "/investors is noindex");
const navSrc = R("lib/navLinks.ts");
ok(!navSrc.includes('"/investors"'), "/investors is not in the public nav");
const offenders = [];
const walk = (d) => { for (const e of readdirSync(P(d), { withFileTypes: true })) { const rel = `${d}/${e.name}`; if (e.isDirectory()) walk(rel); else if (/\.(tsx|ts)$/.test(e.name) && rel !== "app/investors/page.tsx" && /href=["']\/investors/.test(R(rel))) offenders.push(rel); } };
walk("app"); walk("components");
ok(offenders.length === 0, "no public page links to /investors" + (offenders.length ? " :: " + offenders.join(",") : ""));
ok(!/forecast|projected revenue|guaranteed return/i.test(inv.replace(/FORECAST/g, "")), "investor room makes no forecast or return promise");

// 4. Open datasets are generated, never hand-edited, and every row is labelled
const g = spawnSync("node", ["scripts/gen_open_data.mjs", "--check"], { cwd: root.pathname, encoding: "utf8" });
ok(g.status === 0, "public/data/* equals a fresh generation from the site data files" + (g.stdout ? " :: " + g.stdout.trim() : ""));
const sec = J("public/data/sector-index.json"), claims = J("public/data/claims-ledger.json");
const labels = Object.keys(claims.labels);
ok(sec.rows.length === J("lib/site-data/sectors.json").length && sec.rows.length >= 10, `sector index has one row per sector (${sec.rows.length})`);
ok(sec.rows.every((r) => labels.includes(r.label) && r.value && r.note), "every sector row has a valid claim label, a value and a note");
ok(sec.rows.every((r) => r.label === "UNKNOWN" || r.source), "every non-UNKNOWN sector number names a source");
ok(claims.rows.every((r) => labels.includes(r.label) && r.source && /^\d{4}-\d{2}-\d{2}/.test(r.date) && r.method), "every claims-ledger row has label, source, date and method");
ok(claims.rows.some((r) => r.label === "UNKNOWN") && claims.rows.some((r) => r.label === "MODELLED"), "claims ledger keeps its UNKNOWN and MODELLED rows");
ok(sec.compiled && sec.licence && claims.licence, "datasets carry a compiled date and a licence line");
ok(R("public/data/sector-index.csv").trim().split("\n").length === sec.rows.length + 1, "CSV row count equals JSON row count");
ok(R("app/sectors/page.tsx").includes('href="/open-data"'), "Sector Index links to the open data page");

// 5. Census move 4: nothing that is not buyable looks buyable
const offers = J("lib/offers/offers.json"), links = J("lib/offers/links.json");
const list = Array.isArray(offers) ? offers : offers.offers || Object.values(offers);
const nonBuy = list.filter((o) => o.status !== "READY" || !links[o.slug]);
ok(list.length > 100 && nonBuy.length > 0, `offer census: ${list.length} offers, ${nonBuy.length} not buyable`);
const slugPage = R("app/offers/[slug]/page.tsx");
ok(/av === "BUYABLE" && href/.test(slugPage) && slugPage.indexOf("BUY NOW") === slugPage.lastIndexOf("BUY NOW"), "BUY NOW renders only on the BUYABLE branch (one occurrence, guarded)");

// 6. Built layers
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const out = process.argv[bi + 1];
  const read = (r) => readFileSync(join(out, `${r}.html`), "utf8");
  const text = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");
  for (const r of routes) ok(new RegExp(`data-provenance="${r}"`).test(read(r)), `built ${r} carries its provenance stamp`);
  for (const r of ["/trust", "/open-data", "/sectors"]) ok(existsSync(join(out, `${r}.html`)), `built ${r} exists`);
  const inH = read("/investors");
  ok(/noindex/.test(inH), "built /investors is noindex");
  ok(!/investors/.test(readFileSync(join(out, "sitemap.xml"), "utf8")), "sitemap.xml does not list /investors");
  ok(/\/trust/.test(readFileSync(join(out, "sitemap.xml"), "utf8")) && /\/open-data/.test(readFileSync(join(out, "sitemap.xml"), "utf8")), "sitemap lists /trust and /open-data");
  ok(/application\/ld\+json/.test(read("/open-data")) && /"@type":"Dataset"/.test(read("/open-data")), "open-data page emits Dataset JSON-LD");
  // every number on /trust and /open-data is in its data file or in the page chrome
  const known = (JSON.stringify(trust) + JSON.stringify(J("lib/site-data/opendata.json")) + JSON.stringify(prov)).replace(/[,\s]/g, "");
  for (const r of ["/trust", "/open-data"]) {
    const body = text(read(r).replace(/<(header|nav|footer)[\s\S]*?<\/\1>/g, " "));
    const nums = [...body.matchAll(/\b\d[\d.,]*\d\b|\b\d\b/g)].map((m) => m[0].replace(/[,]/g, ""));
    const bad = nums.filter((n) => !known.includes(n));
    ok(bad.length === 0, `built ${r}: every number traces to a data file` + (bad.length ? " :: " + [...new Set(bad)].slice(0, 8).join(",") : ""));
  }
  // content_lint on the visible copy of the C9 pages
  const dir = mkdtempSync(join(tmpdir(), "c9lint-"));
  for (const r of ["/trust", "/open-data", "/sectors", "/proof"]) {
    const f = join(dir, r.slice(1) + ".txt");
    // paragraph = one block element (li, p, heading, article, aside, section, div row), so a figure stays with its label chip
    const blocks = read(r).replace(/<(header|nav|footer)[\s\S]*?<\/\1>/g, " ").replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").split(/<\/(?:li|p|h[1-6]|article|aside|section|tr|figure)>/);
    writeFileSync(f, blocks.map((b) => text(b).trim()).filter(Boolean).join("\n\n"));
    const lint = spawnSync("python3", ["/home/tech2/klinge-kernel/bin/content_lint.py", "--no-cta", "--figures", f], { encoding: "utf8" });
    ok(lint.status === 0, `content_lint --no-cta --figures CLEAN on ${r}` + (lint.status ? " :: " + (lint.stdout + lint.stderr).trim().slice(0, 300) : ""));
  }
  // offers: built non-buyable pages never carry BUY NOW
  let leaks = 0, checked = 0;
  for (const o of nonBuy.slice(0, 400)) { const f = join(out, "offers", `${o.slug}.html`); if (!existsSync(f)) continue; checked++; if (/BUY NOW/.test(readFileSync(f, "utf8"))) leaks++; }
  ok(checked > 50 && leaks === 0, `built non-buyable offer pages show no BUY NOW (${checked} checked, ${leaks} leaks)`);
} else {
  console.log("SKIP built layers (run with --built out)");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
