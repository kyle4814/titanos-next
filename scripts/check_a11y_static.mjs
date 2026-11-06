// Static accessibility checker for X-Ray and Trust Centre page sources (TSX/JSX). Run via `npm test`.
// Rules: input-label, img-alt, heading-skip, button-text, html-lang, main-landmark, tabindex-positive, contrast.
// Usage: node scripts/check_a11y_static.mjs [--root DIR] [--files a,b] [--json] [--quiet]
// Heuristic, regex/tokenizer based: it flags what it can prove from source. It is not a rendered audit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET_DIRS = ["app/x-ray", "app/xray", "app/trust", "app/trust-centre"];
const TARGET_COMP = /^(Xray|XRay|Trust)[A-Za-z]*\.(tsx|jsx)$/;

// ---------- contrast ----------
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function loadTokens(css) {
  const raw = {};
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)) raw[m[1]] = m[2].trim();
  const res = (n, d = 0) => {
    let v = raw[n]; if (v == null || d > 5) return null;
    const ref = v.match(/^var\(--([a-z0-9-]+)\)$/i); if (ref) return res(ref[1], d + 1);
    return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
  };
  const out = {}; for (const k of Object.keys(raw)) { const r = res(k); if (r) out[k] = r; }
  return out;
}
const toHex = (val, tok) => {
  val = val.trim();
  let m = val.match(/^var\(--([a-z0-9-]+)\)$/i); if (m) return tok[m[1]] || null;
  m = val.match(/^#([0-9a-f]{6})$/i); if (m) return "#" + m[1];
  m = val.match(/^#([0-9a-f]{3})$/i); if (m) return "#" + [...m[1]].map((c) => c + c).join("");
  return null; // rgba / gradients / transparent: unknowable statically
};
const SURFACES = ["vault-black", "vault-warm"]; // page canvas and card surface

// ---------- tokenizer ----------
const lineOf = (src, i) => src.slice(0, i).split("\n").length;
function tags(src) { // opening tags with brace-aware attribute scan
  const out = []; const re = /<([A-Za-z][A-Za-z0-9.]*)(?=[\s/>])/g; let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 0, q = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (q) { if (c === q && src[i - 1] !== "\\") q = null; continue; }
      if (depth > 0 && (c === '"' || c === "'" || c === "`")) { q = c; continue; }
      if (c === "{") depth++; else if (c === "}") depth--;
      else if (depth === 0 && c === ">" ) break;
      else if (depth === 0 && (c === '"' || c === "'")) { q = c; }
    }
    if (i >= src.length) continue;
    const attrs = src.slice(re.lastIndex, i);
    out.push({ name: m[1], attrs, start: m.index, end: i + 1, selfClose: /\/\s*$/.test(attrs) });
  }
  return out;
}
const hasAttr = (a, n) => new RegExp(`(^|[\\s{])${n}(\\s*=|\\s|/|$)`, "i").test(a);
const attrVal = (a, n) => { const m = a.match(new RegExp(`(?:^|\\s)${n}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`, "i")); return m ? (m[1] ?? m[2] ?? m[3]) : null; };
const closeIndex = (src, tag, from) => { // matching close of same-named tag, nesting aware
  const re = new RegExp(`<(/?)${tag.replace(".", "\\.")}(?=[\\s/>])`, "g"); re.lastIndex = from; let d = 1, m;
  while ((m = re.exec(src))) {
    if (m[1]) { if (--d === 0) return m.index; }
    else { const e = src.indexOf(">", m.index); if (src[e - 1] !== "/") d++; }
  }
  return -1;
};

