// f260 gate: /pricing, /partners#revenue-share, /feed.xml + /rss.xml, /trust sections.
// Source layers always run; `--built <dir>` adds the static-export layers (200 = file exists, meta, links, figures, feed XML).
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };
const root = new URL("../", import.meta.url);
const R = (p) => readFileSync(new URL(p, root), "utf8");
const J = (p) => JSON.parse(R(p));
const DASH = /[–—]/;
const TELLS = /\b(delve|leverage|robust|holistic|landscape|cutting-edge|synergy|ecosystem|streamline|seamless)\b|it's important to note|in today's|dive into/i;

// 1. pricing: every row traces to a line in lib/pricing.ts, with the same number
const trace = J("lib/site-data/pricing-trace.json");
const pricingSrc = R("lib/pricing.ts");
ok(/^\d{4}-\d{2}-\d{2}$/.test(trace.asOf) && trace.system, "pricing-trace has a system and ISO date");
for (const r of trace.rows) {
  ok(pricingSrc.includes(r.needle), `${r.id}: needle "${r.needle}" is in lib/pricing.ts`);
  const m = r.needle.match(/(\d+)\s*$/);
  ok(m && Number(m[1]) === r.amount, `${r.id}: amount ${r.amount} equals the number in lib/pricing.ts`);
  ok(existsSync(new URL(r.source, root)), `${r.id}: source ${r.source} exists`);
}
const CORE_NUM1 = [1500, 2500, 5000, 149, 5997, 497, 3497, 49997, 149997];
for (const n of CORE_NUM1) ok(trace.rows.some((r) => r.amount === n), `CORE NUM1 figure ${n} is on /pricing`);
const planPath = "/home/tech2/klinge-kernel/FULL_BUSINESS_PROJECT/01_BUSINESS_PLAN_2026-10-10.md";
if (existsSync(planPath)) {
  const plan = readFileSync(planPath, "utf8");
  for (const n of [1500, 5000, 149, 5997, 497, 49997, 149997]) ok(plan.includes(n.toLocaleString("en-US")), `plan chapter 5 states ${n}`);
}
const pg = R("app/pricing/page.tsx");
ok(!/AU\$\s?\d|\$\d/.test(pg), "pricing page types no dollar figure inline");
ok(!trace.rows.some((r) => /tier|marketplace|take rate/i.test(r.label)), "no unpublished plan (owner tier, marketplace) on /pricing");

// 2. copy lint on every new page and the trust data
for (const f of ["app/pricing/page.tsx", "app/partners/page.tsx", "lib/site-data/trust.json", "lib/site-data/pricing-trace.json", "lib/feed.ts"]) {
  const t = R(f);
  ok(!DASH.test(t), `${f}: zero em/en dashes`);
  ok(!TELLS.test(t), `${f}: zero AI-tell words`);
}
const partners = R("app/partners/page.tsx");
ok(partners.includes('id="revenue-share"') && /not switched on/.test(partners), "partners: #revenue-share exists and parks the rates honestly");
ok(!/\b\d{2}\s?%/.test(partners), "partners: no percentage published (plan 30/40/50 is EXAMPLE only)");
ok(!/guarantee|certified|accredited/i.test(partners + pg), "no capability claim words on new pages");

// 3. trust anchors
const trust = J("lib/site-data/trust.json");
for (const a of ["what-we-scan", "security", "privacy", "ai-disclosure", "status"]) ok(trust.sections.some((s) => s.anchor === a), `trust: section anchor #${a}`);
ok(R("app/trust/page.tsx").includes("id={s.anchor}"), "trust page renders the anchor ids");
const dis = R("lib/site-data/disclosure.json");
const sec = trust.sections.find((s) => s.id === "security");
ok(dis.includes(sec.needle), "trust security section cites text that exists in disclosure.json");
ok(/passive/i.test(trust.sections[0].body), "trust what-we-scan says passive");

// 4. feed
const feedLib = R("lib/feed.ts");
ok(feedLib.includes("postsSortedByDate"), "feed is generated from the blog index");
for (const n of ["feed.xml", "rss.xml"]) ok(/force-static/.test(R(`app/${n}/route.ts`)) && /feedResponse/.test(R(`app/${n}/route.ts`)), `${n}: static route handler`);

// 5. figure freshness covers the new trace file
const ff = spawnSync("node", ["scripts/figure_freshness.mjs", "--as-of", "2026-11-07", "--json", "--quiet"], { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8" });
let rep = null; try { rep = JSON.parse(ff.stdout); } catch { /* reported below */ }
ok(rep && rep.scanned.includes("lib/site-data/pricing-trace.json"), "f94 scans pricing-trace.json");
ok(rep && !rep.figures.some((f) => f.id.startsWith("rows.") && /pricing/i.test(f.surface || "") && ["UNDATED", "ORPHAN", "NOSYSTEM"].includes(f.state)), "f94: no pricing figure UNDATED/ORPHAN/NOSYSTEM");

// 6. built export
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const out = process.argv[bi + 1];
  const H = (p) => readFileSync(`${out}/${p}`, "utf8");
  for (const [route, file] of [["/pricing", "pricing.html"], ["/partners", "partners.html"], ["/trust", "trust.html"]]) {
    ok(existsSync(`${out}/${file}`), `${route}: 200 (file ${file} in export)`);
    const h = H(file);
    ok(/<title>[^<]{10,}/.test(h) && /rel="canonical"/.test(h) && /name="description"/.test(h), `${route}: title, canonical and description present`);
    ok(!DASH.test(h.replace(/<(script|style)[\s\S]*?<\/\1>/g, "")), `${route}: no em/en dash in rendered text`);
  }
  const pr = H("pricing.html");
  for (const r of trace.rows) ok(pr.includes(`data-price="${r.id}"`) && pr.includes(r.amount.toLocaleString("en-US")), `built /pricing shows ${r.id} ${r.amount}`);
  const tr = H("trust.html");
  for (const a of ["what-we-scan", "security", "privacy", "ai-disclosure", "status"]) ok(tr.includes(`id="${a}"`), `built /trust has #${a}`);
  ok(H("partners.html").includes('id="revenue-share"'), "built /partners has #revenue-share");
  const f1 = existsSync(`${out}/feed.xml`) ? H("feed.xml") : "";
  const f2 = existsSync(`${out}/rss.xml`) ? H("rss.xml") : "";
  ok(f1.startsWith("<?xml") && f1.includes("<rss version=\"2.0\"") && f1 === f2, "built /feed.xml is RSS 2.0 and /rss.xml is identical");
  const { POSTS } = await import("../lib/blog.ts").catch(() => ({ POSTS: null }));
  const slugs = [...f1.matchAll(/<link>https:\/\/titanos\.tech\/blog\/([^<]+)<\/link>/g)].map((m) => m[1]);
  ok(slugs.length > 0 && (!POSTS || slugs.length === POSTS.length), `feed lists ${slugs.length} posts`);
  ok(slugs.every((s) => existsSync(`${out}/blog/${s}.html`)), "every feed link points at a page in the export");
  ok(!DASH.test(f1.replace(/<description>[\s\S]*?<\/description>|<title>[\s\S]*?<\/title>/g, "")), "feed structure has no dashes");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
