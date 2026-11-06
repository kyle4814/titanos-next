#!/usr/bin/env node
// mailto_order_sweep.mjs - find mailto: links and order/buy/get-started CTAs that
// are NOT routed through the checkout or signup path (plan census move 2).
// Scans source (app, components, lib, public) and, if present, the built out/ tree.
// Output: a table of page, link, line, status, checkout-route-exists.
// Status: ALLOWED (allow-list entry, with reason) | LEAK (not allowed) | LEAK-ORDER (not allowed AND on an order page: FAILS).
// Usage: node scripts/mailto_order_sweep.mjs [--root DIR] [--out DIR] [--allow FILE] [--report] [--json] [--all]
//   default exit 1 on any LEAK-ORDER row; --report always exits 0 (measurement mode).
// No network, no model calls. Read-only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(opt("--root", path.join(HERE, "..")));
const OUT = path.resolve(opt("--out", path.join(ROOT, "out")));
const ALLOW = JSON.parse(fs.readFileSync(opt("--allow", path.join(HERE, "mailto_allowlist.json")), "utf8"));
for (const e of ALLOW.allow) if (!e.reason || !e.id) { console.error(`allow-list entry without id/reason: ${JSON.stringify(e)}`); process.exit(2); }
const re = (s, f = "i") => new RegExp(s, f);

function walk(dir, test, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, acc);
    else if (test(e.name)) acc.push(p);
  }
  return acc;
}
const rel = (p, base) => path.relative(base, p).split(path.sep).join("/");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

// ---- source -> routes ------------------------------------------------------
function pageRoute(file) {
  const m = file.match(/^app\/(.*?)\/?page\.(tsx|jsx|ts)$/);
  if (!m) return null;
  return "/" + m[1].replace(/\([^)]*\)\//g, "");
}
function importGraph(files) {
  const importers = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of txt.matchAll(/from\s+["']([^"']+)["']/g)) {
      const spec = m[1];
      let target = null;
      if (spec.startsWith("@/")) target = spec.slice(2);
      else if (spec.startsWith(".")) target = rel(path.resolve(path.dirname(path.join(ROOT, f)), spec), ROOT);
      if (!target) continue;
      for (const ext of ["", ".tsx", ".ts", ".jsx", "/index.tsx", "/index.ts"]) {
        const cand = target + ext;
        if (files.includes(cand)) {
          if (!importers.has(cand)) importers.set(cand, new Set());
          importers.get(cand).add(f);
          break;
        }
      }
    }
  }
  return importers;
}
function routesFor(file, importers, seen = new Set()) {
  if (seen.has(file)) return [];
  seen.add(file);
  const r = pageRoute(file);
  if (r) return [r];
  const out = new Set();
  for (const imp of importers.get(file) ?? []) for (const x of routesFor(imp, importers, seen)) out.add(x);
  return [...out];
}

