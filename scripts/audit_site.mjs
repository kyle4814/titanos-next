// Site audit over the static export. Usage: node scripts/audit_site.mjs <outDir(out)> <resultDir> [maxRoutes]
// Per route x viewport (390x844, 1440x900): console errors, page errors, failed requests,
// horizontal overflow, LCP/CLS, low-contrast text count, broken internal links, visible text dump.
// Writes <resultDir>/report.json, text/<route>.txt and shots/<route>-<w>.png.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [, , outDir = "out", resDir = "audit/run", max = "9999"] = process.argv;
const root = path.resolve(outDir);
const walk = (d, acc = []) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.name.startsWith("_") || f.name === "404.html") continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p, acc); else if (f.name.endsWith(".html")) acc.push(p);
  }
  return acc;
};
const routes = walk(root).map((p) => "/" + path.relative(root, p).replace(/\.html$/, "").replace(/^index$/, "")).sort()
  // templated families (offers/*, blog posts etc.): audit the first 3 of each, they share one component
  .filter((r, i, a) => r.split("/").length < 3 || a.filter((x, j) => j < i && x.startsWith(r.split("/").slice(0, 2).join("/") + "/")).length < 3)
  .filter((r) => !process.env.ONLY || process.env.ONLY.split(",").includes(r))
  .slice(0, +max);
const routeSet = new Set(routes.map((r) => r.replace(/\/$/, "") || "/"));

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".txt": "text/plain", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split("?")[0]);
  let f = path.join(root, u);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (u === "/") f = path.join(root, "index.html");
  else if (fs.existsSync(f + ".html")) f += ".html";
  else if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
fs.mkdirSync(path.join(resDir, "shots"), { recursive: true });
fs.mkdirSync(path.join(resDir, "text"), { recursive: true });

const probe = () => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const [r, g, b] = m.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return { l: 0.2126 * r + 0.7152 * g + 0.0722 * b, a: m[3] ?? 1 }; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; const x = lum(c); if (x.a > 0.9) return x.l; } return 0.01; };
  let lowContrast = 0; const lowSamples = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode()); ) {
    if (!n.textContent.trim()) continue; const el = n.parentElement; if (!el) continue;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const f = lum(cs.color); const fg = f.l, bg = bgOf(el);
    const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5) && f.a > 0.5) { lowContrast++; if (lowSamples.length < 4) lowSamples.push(`${n.textContent.trim().slice(0, 30)} ${ratio.toFixed(1)}`); }
  }
  const de = document.documentElement;
  const overflowX = de.scrollWidth - de.clientWidth;
  const offenders = [];
  if (overflowX > 1) for (const el of document.querySelectorAll("body *")) { const r = el.getBoundingClientRect(); if (r.right > de.clientWidth + 1 && r.width > 0 && offenders.length < 3) offenders.push(el.tagName + "." + String(el.className).slice(0, 40)); }
  const imgs = [...document.images].map((i) => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0, noAlt: !i.hasAttribute("alt") }));
  const small = [...document.querySelectorAll("a,button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 24 || r.width < 24) && getComputedStyle(e).display !== "inline"; }).length;
  const hrefs = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
  return { lowContrast, lowSamples, overflowX, offenders, imgs, small, hrefs, h1: document.querySelectorAll("h1").length, title: document.title, lang: de.lang, text: document.body.innerText };
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const report = [];
for (const route of routes) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errs = [], failed = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => errs.push("PAGEERROR " + String(e).slice(0, 160)));
    page.on("requestfailed", (r) => failed.push(r.url().replace(base, "")));
    page.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url().replace(base, "")); });
    await page.addInitScript(() => {
      window.__cls = 0; window.__lcp = 0; window.__shifts = [];
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { window.__cls += e.value; if (e.value > 0.02) window.__shifts.push(`${e.value.toFixed(3)}@${Math.round(e.startTime)} ` + e.sources.map((s) => s.node && (s.node.nodeName + "." + String(s.node.className).slice(0, 40) + " " + Math.round(s.previousRect.y) + ">" + Math.round(s.currentRect.y))).join(" ; ")); } }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    let rec = { route, w };
    try {
      await page.goto(base + route, { waitUntil: "load", timeout: 45000 });
      await page.waitForTimeout(1200);
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
      await page.waitForTimeout(500);
      const p = await page.evaluate(probe);
      const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4), shifts: window.__shifts }));
      const slug = (route === "/" ? "home" : route.slice(1).replace(/\//g, "_"));
      if (w === 390) fs.writeFileSync(path.join(resDir, "text", slug + ".txt"), p.text);
      await page.screenshot({ path: path.join(resDir, "shots", `${slug}-${w}.png`), timeout: 90000, animations: "disabled" });
      const broken = [...new Set(p.hrefs.filter((x) => x.startsWith("/") && !x.startsWith("//")).map((x) => x.split("#")[0].split("?")[0].replace(/\/$/, "") || "/").filter((x) => !routeSet.has(x) && !fs.existsSync(path.join(root, x))))];
      rec = { ...rec, ...m, errs, failed: [...new Set(failed)], lowContrast: p.lowContrast, lowSamples: p.lowSamples, overflowX: p.overflowX, offenders: p.offenders, brokenImgs: p.imgs.filter((i) => !i.ok).map((i) => i.src.replace(base, "")), noAlt: p.imgs.filter((i) => i.noAlt).length, small: p.small, brokenLinks: broken, h1: p.h1, title: p.title, lang: p.lang };
    } catch (e) { rec.fatal = String(e).slice(0, 160); }
    report.push(rec);
    await ctx.close();
  }
}
await browser.close(); server.close();
fs.writeFileSync(path.join(resDir, "report.json"), JSON.stringify(report, null, 1));
const bugs = report.flatMap((r) => [r.fatal && "fatal", ...(r.errs || []).map(() => "console"), ...(r.failed || []).map(() => "req"), r.overflowX > 1 && "overflow", ...(r.brokenImgs || []).map(() => "img"), ...(r.brokenLinks || []).map(() => "link"), r.h1 !== 1 && "h1", !r.title && "title"].filter(Boolean));
const by = {}; for (const b of bugs) by[b] = (by[b] || 0) + 1;
console.log(JSON.stringify({ routes: routes.length, bugs: bugs.length, by, lcpMax: Math.max(...report.map((r) => r.lcp || 0)), clsMax: Math.max(...report.map((r) => r.cls || 0)), lowContrastPages: report.filter((r) => r.lowContrast > 0).length }));
