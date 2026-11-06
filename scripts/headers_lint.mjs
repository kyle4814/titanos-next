// STATIC CONFIG LINT for response headers. NOT a security audit: it reads source text offline (no network,
// no live response is ever fetched) and reports where the configured header set is missing or weak.
// Two surfaces: the static site (app/layout.tsx meta tags, next.config.ts, public/_headers) and the
// portal-api Worker (every `new Response(` header literal and `.headers.set(...)` call under portal-api/src).
//
// Rules: H1 CSP (present, no unsafe-eval, no wildcard script-src) · H2 X-Content-Type-Options nosniff
// H3 Referrer-Policy · H4 frame-ancestors / X-Frame-Options · H5 HSTS on Worker JSON responses
// H6 no Access-Control-Allow-Origin * (or blind origin reflection) · H7 Cache-Control no-store on Worker body responses
// H8 next.config headers() is a no-op under output:"export".
// Static-site headers that Cloudflare adds at the edge cannot be seen offline: they are reported as
// UNVERIFIABLE (info), never as PASS. `--strict` turns UNVERIFIABLE into a failure.
//
// CLI: node scripts/headers_lint.mjs [--root DIR] [--worker DIR] [--json] [--strict]
//   exit 0 = no findings; 1 = findings (or UNVERIFIABLE under --strict); 2 = bad usage.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

// ---------- extraction (pure, text in, facts out) ----------

// Concatenate the string literals of `const CSP = "a" + "b" ...;` (comments between pieces are skipped).
export function extractCsp(text) {
  const m = /const\s+CSP\s*=/.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length, out = "";
  const end = text.length;
  while (i < end) {
    const c = text[i];
    if (c === ";") break;
    if (c === "/" && text[i + 1] === "/") { i = text.indexOf("\n", i); if (i < 0) break; continue; }
    if (c === "/" && text[i + 1] === "*") { i = text.indexOf("*/", i) + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1, s = "";
      while (j < end && text[j] !== c) { if (text[j] === "\\") j++; s += text[j]; j++; }
      out += s; i = j + 1; continue;
    }
    i++;
  }
  return { value: out, line: lineOf(text, m.index) };
}

export function parseCsp(value) {
  const d = {};
  for (const part of value.split(";")) {
    const t = part.trim(); if (!t) continue;
    const [name, ...src] = t.split(/\s+/);
    d[name.toLowerCase()] = src;
  }
  return d;
}

function balanced(text, open) { // index just past the paren matching text[open]==="("
  let depth = 0, q = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i + 1; }
  }
  return text.length;
}