const isComment = (line) => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);
const MAILTO = /mailto:[A-Za-z0-9${`]/;

// CTA extraction: <a|Link|AnimatedButton ... href=X ...>TEXT</tag>
function ctaElements(txt) {
  const out = [];
  for (const m of txt.matchAll(/<(a|Link|AnimatedButton)\b([^>]*?)>([\s\S]*?)<\/\1>/g)) {
    const hm = m[2].match(/href=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\}|\{([A-Za-z_][\w.]*)\})/);
    if (!hm) continue;
    const href = hm[1] ?? hm[2] ?? hm[3] ?? `{${hm[4]}}`;
    const text = m[3].replace(/<[^>]*>/g, " ").replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
    out.push({ href: decode(href), text, line: txt.slice(0, m.index).split("\n").length });
  }
  return out;
}

const rows = [];
function classify(row) {
  const matches = (e) =>
    (!e.target || re(e.target).test(row.link)) &&
    ((e.file && re(e.file).test(row.file)) || (e.route && row.routes.some((r) => re(e.route).test(r))) || (!e.file && !e.route));
  const hit = ALLOW.allow.find(matches);
  const onOrder = row.routes.some((r) => ALLOW.order_pages.some((o) => re(o).test(r)));
  row.status = hit ? "ALLOWED" : onOrder ? "LEAK-ORDER" : "LEAK";
  row.reason = hit ? `${hit.id}: ${hit.reason}` : "";
  const cf = ALLOW.checkout_for.find((c) => row.routes.some((r) => re(c.route).test(r)));
  row.checkout = cf ? (cf.checkout ?? "NONE") : "NONE";
  row.checkoutExists = cf && cf.checkout ? "yes" : "no";
  rows.push(row);
}
const isCheckout = (href) => ALLOW.checkout_routes.some((c) => re(c).test(href));
const ctaWords = re(ALLOW.cta_words);

// ---- scan source -----------------------------------------------------------
const srcFiles = ["app", "components", "lib"]
  .flatMap((d) => walk(path.join(ROOT, d), (n) => /\.(tsx|ts|jsx)$/.test(n)))
  .map((p) => rel(p, ROOT));
const publicFiles = walk(path.join(ROOT, "public"), (n) => /\.(txt|html|json|xml)$/.test(n)).map((p) => rel(p, ROOT));
const importers = importGraph(srcFiles);
for (const f of srcFiles) {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  const routes = routesFor(f, importers);
  const rts = routes.length ? routes : ["(unrouted)"];
  const srcLines = txt.split("\n");
  srcLines.forEach((line, i) => {
    if (isComment(line) || !MAILTO.test(line)) return;
    // a concatenated literal ("mailto:..." + next line) is one link: join the continuation
    const joined = /\+\s*$/.test(line) ? line + " " + (srcLines[i + 1] ?? "") : line;
    const flat = joined.replace(/\$\{SITE\.KYLE_EMAIL\}/g, "KYLE_EMAIL").replace(/\$\{[^}]*\}/g, "EXPR").replace(/\$\{.*$/, "EXPR").replace(/["'`]\s*\+\s*["'`]/g, "");
    const m = flat.match(/mailto:[^"'`\s>)]*/);
    classify({ scope: "source", kind: "MAILTO", file: f, routes: rts, line: i + 1, link: m ? m[0] : "mailto:?", text: "" });
  });
  for (const c of ctaElements(txt)) {
    if (c.href.startsWith("mailto:") || c.text.length > 40 || !ctaWords.test(c.text)) continue;
    if (!/^(https?:|\/)/.test(c.href)) continue; // dynamic href: not judgeable statically
    if (isCheckout(c.href.replace(/\?.*$/, ""))) continue;
    classify({ scope: "source", kind: "CTA", file: f, routes: rts, line: c.line, link: c.href, text: c.text });
  }
}
for (const f of publicFiles) {
  const txt = fs.readFileSync(path.join(ROOT, f), "utf8");
  txt.split("\n").forEach((line, i) => {
    const m = line.match(/mailto:[^\s"'<>]*/);
    if (m) classify({ scope: "source", kind: "MAILTO", file: f, routes: ["(public file)"], line: i + 1, link: m[0], text: "" });
  });
}

// ---- scan built out/ -------------------------------------------------------
let builtState = "ABSENT";
if (fs.existsSync(OUT)) {
  builtState = "SCANNED";
  for (const p of walk(OUT, (n) => n.endsWith(".html")).filter((p) => !/[\\/]_next[\\/]/.test(p))) {
    const f = "out/" + rel(p, OUT);
    const route = ("/" + rel(p, OUT).replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "")).replace(/\/$/, "") || "/";
    const txt = fs.readFileSync(p, "utf8");
    const lineOf = (idx) => txt.slice(0, idx).split("\n").length;
    for (const m of txt.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/g)) {
      const hm = m[1].match(/href="([^"]*)"/);
      if (!hm) continue;
      const href = decode(hm[1]);
      const text = m[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (href.startsWith("mailto:")) {
        classify({ scope: "built", kind: "MAILTO", file: f, routes: [route], line: lineOf(m.index), link: href, text });
      } else if (text.length <= 40 && ctaWords.test(text) && /^\//.test(href) && !isCheckout(href.replace(/\?.*$/, ""))) {
        classify({ scope: "built", kind: "CTA", file: f, routes: [route], line: lineOf(m.index), link: href, text });
      }
    }
    for (const m of txt.matchAll(/(?:action|content)="(mailto:[^"]*)"/g)) {
      classify({ scope: "built", kind: "MAILTO", file: f, routes: [route], line: lineOf(m.index), link: decode(m[1]), text: "(non-anchor)" });
    }
  }
}

// ---- report ----------------------------------------------------------------
const counts = (scope) => {
  const r = rows.filter((x) => x.scope === scope);
  const n = (s) => r.filter((x) => x.status === s).length;
  return { total: r.length, allowed: n("ALLOWED"), leak: n("LEAK"), leakOrder: n("LEAK-ORDER") };
};
const summary = { root: ROOT, builtTree: builtState, source: counts("source"), built: counts("built") };
summary.remaining = summary.source.leak + summary.source.leakOrder;
summary.remainingBuilt = summary.built.leak + summary.built.leakOrder;
summary.pagesWithLeaks = [...new Set(rows.filter((x) => x.scope === "built" && x.status !== "ALLOWED").flatMap((x) => x.routes))].length;
summary.failing = rows.filter((x) => x.status === "LEAK-ORDER").length;

if (flag("--json")) {
  console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "~" : s);
  console.log("SCOPE  KIND    STATUS      PAGE(S)                      FILE:LINE                                   CHECKOUT  LINK");
  for (const r of rows.filter((x) => x.status !== "ALLOWED" || flag("--all"))) {
    console.log([
      r.scope.padEnd(6), r.kind.padEnd(7), r.status.padEnd(11),
      cut(r.routes.join(","), 28).padEnd(28), cut(`${r.file}:${r.line}`, 43).padEnd(43),
      r.checkoutExists.padEnd(9), cut(r.link, 90),
    ].join(" "));
  }
  console.log("");
  console.log(`built out/ tree: ${builtState}${builtState === "ABSENT" ? " (source only; build first for the rendered view)" : ""}`);
  console.log(`source: ${summary.source.total} found, ${summary.source.allowed} allowed, ${summary.source.leak} leak, ${summary.source.leakOrder} leak on order pages`);
  console.log(`built : ${summary.built.total} found, ${summary.built.allowed} allowed, ${summary.built.leak} leak, ${summary.built.leakOrder} leak on order pages`);
  console.log(`REMAINING source=${summary.remaining} built=${summary.remainingBuilt} built-pages-with-leaks=${summary.pagesWithLeaks} FAILING(order-page rows)=${summary.failing}`);
}
if (!flag("--report") && summary.failing > 0) {
  if (!flag("--json")) console.log(`FAIL ${summary.failing} non-checkout mailto/CTA row(s) on order pages`);
  process.exit(1);
}
if (!flag("--json")) console.log(summary.failing ? "REPORT MODE (exit 0)" : "PASS no non-checkout mailto/CTA on order pages");
