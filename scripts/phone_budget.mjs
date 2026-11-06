// Phone budget (plan C1, "result in under 10 s on a phone"): static half. Everything printed is MODELLED, never OBSERVED.
// Real-phone timing (WebPageTest / Lighthouse on a device, against the live site) stays PENDING LIVE.
//
// Usage: node scripts/phone_budget.mjs [outDir=out] [--routes /,/scan] [--json file] [--md file]
// Reads the built static export (never builds, never deploys). Default routes: / and /scan, plus every
// exported route under /scan/* or /our-scan* (scan result routes) found in the export.
//
// Per route: HTML + every asset the HTML references (stylesheets, scripts, preloaded or CSS-referenced fonts, images,
// source/srcset), each gzip-estimated (text types: gzip level 9 of the file; woff2/images/other binary: raw size, already compressed).
// <script noModule> is skipped (every phone browser here has module support; same rule as scripts/js_budget.mjs).
//
// MODELLED time-to-interactive, slow-4G phone profile (BW 1.6 Mbps, RTT 150 ms, CPU 4x slowdown):
//   connect   = 3 * RTT                               (DNS + TCP + TLS handshake, no reuse)
//   html      = RTT + html_gz_bytes * 8 / BW           (request + download of the document)
//   waves     = ceil(critical_requests / 6) * RTT      (6 parallel fetches per wave, assets discovered after the HTML)
//   transfer  = critical_gz_bytes * 8 / BW             (CSS + JS + fonts share the one link; images are not on the path to interactive)
//   cpu       = CPU_SLOWDOWN * js_raw_bytes / 1024 * MS_PER_KB_JS   (parse + execute, MS_PER_KB_JS = 1.0 ms/KB on a desktop-class core)
//   TTI       = connect + html + waves + transfer + cpu
// Every term is non-decreasing in bytes, so TTI is monotone in bytes (tested). Constants are assumptions, stated here, not measurements.
//
// Budgets (per route, guest path): total JS gzip <= 170 KB, requests <= 30, third-party hosts = 0, MODELLED TTI <= 10 s.
// Exit 1 if any route fails.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

export const PROFILE = { name: "slow-4G phone", bwMbps: 1.6, rttMs: 150, cpuSlowdown: 4, msPerKbJs: 1.0, parallel: 6 };
export const BUDGET = { jsGzKB: 170, requests: 30, thirdPartyHosts: 0, ttiS: 10 };
export const FIRST_PARTY = new Set(["titanos.tech", "www.titanos.tech"]);

const TEXT = /\.(html|js|mjs|css|json|svg|txt|xml)$/i;
const gzLen = (buf, file) => (TEXT.test(file) ? zlib.gzipSync(buf, { level: 9 }).length : buf.length);

/** MODELLED time-to-interactive in seconds. m = { htmlGz, criticalGz, criticalRequests, jsRaw } (bytes, count). */
export function modelTti(m, p = PROFILE) {
  const bps = (p.bwMbps * 1e6) / 8; // bytes per second
  const rtt = p.rttMs / 1000;
  const connect = 3 * rtt;
  const html = rtt + m.htmlGz / bps;
  const waves = Math.ceil(m.criticalRequests / p.parallel) * rtt;
  const transfer = m.criticalGz / bps;
  const cpu = (p.cpuSlowdown * (m.jsRaw / 1024) * p.msPerKbJs) / 1000;
  return { connect, html, waves, transfer, cpu, tti: connect + html + waves + transfer + cpu };
}

function routeFile(out, route) {
  const r = route.replace(/^\/+|\/+$/g, "");
  const c = r === "" ? ["index.html"] : [`${r}.html`, path.join(r, "index.html")];
  return c.map((x) => path.join(out, x)).find((f) => fs.existsSync(f));
}

function localPath(out, url) {
  const u = url.split("#")[0].split("?")[0];
  if (!u.startsWith("/")) return null;
  const f = path.join(out, decodeURIComponent(u));
  return f.startsWith(out) && fs.existsSync(f) && fs.statSync(f).isFile() ? f : null;
}

