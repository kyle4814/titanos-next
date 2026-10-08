// SEO audit over the static export (out/). Exit 1 when any indexable route
// lacks title, description, canonical, og:image or twitter:image, has no
// single h1, or skips heading levels. Used by scripts/test_seo.mjs.
import fs from "node:fs";
import path from "node:path";

export const SITE = "https://titanos.tech";

export function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "_next" && e.name !== "_not-found") walk(p, acc); }
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

export function routeOf(out, file) {
  let r = "/" + path.relative(out, file).replace(/\\/g, "/").replace(/\.html$/, "");
  r = r.replace(/\/index$/, "") || "/";
  return r;
}

const meta = (html, re) => (html.match(re) || [])[1];

export function inspect(html) {
  const robots = meta(html, /<meta name="robots" content="([^"]*)"/i) || "";
  const headings = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  return {
    noindex: /noindex/i.test(robots),
    title: meta(html, /<title>([^<]*)<\/title>/i),
    description: meta(html, /<meta name="description" content="([^"]*)"/i),
    canonical: meta(html, /<link rel="canonical" href="([^"]*)"/i),
    ogImage: meta(html, /<meta property="og:image" content="([^"]*)"/i),
    twImage: meta(html, /<meta name="twitter:image" content="([^"]*)"/i),
    headings,
    jsonld: [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]),
  };
}

export function audit(out) {
  const rows = [];
  for (const f of walk(out)) {
    const route = routeOf(out, f);
    rows.push({ route, ...inspect(fs.readFileSync(f, "utf8")) });
  }
  return rows.sort((a, b) => a.route.localeCompare(b.route));
}

export function problems(rows) {
  const out = [];
  for (const r of rows) {
    if (r.noindex) continue;
    const bad = [];
    if (!r.title) bad.push("title");
    if (!r.description) bad.push("description");
    if (!r.canonical) bad.push("canonical");
    else if (r.canonical.replace(/\/$/, "") !== (SITE + (r.route === "/" ? "" : r.route))) bad.push(`canonical!=route (${r.canonical})`);
    if (!r.ogImage) bad.push("og:image");
    if (!r.twImage) bad.push("twitter:image");
    if (r.description && r.description.length > 170) bad.push(`description ${r.description.length} chars`);
    const h1 = r.headings.filter((h) => h === 1).length;
    if (h1 !== 1) bad.push(`h1 count ${h1}`);
    for (let i = 1; i < r.headings.length; i++) if (r.headings[i] - r.headings[i - 1] > 1) { bad.push(`heading skip h${r.headings[i - 1]}>h${r.headings[i]}`); break; }
    if (bad.length) out.push({ route: r.route, bad });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith("seo_audit.mjs")) {
  const out = process.argv[2] || "out";
  const rows = audit(out);
  const p = problems(rows);
  console.log(`routes ${rows.length}, indexable ${rows.filter((r) => !r.noindex).length}, with problems ${p.length}`);
  for (const x of p) console.log(`${x.route}: ${x.bad.join("; ")}`);
  process.exit(p.length ? 1 : 0);
}
