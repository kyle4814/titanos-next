// Full-site perf probe: node scripts/site_squeeze.mjs <outDir> <label> [profile=desktop|mobile|both] [pagesFile|all] [conc=3]
// Per page+profile: LCP, CLS, TBT (long tasks after FCP), INP proxy (tap/click event duration), JS/CSS/img/font/total bytes
// (wire = transferSize equivalent via CDP encodedDataLength), scroll janky-frame % from a scripted scroll trace.
// desktop: 1440x900 no throttle, mouse wheel. mobile: 412x915 @2.625 Android Chrome UA, touch, 4x CPU, slow 4G.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import zlib from "node:zlib";
import { chromium } from "playwright";
const CACHE = new Map(); // brotli like the CDN would (text types only)
const root = path.resolve(process.argv[2] || "out"); const label = process.argv[3] || "run";
const prof = process.argv[4] || "both"; const pf = process.argv[5] || "all"; const CONC = +(process.argv[6] || 3);
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".avif":"image/avif",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".mp3":"audio/mpeg",".json":"application/json",".txt":"text/plain",".mp4":"video/mp4",".pdf":"application/pdf"};
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  for (const c of [f, f + ".html", path.join(f, "index.html")]) { try { if (fs.statSync(c).isFile()) { f = c; break; } } catch {} }
  try { let b = fs.readFileSync(f); const ext = path.extname(f); const h = {"content-type": MIME[ext] || "application/octet-stream", "cache-control": "max-age=0"};
    if ([".html", ".js", ".css", ".svg", ".json", ".txt"].includes(ext) && /br/.test(q.headers["accept-encoding"] || "")) {
      let z = CACHE.get(f); if (!z) { z = zlib.brotliCompressSync(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }); CACHE.set(f, z); }
      b = z; h["content-encoding"] = "br"; }
    r.writeHead(200, h); r.end(b); } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