export function measureRoute(out, route, { allowedHosts = FIRST_PARTY } = {}) {
  out = path.resolve(out);
  const file = routeFile(out, route);
  if (!file) return { route, missing: true, pass: false, fails: ["route not found in export"] };
  const html = fs.readFileSync(file, "utf8");
  const found = new Map(); // url -> {kind, critical, blocking}
  const add = (url, kind, critical, blocking = false) => {
    if (!url || url.startsWith("data:") || url.startsWith("blob:")) return;
    const prev = found.get(url);
    if (prev) { prev.critical ||= critical; prev.blocking ||= blocking; return; }
    found.set(url, { kind, critical, blocking });
  };
  const attr = (tag, n) => (tag.match(new RegExp(`\\s${n}\\s*=\\s*"([^"]*)"`, "i")) || [])[1];
  const has = (tag, n) => new RegExp(`\\s${n}(\\s|=|/?>)`, "i").test(tag);
  const head = html.slice(0, Math.max(html.indexOf("</head>"), 0) || html.length);
  const beforeBody = (idx) => idx < head.length;

  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    const t = m[0], src = attr(t, "src");
    if (!src || has(t, "noModule")) continue;
    const blocking = !has(t, "async") && !has(t, "defer") && !/type\s*=\s*"module"/i.test(t) && beforeBody(m.index);
    add(src, "js", true, blocking);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0], href = attr(t, "href"), rel = (attr(t, "rel") || "").toLowerCase(), as = (attr(t, "as") || "").toLowerCase();
    if (!href) continue;
    if (rel === "stylesheet") add(href, "css", true, !attr(t, "media") || attr(t, "media") === "all");
    else if (rel === "preload" || rel === "modulepreload") add(href, as === "font" ? "font" : as === "script" || rel === "modulepreload" ? "js" : as === "style" ? "css" : as === "image" ? "img" : "other", as !== "image");
  }
  for (const m of html.matchAll(/<(img|source|video|iframe)\b[^>]*>/gi)) {
    const t = m[0], src = attr(t, "src") || (attr(t, "srcset") || "").split(",")[0].trim().split(/\s+/)[0];
    if (src) add(src, m[1].toLowerCase() === "iframe" ? "other" : "img", false);
  }
  // CSS-referenced fonts are NOT counted unless preloaded: @font-face subsets carry unicode-range, so the browser fetches only the ones the page uses.
  // They are listed in cssOnlyFonts (an unpreloaded font can still cost a late request). Third-party url() in CSS is counted as a host.
  const cssOnlyFonts = new Set();
  for (const [u, a] of [...found]) {
    if (a.kind !== "css") continue;
    const f = localPath(out, u);
    if (!f) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      const x = m[1];
      if (/^(https?:)?\/\//.test(x)) add(x, "other", false);
      else if (/\.(woff2?|ttf|otf)(\?|$)/i.test(x) && !x.startsWith("data:")) {
        const abs = "/" + path.relative(out, path.resolve(path.dirname(f), x)).split(path.sep).join("/");
        if (!found.has(abs)) cssOnlyFonts.add(abs);
      }
    }
  }

  const hosts = new Set();
  const assets = [];
  let jsRaw = 0;
  const unresolved = [];
  for (const [url, a] of found) {
    let host = null;
    if (/^(https?:)?\/\//.test(url)) host = new URL(url.startsWith("//") ? "https:" + url : url).host;
    if (host && !allowedHosts.has(host)) { hosts.add(host); assets.push({ url, ...a, bytes: 0, gz: 0, thirdParty: true }); continue; }
    const f = localPath(out, host ? new URL(url.startsWith("//") ? "https:" + url : url).pathname : url);
    if (!f) { unresolved.push(url); continue; }
    const buf = fs.readFileSync(f);
    if (a.kind === "js") jsRaw += buf.length;
    assets.push({ url, ...a, bytes: buf.length, gz: gzLen(buf, f) });
  }
  const htmlBuf = Buffer.from(html);
  const htmlGz = gzLen(htmlBuf, file);
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  const jsGz = sum(assets.filter((a) => a.kind === "js"), "gz");
  const crit = assets.filter((a) => a.critical);
  const totalGz = htmlGz + sum(assets, "gz");
  const requests = 1 + assets.length;
  const model = modelTti({ htmlGz, criticalGz: sum(crit, "gz"), criticalRequests: crit.length, jsRaw });
  const blocking = assets.filter((a) => a.blocking && a.kind === "js").map((a) => a.url);
  const blockingCss = assets.filter((a) => a.blocking && a.kind === "css").map((a) => a.url);
  const top3 = [{ url: route + " (html)", kind: "html", gz: htmlGz }, ...assets].sort((a, b) => b.gz - a.gz).slice(0, 3).map((a) => ({ url: a.url, kind: a.kind, gzKB: +(a.gz / 1024).toFixed(1) }));
  const fails = [];
  if (jsGz / 1024 > BUDGET.jsGzKB) fails.push(`JS gzip ${(jsGz / 1024).toFixed(1)} KB > ${BUDGET.jsGzKB} KB`);
  if (requests > BUDGET.requests) fails.push(`requests ${requests} > ${BUDGET.requests}`);
  if (hosts.size > BUDGET.thirdPartyHosts) fails.push(`third-party hosts ${hosts.size}: ${[...hosts].join(", ")}`);
  if (model.tti > BUDGET.ttiS) fails.push(`MODELLED TTI ${model.tti.toFixed(1)} s > ${BUDGET.ttiS} s`);
  if (unresolved.length) fails.push(`${unresolved.length} referenced asset(s) missing from export`);
  return {
    route, label: "MODELLED", jsGzKB: +(jsGz / 1024).toFixed(1), totalGzKB: +(totalGz / 1024).toFixed(1), requests,
    thirdPartyHosts: [...hosts], cssOnlyFonts: cssOnlyFonts.size, renderBlockingScripts: blocking, renderBlockingCss: blockingCss, unresolved,
    modelledTtiS: +model.tti.toFixed(2), ttiTerms: Object.fromEntries(Object.entries(model).map(([k, v]) => [k, +v.toFixed(2)])),
    top3, pass: fails.length === 0, fails,
  };
}

