// a11y_static.mjs - STATIC LINT of exported HTML. NOT a WCAG conformance claim.
// Offline, no dependencies (jsdom/axe-core are not installed). Usage:
//   node scripts/a11y_static.mjs [outDir=out] [--baseline scripts/a11y_baseline.json] [--json] [--write-baseline]
// Exit 1 when any rule's total exceeds its baseline count. Built 2026-11-07 (f74_c1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RULES = ["html-lang", "h1-one", "heading-skip", "img-alt", "form-label", "link-button-name", "dup-id", "tabindex-positive", "contrast-inline"];
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "template", "noscript"]);

// ---- tiny HTML parser: element tree with attrs and text ----
export function parse(html) {
  const root = { tag: "#root", attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>|([^<]+|<)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) { // close tag
      const t = m[1].toLowerCase();
      for (let n = cur; n && n !== root; n = n.parent) if (n.tag === t) { cur = n.parent; break; }
    } else if (m[2]) {
      const tag = m[2].toLowerCase();
      const attrs = {};
      const ar = /([^\s=\/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a;
      while ((a = ar.exec(m[3]))) { const k = a[1].toLowerCase(); if (!(k in attrs)) attrs[k] = a[2] ?? a[3] ?? a[4] ?? ""; }
      const el = { tag, attrs, children: [], parent: cur };
      cur.children.push(el);
      if (RAW.has(tag)) { // swallow raw content
        if (!m[4]) { const close = new RegExp(`</${tag}\\s*>`, "i"); close.lastIndex = 0; const rest = html.slice(re.lastIndex); const c = close.exec(rest); if (c) { if (tag === "noscript" || tag === "template") el.raw = rest.slice(0, c.index); re.lastIndex += c.index + c[0].length; } }
      } else if (!VOID.has(tag) && !m[4]) cur = el;
    } else if (m[5]) {
      cur.children.push({ tag: "#text", text: m[5], parent: cur });
    }
  }
  return root;
}

const walk = (n, f) => { if (n.tag !== "#text") f(n); for (const c of n.children || []) walk(c, f); };
const isHidden = (n) => { for (let x = n; x && x.attrs; x = x.parent) if ("hidden" in x.attrs || x.attrs["aria-hidden"] === "true" || x.tag === "template") return true; return false; };
const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
function textOf(n, byId) {
  if (n.tag === "#text") return decode(n.text);
  if (n.attrs?.["aria-hidden"] === "true" || "hidden" in (n.attrs || {})) return "";
  if (n.tag === "img") return n.attrs.alt || "";
  if (n.tag === "svg") { const t = (n.children || []).find((c) => c.tag === "title"); return t ? textOf(t, byId) : ""; }
  return (n.children || []).map((c) => textOf(c, byId)).join("");
}
function accName(n, byId) {
  const a = n.attrs;
  if (a["aria-label"]?.trim()) return a["aria-label"].trim();
  if (a["aria-labelledby"]) { const t = a["aria-labelledby"].split(/\s+/).map((i) => byId.get(i) ? textOf(byId.get(i), byId) : "").join(" ").trim(); if (t) return t; }
  const t = textOf(n, byId).trim();
  if (t) return t;
  return a.title?.trim() || "";
}

// ---- colour ----
const NAMED = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", blue: "#0000ff", gray: "#808080", grey: "#808080", yellow: "#ffff00", silver: "#c0c0c0", navy: "#000080", orange: "#ffa500", purple: "#800080" };
export function parseColour(v) {
  if (!v) return null; v = v.trim().toLowerCase();
  if (NAMED[v]) v = NAMED[v];
  let m = v.match(/^#([0-9a-f]{3})$/); if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = v.match(/^#([0-9a-f]{6})$/); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = v.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/); if (m) return [+m[1], +m[2], +m[3]];
  return null; // var(), gradients, rgba, inherit, etc: not literal, skipped
}
const lum = ([r, g, b]) => { const c = [r, g, b].map((x) => x / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const styleProp = (style, prop) => { const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i")); return m ? m[1].trim() : null; };

// ---- scan ----
export function scanHtml(html, { disable = [] } = {}) {
  const off = new Set(disable);
  const v = [];
  const add = (rule, selector, msg) => { if (!off.has(rule)) v.push({ rule, selector, msg }); };
  const root = parse(html);
  const all = []; walk(root, (n) => { if (n.tag !== "#root") all.push(n); });
  const byId = new Map(); for (const n of all) if (n.attrs.id && !byId.has(n.attrs.id)) byId.set(n.attrs.id, n);
  const sel = (n) => n.tag + (n.attrs.id ? `#${n.attrs.id}` : n.attrs.href ? `[href="${n.attrs.href.slice(0, 40)}"]` : n.attrs.src ? `[src="${n.attrs.src.slice(0, 40)}"]` : n.attrs.class ? "." + n.attrs.class.split(/\s+/)[0] : "");
  const vis = all.filter((n) => !isHidden(n));

  const htmlEl = all.find((n) => n.tag === "html");
  if (!htmlEl || !htmlEl.attrs.lang?.trim()) add("html-lang", "html", "missing or empty lang");

  const hs = vis.filter((n) => /^h[1-6]$/.test(n.tag));
  const h1s = hs.filter((n) => n.tag === "h1");
  if (h1s.length !== 1) add("h1-one", "h1", `${h1s.length} h1 elements (want 1)`);
  let prev = 0;
  for (const h of hs) { const l = +h.tag[1]; if (prev && l > prev + 1) add("heading-skip", sel(h), `h${prev} to h${l}`); prev = l; }

  for (const n of vis) {
    if (n.tag === "img") {
      const role = n.attrs.role; if (!("alt" in n.attrs) && role !== "presentation" && role !== "none") add("img-alt", sel(n), "img without alt");
    }
    if (["input", "select", "textarea"].includes(n.tag)) {
      const t = (n.attrs.type || "text").toLowerCase();
      if (n.tag === "input" && ["hidden", "submit", "button", "reset", "image"].includes(t)) {
        if (t !== "hidden" && !(n.attrs.value || n.attrs["aria-label"] || n.attrs.title || t === "image")) add("link-button-name", sel(n), `input type=${t} without value`);
        continue;
      }
      let ok = !!(n.attrs["aria-label"]?.trim() || n.attrs.title?.trim());
      if (!ok && n.attrs["aria-labelledby"]) ok = n.attrs["aria-labelledby"].split(/\s+/).some((i) => byId.has(i) && textOf(byId.get(i), byId).trim());
      if (!ok && n.attrs.id) ok = all.some((l) => l.tag === "label" && l.attrs.for === n.attrs.id && textOf(l, byId).trim());
      if (!ok) for (let p = n.parent; p; p = p.parent) if (p.tag === "label" && textOf(p, byId).trim()) { ok = true; break; }
      if (!ok) add("form-label", sel(n), "form control without label");
    }
    if (n.tag === "button" || (n.tag === "a" && "href" in n.attrs) || n.attrs.role === "button" || n.attrs.role === "link") {
      if (!accName(n, byId)) add("link-button-name", sel(n), `${n.tag} without accessible name`);
    }
    if (n.attrs.tabindex !== undefined && parseInt(n.attrs.tabindex, 10) > 0) add("tabindex-positive", sel(n), `tabindex=${n.attrs.tabindex}`);
    if (n.attrs.style && !off.has("contrast-inline")) {
      const fg = parseColour(styleProp(n.attrs.style, "color")), bg = parseColour(styleProp(n.attrs.style, "background(?:-color)?"));
      if (fg && bg && textOf(n, byId).trim()) {
        const fs = parseFloat(styleProp(n.attrs.style, "font-size") || "16"), bold = /bold|[6-9]00/.test(styleProp(n.attrs.style, "font-weight") || "");
        const need = fs >= 24 || (fs >= 18.66 && bold) ? 3 : 4.5;
        const r = ratio(fg, bg);
        if (r < need) add("contrast-inline", sel(n), `contrast ${r.toFixed(2)} < ${need}`);
      }
    }
  }
  // duplicate ids across the whole document (hidden streaming containers included on purpose: ids still collide)
  const seen = new Map();
  for (const n of all) if (n.attrs.id) { seen.set(n.attrs.id, (seen.get(n.attrs.id) || 0) + 1); if (seen.get(n.attrs.id) === 2) add("dup-id", `#${n.attrs.id}`, "duplicate id"); }
  return v;
}

// ---- site scan ----
export function findHtml(dir) {
  const out = [];
  (function rec(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== "_next") rec(p); } else if (e.name.endsWith(".html")) out.push(p); } })(dir);
  return out.sort();
}
export function scanSite(dir, opts) {
  const routes = [];
  for (const f of findHtml(dir)) {
    let r = "/" + path.relative(dir, f).replace(/\.html$/, "").replace(/(^|\/)index$/, "");
    if (r !== "/") r = r.replace(/\/$/, "");
    const v = scanHtml(fs.readFileSync(f, "utf8"), opts);
    routes.push({ route: r, count: v.length, violations: v });
  }
  const byRule = Object.fromEntries(RULES.map((r) => [r, 0]));
  for (const r of routes) for (const x of r.violations) byRule[x.rule]++;
  return { routes, byRule, total: routes.reduce((a, r) => a + r.count, 0) };
}
export function compareBaseline(byRule, base) {
  return RULES.filter((r) => byRule[r] > (base.byRule?.[r] ?? 0)).map((r) => `${r}: ${byRule[r]} > baseline ${base.byRule?.[r] ?? 0}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--baseline") || "out";
  const basePath = val("--baseline") || fileURLToPath(new URL("./a11y_baseline.json", import.meta.url));
  if (!fs.existsSync(dir)) { console.error(`a11y_static: no such dir ${dir}`); process.exit(2); }
  const res = scanSite(dir);
  if (flag("--write-baseline")) { fs.writeFileSync(basePath, JSON.stringify({ note: "STATIC LINT baseline, not a WCAG claim", routes: res.routes.length, total: res.total, byRule: res.byRule }, null, 2) + "\n"); console.log(`baseline written ${basePath}`); }
  if (flag("--json")) console.log(JSON.stringify({ total: res.total, byRule: res.byRule, routes: res.routes }, null, 1));
  else {
    console.log(`A11Y STATIC LINT (not a WCAG conformance claim): ${res.routes.length} routes, ${res.total} violations`);
    console.log("by rule: " + RULES.map((r) => `${r}=${res.byRule[r]}`).join(" "));
    console.log("per route:"); for (const r of res.routes) console.log(`  ${String(r.count).padStart(4)}  ${r.route}`);
    console.log("worst 5:"); for (const r of [...res.routes].sort((a, b) => b.count - a.count).slice(0, 5)) console.log(`  ${r.count}  ${r.route}`);
  }
  if (!fs.existsSync(basePath)) { console.error(`a11y_static: no baseline at ${basePath}`); process.exit(2); }
  const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const over = compareBaseline(res.byRule, base);
  if (over.length) { console.error("OVER BASELINE:\n  " + over.join("\n  ")); process.exit(1); }
  console.log(`within baseline (total ${res.total} <= ${base.total})`);
}