function allPages() {
  const o = [];
  (function w(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "_next" || e.name === "_not-found" || e.name.startsWith("__")) continue;
    if (e.isDirectory()) w(path.join(d, e.name), rel + "/" + e.name);
    else if (e.name.endsWith(".html")) { const n = e.name.slice(0, -5); if (n === "index" && rel === "") o.push("/"); else if (n !== "404" && n !== "index") o.push(rel + "/" + n); }
  } })(root, "");
  return o.sort();
}
const pages = pf === "all" ? allPages() : fs.readFileSync(pf, "utf8").split("\n").map(s => s.trim()).filter(Boolean);
const PROFILES = {
  desktop: { ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, cpu: 1, net: null, src: "mouse", dist: 700 },
  mobile: { ctx: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true,
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36" },
    cpu: 4, net: { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 }, src: "touch", dist: 600 },
};
const profs = prof === "both" ? ["desktop", "mobile"] : [prof];
async function measure(browser, p, pagePath) {
  const P = PROFILES[p];
  const ctx = await browser.newContext(P.ctx); const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  const bytes = { js: 0, css: 0, img: 0, font: 0, media: 0, html: 0, other: 0, total: 0, reqs: 0 };
  const types = new Map();
  await cdp.send("Network.enable");
  cdp.on("Network.responseReceived", e => types.set(e.requestId, [e.type, e.response.url]));
  cdp.on("Network.loadingFinished", e => { const t = types.get(e.requestId) || ["Other", ""]; const k = { Script: "js", Stylesheet: "css", Image: "img", Font: "font", Media: "media", Document: "html" }[t[0]] || "other";
    bytes[k] += e.encodedDataLength; bytes.total += e.encodedDataLength; bytes.reqs++; });
  if (P.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: P.cpu });
  if (P.net) await cdp.send("Network.emulateNetworkConditions", P.net);
  await pg.addInitScript(() => {
    window.__m = { lcp: 0, lcpEl: "", cls: 0, fcp: 0, long: [], ev: [] };
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__m.lcp = e.startTime; window.__m.lcpEl = (e.element && (e.element.tagName + "." + String(e.element.className).slice(0, 40))) || e.url || ""; } }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime; }).observe({ type: "paint", buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.ev.push(e.duration); }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  const ABL = { blend: "*,*::before,*::after{mix-blend-mode:normal!important}", specular: ".vault-specular{display:none!important}", blobs: ".vault-mesh{display:none!important}",
    grain: "body::before{display:none!important}", lattice: "body::after{display:none!important}", thread: ".vault-edge-thread,.fx-thread{display:none!important}",
    anim: "*,*::before,*::after{animation:none!important}", bdf: "*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}", filter: "*{filter:none!important}",
    gl: "canvas{display:none!important}", ...JSON.parse(process.env.ABLX || "{}") };
  const ablCss = (process.env.ABL || "").split("+").filter(Boolean).map(k => ABL[k] || "").join("");
  if (ablCss) await pg.addInitScript(css => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), ablCss);
  const res = { page: pagePath, profile: p };
  try {
    await pg.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: "load", timeout: 60000 });
    await pg.waitForTimeout(p === "mobile" ? 3000 : 2000);
    // INP proxy: real input on a neutral point, then a button/link tap if present
    if (p === "mobile") await pg.touchscreen.tap(P.ctx.viewport.width / 2, 300); else await pg.mouse.click(P.ctx.viewport.width / 2, 400);
    await pg.waitForTimeout(300);
    const H = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await pg.evaluate(() => { window.__frames = []; window.__run = true; let last = performance.now();
      const t = ts => { window.__frames.push(ts - last); last = ts; if (window.__run) requestAnimationFrame(t); }; requestAnimationFrame(t); });
    let y = 0, n = 0; const cap = p === "mobile" ? 70 : 90;
    const t0 = Date.now();
    while (y < H - 5 && n++ < cap && Date.now() - t0 < 60000) {
      await cdp.send("Input.synthesizeScrollGesture", { x: P.ctx.viewport.width / 2, y: P.ctx.viewport.height * 0.7, yDistance: -P.dist, speed: 1800, gestureSourceType: P.src });
      y = await pg.evaluate(() => scrollY);
    }
    await pg.waitForTimeout(500);
    const m = await pg.evaluate(() => { window.__run = false; return { m: window.__m, frames: window.__frames.slice(1), dom: document.getElementsByTagName("*").length }; });
    const fcp = m.m.fcp; const tbt = m.m.long.filter(l => l[0] >= fcp).reduce((a, l) => a + Math.max(0, l[1] - 50), 0);
    const fr = m.frames.slice().sort((a, c) => a - c); const jank = fr.filter(f => f > 25).length;
    const ev = m.m.ev.slice().sort((a, c) => a - c);
    Object.assign(res, { H, dom: m.dom, lcp: +m.m.lcp.toFixed(0), lcpEl: m.m.lcpEl, cls: +m.m.cls.toFixed(3), fcp: +fcp.toFixed(0), tbt: +tbt.toFixed(0),
      inp: ev.length ? +ev[ev.length - 1].toFixed(0) : 0, frames: fr.length, p50: fr.length ? +fr[Math.floor(fr.length / 2)].toFixed(1) : 0,
      p95: fr.length ? +fr[Math.floor(fr.length * 0.95)].toFixed(1) : 0, jankPct: fr.length ? +(100 * jank / fr.length).toFixed(1) : 0,
      jsKB: +(bytes.js / 1024).toFixed(0), cssKB: +(bytes.css / 1024).toFixed(0), imgKB: +(bytes.img / 1024).toFixed(0), fontKB: +(bytes.font / 1024).toFixed(0),
      mediaKB: +(bytes.media / 1024).toFixed(0), totalKB: +(bytes.total / 1024).toFixed(0), reqs: bytes.reqs });
  } catch (e) { res.error = String(e).slice(0, 200); }
  await ctx.close(); return res;
}
const q = []; for (const p of profs) for (const pg of pages) q.push([p, pg]);
const outf = `/tmp/ksq/${label}.jsonl`; fs.writeFileSync(outf, "");
let idx = 0;
async function worker() {
  const b = await chromium.launch();
  while (idx < q.length) { const [p, pg] = q[idx++]; const r = await measure(b, p, pg); fs.appendFileSync(outf, JSON.stringify(r) + "\n"); process.stderr.write(`${idx}/${q.length} ${p} ${pg} lcp=${r.lcp} cls=${r.cls} jank=${r.jankPct}\n`); }
  await b.close();
}
await Promise.all(Array.from({ length: CONC }, worker));
srv.close(); console.log("done", outf);