export function discoverRoutes(out, explicit) {
  if (explicit?.length) return explicit;
  out = path.resolve(out);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const extra = walk(out).filter((f) => f.endsWith(".html")).map((f) => "/" + path.relative(out, f).replace(/\.html$/, "").replace(/\/index$/, ""))
    .filter((r) => /^\/(scan|our-scan)(\/|$)/.test(r));
  return [...new Set(["/", "/scan", ...extra])];
}

export function toMarkdown(res, out) {
  const L = [`# Phone budget (MODELLED, not OBSERVED; real-phone timing PENDING LIVE)`, ``,
    `Profile: ${PROFILE.name}, ${PROFILE.bwMbps} Mbps, ${PROFILE.rttMs} ms RTT, ${PROFILE.cpuSlowdown}x CPU. Export: ${out}`,
    `Budgets: JS gzip <= ${BUDGET.jsGzKB} KB, requests <= ${BUDGET.requests}, third-party hosts = ${BUDGET.thirdPartyHosts}, MODELLED TTI <= ${BUDGET.ttiS} s.`, ``,
    `| Route | JS gz KB | Total gz KB | Requests | 3rd-party hosts | Render-blocking scripts | MODELLED TTI s | Result |`, `|---|---|---|---|---|---|---|---|`];
  for (const r of res) L.push(r.missing ? `| ${r.route} | - | - | - | - | - | - | FAIL (not in export) |`
    : `| ${r.route} | ${r.jsGzKB} | ${r.totalGzKB} | ${r.requests} | ${r.thirdPartyHosts.length} | ${r.renderBlockingScripts.length} | ${r.modelledTtiS} | ${r.pass ? "PASS" : "FAIL"} |`);
  L.push(``);
  for (const r of res.filter((x) => !x.missing)) {
    L.push(`## ${r.route}`, `Largest 3 assets (gzip-estimated): ${r.top3.map((a) => `${a.url} ${a.gzKB} KB`).join("; ")}`);
    if (r.thirdPartyHosts.length) L.push(`Third-party hosts: ${r.thirdPartyHosts.join(", ")}`);
    if (r.renderBlockingScripts.length) L.push(`Render-blocking scripts: ${r.renderBlockingScripts.join(", ")}`);
    if (r.renderBlockingCss.length) L.push(`Render-blocking CSS: ${r.renderBlockingCss.length} stylesheet(s)`);
    if (r.fails.length) L.push(`FAIL: ${r.fails.join("; ")}`);
    L.push(``);
  }
  return L.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a.splice(i, 2)[1] : null; };
  const routes = opt("--routes"), jf = opt("--json"), mf = opt("--md");
  const out = path.resolve(a[0] || "out");
  if (!fs.existsSync(out)) { console.error(`no export at ${out}; build locally first (npm run build), never deploy`); process.exit(2); }
  const res = discoverRoutes(out, routes ? routes.split(",") : null).map((r) => measureRoute(out, r));
  const md = toMarkdown(res, out);
  if (jf) fs.writeFileSync(jf, JSON.stringify({ label: "MODELLED", profile: PROFILE, budget: BUDGET, export: out, routes: res }, null, 2));
  if (mf) fs.writeFileSync(mf, md);
  console.log(md);
  process.exit(res.every((r) => r.pass) ? 0 : 1);
}
