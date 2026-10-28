// Fail-red gate for the Black Ice dossier content type (lib/black-ice/dossiers.ts). Run via `npm test`,
// after a build (out/ must exist; test_seo.mjs builds it first if absent).
// 1. check() runs on the REAL data and the REAL out/ directory and must report nothing.
// 2. Fifteen fixtures each inject one fault and must make check() report exactly that fault's code
//    (proof the gate bites). Fixture 12 touches the real out/ directory and cleans up in a finally.
import fs from "node:fs";
import path from "node:path";
import { DOSSIERS } from "../lib/black-ice/dossiers.ts";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "out");
const SITE = "https://titanos.tech";
const DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`);
const ogName = (slug) => `black-ice-dossiers-${slug}.png`;

if (!fs.existsSync(path.join(OUT, "sitemap.xml"))) {
  console.log("FAIL out/sitemap.xml missing (run npm run build first)");
  process.exit(1);
}

const realEnv = () => ({
  sitemap: fs.readFileSync(path.join(OUT, "sitemap.xml"), "utf8"),
  routesSrc: fs.readFileSync(path.join(ROOT, "lib/routes.ts"), "utf8"),
  htmlOf: (slug) => {
    const f = path.join(OUT, "black-ice", "dossiers", `${slug}.html`);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  },
  exported: (slug) => {
    const d = path.join(OUT, "black-ice", "dossiers");
    return fs.existsSync(path.join(d, `${slug}.html`)) || fs.existsSync(path.join(d, slug)) || fs.existsSync(path.join(d, `${slug}.txt`));
  },
  ogExists: (slug) => fs.existsSync(path.join(OUT, "og", ogName(slug))),
});

const textOf = (b) => (b.text ?? b.items?.join(" ") ?? "");
const sentences = (t) => t.split(/(?<=[.!?])\s+(?!\[)/);

function check(ds, env) {
  const e = new Set();
  const slugs = new Set(), ids = new Set();
  for (const d of ds) {
    if (slugs.has(d.slug)) e.add("F01"); slugs.add(d.slug);
    if (ids.has(d.contentId)) e.add("F02"); ids.add(d.contentId);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug)) e.add("F03");
    if (!d.doesNotProve?.length) e.add("F04");
    if (!d.limitations?.length) e.add("F05");
    if (!d.sources?.length) e.add("F06");
    if ((d.rung === "OBSERVED" || d.rung === "REPRODUCED") && !d.sources?.length) e.add("F07");
    if (d.rung === "EXAMPLE") {
      for (const b of d.body) for (const s of sentences(textOf(b))) if (/\d/.test(s) && !/EXAMPLE/.test(s)) e.add("F08");
    }
    if (d.published && d.review === "NOT_REVIEWED") e.add("F09");
    if (d.description.length > 155 || d.title.length > 60) e.add("F13");
    if (DASHES.test(JSON.stringify(d.body))) e.add("F14");
    if (/\/home\/|\.titanos|CORE\.md|SOUL\.md|LEXICON\.md|OPERATING_MODEL|BEGIN [A-Z ]*PRIVATE|sk_live|X SHORT COPY/.test(JSON.stringify(d))) e.add("F16");
    if (DASHES.test(JSON.stringify(d))) e.add("F14");
    if (d.published) {
      const html = env.htmlOf(d.slug);
      const m = html && html.match(/<link rel="canonical" href="([^"]*)"/);
      if (!m || m[1] !== `${SITE}/black-ice/dossiers/${d.slug}`) e.add("F10");
      if (!env.sitemap.includes(`<loc>${SITE}/black-ice/dossiers/${d.slug}</loc>`)) e.add("F11");
      if (!env.ogExists(d.slug)) e.add("F15");
      if (html && !html.includes(`data-rung="${d.rung}"`)) e.add("F17");
    } else {
      if (env.exported(d.slug)) e.add("F12");
      if (env.sitemap.includes(`/black-ice/dossiers/${d.slug}<`)) e.add("F11");
    }
  }
  if (!/for \(const d of DOSSIERS\) if \(d\.published\)/.test(env.routesSrc)) e.add("F11");
  return e;
}

let fail = 0, pass = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); c ? pass++ : fail++; };
const clone = () => structuredClone(DOSSIERS);
const pub = () => DOSSIERS.findIndex((d) => d.published);
const unpub = () => DOSSIERS.findIndex((d) => !d.published);

// real data, real out/
const real = check(DOSSIERS, realEnv());
ok(real.size === 0, `real dossiers pass every check (${[...real].join(",") || "none"})`);
ok(DOSSIERS.some((d) => d.published) && DOSSIERS.some((d) => !d.published), "real data exercises both published and unpublished");
ok(DOSSIERS.filter((d) => d.published).every((d) => d.review === "REVIEWED_PASS"), "every published dossier is REVIEWED_PASS");
ok(fs.readFileSync(path.join(ROOT, "scripts/gen_og.mjs"), "utf8").includes("data-rung"), "gen_og prints the evidence rung on the card");

const bites = (n, code, label, mutate, envMut) => {
  const ds = clone(); const env = realEnv();
  mutate?.(ds, env);
  envMut?.(env);
  const got = check(ds, env);
  ok(got.has(code), `fixture ${n} bites: ${label} -> ${code}`);
};
const i = pub(), u = unpub();
bites(1, "F01", "duplicate slug", (ds) => { ds[1].slug = ds[0].slug; });
bites(2, "F02", "duplicate contentId", (ds) => { ds[1].contentId = ds[0].contentId; });
bites(3, "F03", "slug not kebab-case", (ds) => { ds[i].slug = "Bad_Slug"; });
bites(4, "F04", "doesNotProve empty", (ds) => { ds[i].doesNotProve = []; });
bites(5, "F05", "limitations empty", (ds) => { ds[i].limitations = []; });
bites(6, "F06", "sources empty", (ds) => { ds[i].sources = []; });
bites(7, "F07", "OBSERVED rung with no sources", (ds) => { ds[i].rung = "OBSERVED"; ds[i].sources = []; });
bites(8, "F08", "EXAMPLE page with unlabelled arithmetic", (ds) => { ds[i].rung = "EXAMPLE"; ds[i].body = [{ type: "p", text: "The total is 400 invoices at 50 cents each." }]; });
bites(9, "F09", "published while NOT_REVIEWED", (ds) => { ds[i].review = "NOT_REVIEWED"; });
bites(10, "F10", "canonical differs from SITE + path", null, (env) => { const h = env.htmlOf; env.htmlOf = (s) => h(s)?.replace(/(<link rel="canonical" href=")[^"]*/, "$1https://titanos.tech/black-ice/dossiers/wrong"); });
bites(11, "F11", "published slug absent from indexableRoutes output", null, (env) => { env.sitemap = env.sitemap.replaceAll(`/black-ice/dossiers/${DOSSIERS[i].slug}`, "/gone"); });
bites(14, "F14", "em dash in body", (ds) => { ds[i].body.push({ type: "p", text: `Bad${String.fromCharCode(0x2014)}dash` }); });
bites(13, "F13", "description over 155 chars", (ds) => { ds[i].description = "x".repeat(156); });
bites(15, "F15", "OG image missing for a published dossier", null, (env) => { env.ogExists = () => false; });
bites(16, "F16", "host path in content (extra)", (ds) => { ds[i].objection += " /home/someone/file"; });

// fixture 12 against the REAL out/ directory: drop an unpublished slug's page into the export, expect the leak to be caught
{
  const f = path.join(OUT, "black-ice", "dossiers", `${DOSSIERS[u].slug}.html`);
  const existed = fs.existsSync(f);
  ok(!existed, "fixture 12 precondition: unpublished slug is absent from the real export");
  try {
    fs.writeFileSync(f, "<html>leak</html>");
    ok(check(DOSSIERS, realEnv()).has("F12"), "fixture 12 bites: unpublished slug present in out/ -> F12");
  } finally {
    if (!existed) fs.rmSync(f, { force: true });
  }
  ok(!fs.existsSync(f), "fixture 12 cleaned up");
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
