// W6 QA gate. Usage: node scripts/qa_gate.mjs [outDir=out] [reportDir]
// Serves the static export, then per route at 390/768/1440: console errors, horizontal overflow, CLS, LCP,
// axe-core a11y (if installed), internal broken links; plus first-load JS gzip. Dumps visible text per route
// to <reportDir>/text/ for content_lint and the doctrine-leak test. Writes <reportDir>/qa.json.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const OUT = path.resolve(process.argv[2] || "out");
const REP = path.resolve(process.argv[3] || "qa-report");
fs.mkdirSync(path.join(REP, "text"), { recursive: true });
fs.mkdirSync(path.join(REP, "shots"), { recursive: true });
let axeSrc = null;
try { axeSrc = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8"); } catch {}

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(OUT);
const ONLY = process.env.ROUTES ? process.env.ROUTES.split(",") : null;
const routes0 = files.filter((f) => f.endsWith(".html") && !/404|_not-found/.test(f))
  .map((f) => { let r = "/" + path.relative(OUT, f).replace(/\\/g, "/").replace(/\.html$/, ""); r = r.replace(/\/index$/, "") || "/"; return r; })
  .filter((r) => !r.startsWith("/_next")).sort();
const routes = ONLY ? routes0.filter((r) => ONLY.includes(r)) : routes0;
const exists = (p) => { const b = path.join(OUT, p); return fs.existsSync(b) && fs.statSync(b).isFile() ? b : fs.existsSync(b + ".html") ? b + ".html" : fs.existsSync(path.join(b, "index.html")) ? path.join(b, "index.html") : null; };
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".txt": "text/plain", ".xml": "application/xml" };
const srv = http.createServer((q, s) => {
  const p = decodeURIComponent(q.url.split("?")[0].split("#")[0]);
  const f = exists(p);
  if (!f) { s.writeHead(404); return s.end("nf"); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(s);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;

const WIDTHS = [[390, 844], [768, 1024], [1440, 900]];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-gpu"] });
const results = [], brokenLinks = [];
const seenLinks = new Set();
for (const route of routes) {
  const r = { route, widths: {} };
  for (const [w, h] of WIDTHS) {
    let ctx;
    try {
    ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [], jsBytes = { n: 0 };
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => !/Transition was skipped/.test(String(e)) && errs.push("pageerror: " + String(e).slice(0, 160)));
    page.on("requestfailed", (q) => { if (!/ERR_ABORTED/.test(q.failure()?.errorText || "")) errs.push("requestfailed: " + q.url().slice(0, 100)); });
    await page.addInitScript(() => {
      window.__cls = 0; window.__lcp = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(base + route, { waitUntil: "load", timeout: 60000 }).catch((e) => errs.push("goto: " + e.message.slice(0, 100)));
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => ({
      cls: window.__cls, lcp: window.__lcp,
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      bsw: document.body.scrollWidth,
    }));
    const stub = await page.evaluate(() => document.documentElement.id === "__next_error__");
    const entry = { stub, errors: errs, cls: +m.cls.toFixed(4), lcp: Math.round(m.lcp), overflow: Math.max(m.sw, m.bsw) - m.cw };
    if (w === 390) {
      entry.text = await page.evaluate(() => document.body.innerText);
      fs.writeFileSync(path.join(REP, "text", (route === "/" ? "index" : route.slice(1).replace(/\//g, "__")) + ".txt"), entry.text);
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
      for (const l of links) {
        if (/^(mailto:|tel:|#|javascript:)/.test(l) || /^https?:\/\/(?!(www\.)?titanos\.tech)/.test(l)) continue;
        const p = l.replace(/^https?:\/\/(www\.)?titanos\.tech/, "").split("#")[0].split("?")[0] || "/";
        const key = route + "→" + p; if (seenLinks.has(key)) continue; seenLinks.add(key);
        const target = p.startsWith("/") ? p : path.posix.join(route, p);
        if (target !== "/" && !exists(target) && !exists(target.replace(/\/$/, ""))) brokenLinks.push({ from: route, href: l });
      }
      if (axeSrc) {
        await page.waitForTimeout(2500);
        await page.evaluate(axeSrc);
        const ax = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "best-practice"].slice(0, 2) }); return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, ex: v.nodes.slice(0, 2).map((n) => n.target.join(" ").slice(0, 80)) })); });
        entry.axe = ax;
      }
    }
    if (["/", "/proof", "/about"].includes(route) || r.route === routes[0]) {
      await page.screenshot({ path: path.join(REP, "shots", `${route === "/" ? "index" : route.slice(1).replace(/\//g, "__")}-${w}.png`) });
    }
    delete entry.text;
    r.widths[w] = entry;
    } catch (e) { r.widths[w] = { errors: ["gate: " + String(e.message).slice(0, 150)], cls: 0, lcp: 0, overflow: 0, stub: false }; }
    await ctx?.close().catch(() => {});
  }
  results.push(r);
  process.stderr.write(".");
}
await browser.close(); srv.close();

// first-load JS gzip: scripts referenced by the home page html
const html = fs.readFileSync(exists("/"), "utf8");
const scripts = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/[^"]+\.js)"/g)].map((m) => m[1]))];
const gz = scripts.reduce((a, s) => a + zlib.gzipSync(fs.readFileSync(path.join(OUT, s))).length, 0);
const summary = { routes: routes.length, firstLoadJsGzKB: +(gz / 1024).toFixed(1), brokenLinks, results };
fs.writeFileSync(path.join(REP, "qa.json"), JSON.stringify(summary, null, 1));
console.log("\nroutes", routes.length, "firstLoadJsGzKB", summary.firstLoadJsGzKB, "broken", brokenLinks.length);