// Every `new Response(...)` in a Worker file: its literal header names, whether it carries a body, whether it is JSON.
export function extractResponses(file, text) {
  const out = [];
  const re = /new Response\(/g; let m;
  while ((m = re.exec(text))) {
    const open = m.index + m[0].length - 1, close = balanced(text, open);
    const args = text.slice(open + 1, close - 1);
    const hm = /headers\s*:\s*\{([^}]*)\}/.exec(args);
    const names = new Set(), values = {};
    if (hm) {
      for (const k of hm[1].matchAll(/["']([A-Za-z][A-Za-z0-9-]*)["']\s*:/g)) names.add(k[1].toLowerCase());
      for (const k of hm[1].matchAll(/["']([A-Za-z][A-Za-z0-9-]*)["']\s*:\s*(["'])((?:\\.|(?!\2).)*)\2/g)) values[k[1].toLowerCase()] = k[3];
    }
    const first = args.trim().split(",")[0].trim();
    const json = /application\/json/i.test(hm ? hm[1] : "") || /^JSON\.stringify/.test(first);
    out.push({ file, line: lineOf(text, m.index), names, values, hasBody: first !== "null" && first !== "", json });
  }
  return out;
}

// `.headers.set("name", value)` / `headers.append(...)` calls: the value expression is kept so H6 can see "*".
export function extractSets(file, text) {
  const out = [];
  for (const m of text.matchAll(/headers\.(?:set|append)\(\s*["']([A-Za-z][A-Za-z0-9-]*)["']\s*,\s*((?:[^()]|\([^()]*\))*)\)/g))
    out.push({ file, line: lineOf(text, m.index), name: m[1].toLowerCase(), expr: m[2].trim() });
  return out;
}

// ---------- rules: each returns findings [{rule, severity, file, line, msg}] ----------
// severity: "fail" (real finding) | "unverifiable" (edge-delivered header, cannot be seen offline) | "info"

const F = (rule, file, line, msg, severity = "fail") => ({ rule, severity, file, line, msg });

function ruleH1(m) {
  const out = [];
  if (!m.site.layout) return [F("H1", "app/layout.tsx", 0, "layout.tsx not found: cannot read the CSP", "unverifiable")];
  const c = m.site.csp;
  if (!c) return [F("H1", m.site.layout.file, 1, "no Content-Security-Policy found (no `const CSP =`)")];
  const d = parseCsp(c.value);
  if (!d["default-src"] && !d["script-src"]) out.push(F("H1", m.site.layout.file, c.line, "CSP has neither default-src nor script-src"));
  const script = d["script-src"] || d["default-src"] || [];
  if (script.some((s) => s.toLowerCase() === "'unsafe-eval'")) out.push(F("H1", m.site.layout.file, c.line, "script-src allows 'unsafe-eval'"));
  if (script.some((s) => ["*", "https:", "http:", "data:"].includes(s.toLowerCase()) || /^(https?:\/\/)?\*\./.test(s))) out.push(F("H1", m.site.layout.file, c.line, "script-src is a wildcard or scheme-only source"));
  if (script.some((s) => s.toLowerCase() === "'unsafe-inline'")) out.push(F("H1", m.site.layout.file, c.line, "script-src allows 'unsafe-inline' (documented as required by the Next static export; a hash or nonce is the fix)", "info"));
  return out;
}

function inHeadersFile(m, header) {
  return !!m.site.headersFile && new RegExp("^\\s*" + header + "\\s*:", "im").test(m.site.headersFile.text);
}

// Worker: a header passes if some wrapper sets it on every response (file-tree-wide .headers.set, an approximation)
// or if the response's own literal carries it. Responses with no headers literal fail.
function workerMissing(m, rule, header, what, { jsonOnly = false, bodyOnly = false, valueTest = null } = {}) {
  if (m.worker.sets.some((s) => s.name === header && (!valueTest || valueTest(s.expr)))) return [];
  return m.worker.responses
    .filter((r) => (!jsonOnly || r.json) && (!bodyOnly || r.hasBody))
    .filter((r) => !r.names.has(header) || (valueTest && !valueTest(r.values[header] ?? "")))
    .map((r) => F(rule, r.file, r.line, `Worker response lacks ${what}`));
}

function ruleH2(m) {
  const out = [];
  if (!inHeadersFile(m, "x-content-type-options")) out.push(F("H2", "app/layout.tsx", 0, "site X-Content-Type-Options is edge-only (Cloudflare Managed Transform): not provable offline, no repo-owned _headers entry", "unverifiable"));
  return out.concat(workerMissing(m, "H2", "x-content-type-options", "x-content-type-options: nosniff", { bodyOnly: true, valueTest: (v) => /nosniff/i.test(v) }));
}

function ruleH3(m) {
  const out = [];
  if (m.site.layout && !inHeadersFile(m, "referrer-policy") && !m.site.metaReferrer) out.push(F("H3", "app/layout.tsx", 0, "site has no Referrer-Policy meta tag and no _headers entry"));
  return out.concat(workerMissing(m, "H3", "referrer-policy", "referrer-policy", { bodyOnly: true }));
}

function ruleH4(m) {
  const out = [];
  const framed = !!m.site.headersFile && /^\s*(x-frame-options|content-security-policy[^\n]*frame-ancestors)/im.test(m.site.headersFile.text);
  if (!framed) {
    const csp = m.site.csp && parseCsp(m.site.csp.value);
    out.push(F("H4", m.site.layout?.file || "app/layout.tsx", m.site.csp?.line || 0, csp && csp["frame-ancestors"] ? "frame-ancestors sits in a META CSP, which browsers ignore (W3C); only an HTTP header counts" : "site has no frame-ancestors or X-Frame-Options in repo config: clickjacking protection is edge-only (Cloudflare) and not provable offline", "unverifiable"));
  }
  if (m.worker.sets.some((s) => s.name === "x-frame-options" || s.name === "content-security-policy")) return out;
  return out.concat(m.worker.responses
    .filter((r) => r.hasBody && !r.names.has("x-frame-options") && !r.names.has("content-security-policy"))
    .map((r) => F("H4", r.file, r.line, "Worker response has neither x-frame-options nor a content-security-policy with frame-ancestors")));
}

function ruleH5(m) {
  return workerMissing(m, "H5", "strict-transport-security", "strict-transport-security", { jsonOnly: true });
}

function ruleH6(m) {
  const out = [];
  for (const s of m.worker.sets) {
    if (s.name !== "access-control-allow-origin") continue;
    if (/^["']\*["']$/.test(s.expr)) out.push(F("H6", s.file, s.line, 'access-control-allow-origin set to "*"'));
    else if (/\b(?:req|request)\.headers\.get\(\s*["']origin["']\s*\)/i.test(s.expr)) out.push(F("H6", s.file, s.line, "access-control-allow-origin reflects the request Origin with no allowlist"));
  }
  for (const r of m.worker.responses) if (r.values["access-control-allow-origin"] === "*") out.push(F("H6", r.file, r.line, 'response literal sets access-control-allow-origin to "*"'));
  if (m.site.headersFile && /access-control-allow-origin\s*:\s*\*/i.test(m.site.headersFile.text)) out.push(F("H6", m.site.headersFile.file, 1, "_headers sets access-control-allow-origin: *"));
  return out;
}

function ruleH7(m) {
  return workerMissing(m, "H7", "cache-control", "cache-control: no-store", { bodyOnly: true, valueTest: (v) => /no-store/i.test(v) });
}

function ruleH8(m) {
  const n = m.site.nextConfig;
  if (!n) return [];
  const code = n.text.replace(/\/\/.*$/gm, "");
  const exp = /output\s*:\s*["']export["']/.test(code);
  const hm = /(?:async\s+)?headers\s*\(\s*\)\s*\{/.exec(code);
  return exp && hm ? [F("H8", n.file, lineOf(code, hm.index), 'next.config headers() is a no-op under output:"export"')] : [];
}

export const RULES = { H1: ruleH1, H2: ruleH2, H3: ruleH3, H4: ruleH4, H5: ruleH5, H6: ruleH6, H7: ruleH7, H8: ruleH8 };

// ---------- model + run ----------

export function buildModel({ layout = null, nextConfig = null, headersFile = null, workerFiles = [] }) {
  return {
    site: { layout, nextConfig, headersFile, csp: layout ? extractCsp(layout.text) : null, metaReferrer: !!layout && /<meta\s+name=["']referrer["']\s+content=["'][^"']+["']/.test(layout.text) },
    worker: {
      responses: workerFiles.flatMap((f) => extractResponses(f.file, f.text)),
      sets: workerFiles.flatMap((f) => extractSets(f.file, f.text)),
    },
  };
}

// opts.disable: rule ids to switch off. opts.rules: replacement rule table (used by the mutant test).
export function lintHeaders(sources, opts = {}) {
  const model = buildModel(sources), table = opts.rules || RULES, off = new Set(opts.disable || []);
  const findings = [];
  for (const [id, fn] of Object.entries(table)) if (!off.has(id)) findings.push(...fn(model));
  return findings;
}

export function loadSources(root, workerDir) {
  const rd = (rel) => { const p = path.join(root, rel); return fs.existsSync(p) ? { file: rel, text: fs.readFileSync(p, "utf8") } : null; };
  const wd = workerDir || path.join(root, "portal-api", "src");
  const workerFiles = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|mjs|js)$/.test(e.name)) workerFiles.push({ file: path.relative(root, p), text: fs.readFileSync(p, "utf8") });
    }
  };
  if (fs.existsSync(wd)) walk(wd);
  return { layout: rd("app/layout.tsx"), nextConfig: rd("next.config.ts"), headersFile: rd("public/_headers"), workerFiles };
}

export function render(findings, { workerSeen }) {
  const lines = ["HEADERS LINT (static config lint, offline, NOT a security audit)", `worker surface scanned: ${workerSeen ? "yes" : "NO (portal-api/src not found: Worker rules saw nothing)"}`];
  for (const sev of ["fail", "unverifiable", "info"]) {
    const g = findings.filter((f) => f.severity === sev);
    lines.push(`${sev.toUpperCase()}: ${g.length}`);
    for (const f of g) lines.push(`  ${f.rule} ${f.file}:${f.line} ${f.msg}`);
  }
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), val = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const known = new Set(["--root", "--worker", "--json", "--strict"]);
  const bad = a.find((x) => x.startsWith("--") && !known.has(x));
  if (bad) { console.error("headers_lint: unknown flag " + bad); process.exit(2); }
  const root = path.resolve(val("--root") || process.cwd());
  const src = loadSources(root, val("--worker") ? path.resolve(val("--worker")) : undefined);
  const findings = lintHeaders(src);
  const workerSeen = src.workerFiles.length > 0;
  console.log(a.includes("--json") ? JSON.stringify({ workerSeen, findings }, null, 2) : render(findings, { workerSeen }));
  const fails = findings.filter((f) => f.severity === "fail" || (a.includes("--strict") && f.severity === "unverifiable"));
  process.exit(fails.length ? 1 : 0);
}