// ---------- rules ----------
export function checkSource(src, file, tok, opts = {}) {
  const f = []; const add = (i, rule, msg) => f.push({ file, line: lineOf(src, i), rule, msg });
  const T = tags(src);
  const text = src.replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, " "));
  // label-wrapper components: defined in this file with a <label in the body (e.g. Field)
  const wrappers = new Set();
  for (const m of src.matchAll(/function\s+([A-Z][A-Za-z0-9]*)\s*\(([\s\S]*?)\n\}/g)) if (/<label[\s>]/.test(m[0])) wrappers.add(m[1]);
  for (const m of src.matchAll(/const\s+([A-Z][A-Za-z0-9]*)\s*=\s*\(([\s\S]*?)\n\};?/g)) if (/<label[\s>]/.test(m[0])) wrappers.add(m[1]);
  const enclosing = (t, names) => T.some((o) => names.includes(o.name) && !o.selfClose && o.end <= t.start && (() => { const c = closeIndex(src, o.name, o.end); return c > t.start; })());

  const ids = new Set(); const forIds = new Set();
  for (const t of T) { if (t.name === "label") { const h = attrVal(t.attrs, "htmlFor"); if (h) forIds.add(h.replace(/[{}"'`]/g, "")); } }
  for (const t of T) {
    const n = t.name, a = t.attrs;
    if (["input", "select", "textarea"].includes(n)) {
      const type = (attrVal(a, "type") || "").replace(/["']/g, "").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      const id = attrVal(a, "id")?.replace(/[{}"'`]/g, "");
      const named = hasAttr(a, "aria-label") || hasAttr(a, "aria-labelledby") || hasAttr(a, "title") || (id && forIds.has(id)) || enclosing(t, ["label", ...wrappers]);
      if (!named) add(t.start, "input-label", `<${n}> has no label (wrap in <label>, htmlFor+id, or aria-label)`);
    }
    if (n === "img" || n === "Image") if (!hasAttr(a, "alt")) add(t.start, "img-alt", `<${n}> has no alt attribute (use alt="" if decorative)`);
    if (hasAttr(a, "tabIndex") || hasAttr(a, "tabindex")) {
      const v = attrVal(a, "tabIndex") ?? attrVal(a, "tabindex"); const k = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
      if (k > 0) add(t.start, "tabindex-positive", `tabIndex=${k} breaks natural focus order`);
    }
    if (n === "button" && !t.selfClose) {
      const c = closeIndex(src, "button", t.end); const inner = c < 0 ? "" : src.slice(t.end, c);
      const visible = inner.replace(/<[^>]*>/g, " ").replace(/\{\s*\}/g, " ").trim();
      const labelled = hasAttr(a, "aria-label") || hasAttr(a, "aria-labelledby") || hasAttr(a, "title") || /<[A-Za-z][^>]*\baria-label\b/.test(inner) || /<img[^>]*\balt=["'][^"']+["']/.test(inner);
      if (!visible && !labelled) add(t.start, "button-text", "<button> has no text or accessible name");
    }
  }
  // headings: skipped levels within the file, in source order
  let prev = 0;
  for (const t of T) { const m = t.name.match(/^h([1-6])$/); if (!m) continue; const lv = +m[1]; if (prev && lv > prev + 1) add(t.start, "heading-skip", `heading jumps h${prev} to h${lv}`); prev = lv; }
  // lang + main: root layout and page files
  const base = path.basename(file);
  if (opts.layout || /^layout\.(tsx|jsx)$/.test(base)) {
    const h = T.find((t) => t.name === "html"); if (h && !hasAttr(h.attrs, "lang")) add(h.start, "html-lang", "<html> has no lang attribute");
  }
  // contrast: style objects with colour + optional background in same literal
  const isLarge = (obj) => { const fs = obj.match(/fontSize\s*:\s*("?)([^,}\n]+)/); if (!fs) return false; const v = fs[2].trim().replace(/"$/, "");
    if (/var\(--fs-(h1|h2|display)\)/.test(v)) return true; const px = v.match(/^(\d+(?:\.\d+)?)(px)?$/); const bold = /fontWeight\s*:\s*(700|800|900|"bold"|"?[6-9]00"?)/.test(obj);
    return !!px && (+px[1] >= 24 || (bold && +px[1] >= 18.66)); };
  const objRe = /(?:\{|,)\s*(?:[^{}]*?\b)?(color)\s*:\s*"([^"]+)"[^{}]*\}/g;
  const seen = new Set();
  for (const m of text.matchAll(/\{[^{}]*\bcolor\s*:\s*["'][^"']+["'][^{}]*\}/g)) {
    const obj = m[0]; const idx = m.index;
    const fg = toHex(obj.match(/[\s{,]color\s*:\s*["']([^"']+)["']/)[1], tok); if (!fg) continue;
    const bgRaw = obj.match(/[\s{,]background(?:Color)?\s*:\s*["']([^"']+)["']/)?.[1];
    const bg = bgRaw ? toHex(bgRaw, tok) : null; if (bgRaw && !bg) continue; // gradient/rgba: unknown, skip
    const need = isLarge(obj) ? 3 : 4.5;
    const bgs = bg ? [["its background", bg]] : SURFACES.map((s) => [`--${s}`, tok[s]]).filter((x) => x[1]);
    for (const [nm, h] of bgs) {
      const r = ratio(fg, h); const key = `${idx}${nm}`; if (seen.has(key)) continue; seen.add(key);
      if (r < need) add(idx, "contrast", `${obj.match(/color\s*:\s*["']([^"']+)["']/)[1]} on ${nm} is ${r.toFixed(2)}:1, needs ${need}:1`);
    }
  }
  // JSX page main landmark handled by caller (needs layout)
  if (opts.page) { if (!/<main[\s>]/.test(src) && !/role\s*=\s*["']main["']/.test(src) && !opts.layoutHasMain) add(0, "main-landmark", "page has no <main> landmark and the root layout provides none"); }
  return f;
}

// ---------- file discovery ----------
export function discover(root) {
  const out = []; const walk = (d) => { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(tsx|jsx)$/.test(e.name)) out.push(p); } };
  for (const d of TARGET_DIRS) walk(path.join(root, d));
  const cd = path.join(root, "components"); if (fs.existsSync(cd)) for (const e of fs.readdirSync(cd)) if (TARGET_COMP.test(e)) out.push(path.join(cd, e));
  return out;
}

export function run(root, files) {
  const css = fs.readFileSync(path.join(fs.existsSync(path.join(root, "app/globals.css")) ? root : path.join(HERE, ".."), "app/globals.css"), "utf8");
  const tok = loadTokens(css);
  const lay = ["app/layout.tsx"].map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
  const layoutSrc = lay ? fs.readFileSync(lay, "utf8") : "";
  const layoutHasMain = /<main[\s>]/.test(layoutSrc);
  const findings = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8"); const rel = path.relative(root, f);
    findings.push(...checkSource(src, rel, tok, { page: /(^|\/)page\.(tsx|jsx)$/.test(rel), layoutHasMain }));
  }
  if (lay) findings.push(...checkSource(layoutSrc, path.relative(root, lay), tok, { layout: true }).filter((x) => x.rule === "html-lang"));
  return { findings, tok, files };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2); const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const root = path.resolve(get("--root") || path.join(HERE, ".."));
  const files = get("--files") ? get("--files").split(",").map((x) => path.resolve(root, x)) : discover(root);
  if (!files.length) { console.log(`a11y-static: no X-Ray or Trust Centre sources under ${root} (nothing to check; pages land on branches e4_xraysite and f05_trust_centre)`); process.exit(0); }
  const { findings } = run(root, files);
  if (argv.includes("--json")) console.log(JSON.stringify(findings, null, 1));
  else { console.log("| file | line | rule | detail |\n|---|---|---|---|"); for (const x of findings) console.log(`| ${x.file} | ${x.line} | ${x.rule} | ${x.msg} |`); }
  console.log(`a11y-static: ${files.length} files, ${findings.length} findings`);
  process.exit(findings.length ? 1 : 0);
}
