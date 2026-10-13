// Mobile perf probe: node scripts/mobile_perf.mjs <outDir> [path=/] [label]
// Serves out/ locally, loads in headless chromium with Pixel-class viewport + 4x CPU throttle,
// records transfer bytes, LCP, CLS, long-task TBT and scroll frame stats.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const root = path.resolve(process.argv[2] || "out"); const page_path = process.argv[3] || "/";
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".avif":"image/avif",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".mp3":"audio/mpeg",".mp4":"video/mp4",".json":"application/json",".txt":"text/plain"};
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split("?")[0]); let f = path.join(root, p);
  for (const c of [f, f + ".html", path.join(f, "index.html")]) { try { if (fs.statSync(c).isFile()) { f = c; break; } } catch {} }
  try { const b = fs.readFileSync(f); r.writeHead(200, {"content-type": MIME[path.extname(f)] || "application/octet-stream"}); r.end(b); }
  catch { r.writeHead(404); r.end("nf"); }
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
const variant = (process.argv[4] || "base").split("+");
const NOCANVAS = variant.includes("nocanvas"), NOGL = variant.includes("nogl"), NODUST = variant.includes("nodust"), NOFILTER = variant.includes("nofilter"), NOLENIS = variant.includes("nolenis");
const CSS = (NOFILTER ? "*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}" : "") + (variant.includes("noanim") ? "*,*::before,*::after{animation:none!important}" : "") + (variant.includes("noblob") ? ".vault-blob{display:none!important}" : "");
const runs = [];
for (let i = 0; i < 3; i++) {
  const b = await chromium.launch(); 
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true,
    userAgent:"Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36" });
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let bytes = 0, reqs = 0; const byType = {};
  cdp.on?.("Network.loadingFinished", () => {});
  await cdp.send("Network.enable");
  const sizes = new Map();
  cdp.on("Network.responseReceived", e => sizes.set(e.requestId, e.response.mimeType));
  cdp.on("Network.loadingFinished", e => { bytes += e.encodedDataLength; reqs++; const t = sizes.get(e.requestId) || "?"; byType[t] = (byType[t]||0) + e.encodedDataLength; });
  await pg.addInitScript(({NOCANVAS,NOGL,NODUST,CSS,NOLENIS}) => {
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...a) {
      if (NOCANVAS) return null;
      if (NOGL && t === "webgl") return null;
      if (NODUST && t === "2d") return null;
      return gc.call(this, t, ...a);
    };
    if (NOLENIS) Object.defineProperty(window, "matchMedia", { value: (q) => ({ matches: /reduce/.test(q), media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }) });
    if (CSS) document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); });
  }, { NOCANVAS, NOGL, NODUST, CSS, NOLENIS });
  await pg.addInitScript(() => {
    window.__m = { lcp:0, cls:0, tbt:0, long:0 };
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({type:"largest-contentful-paint",buffered:true});
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({type:"layout-shift",buffered:true});
    new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__m.long++; window.__m.tbt += Math.max(0, e.duration - 50); } }).observe({type:"longtask",buffered:true});
  });
  await pg.goto(`http://127.0.0.1:${port}${page_path}`, { waitUntil: "load" });
  await pg.waitForTimeout(3000);
  const loadBytes = bytes;
  await cdp.send("Performance.enable"); const pm = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(x => [x.name, x.value]));
  const m0 = await pm();
  // scroll the page in 24 steps with rAF frame timing
  const jank = await pg.evaluate(async () => {
    const H = document.documentElement.scrollHeight - innerHeight; const frames = [];
    let last = performance.now(); let run = true;
    const tick = t => { frames.push(t - last); last = t; if (run) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const steps = 40; for (let s = 1; s <= steps; s++) { scrollTo(0, H * s / steps); await new Promise(r => setTimeout(r, 60)); }
    run = false; await new Promise(r => setTimeout(r, 50));
    frames.shift(); frames.sort((a,b)=>a-b);
    return { H, frames: frames.length, p50: frames[Math.floor(frames.length*.5)], p95: frames[Math.floor(frames.length*.95)], over50: frames.filter(f=>f>50).length };
  });
  const m1 = await pm(); const pmd = Object.fromEntries(["ScriptDuration","LayoutDuration","RecalcStyleDuration","TaskDuration","LayoutCount","RecalcStyleCount"].map(k => [k, +((m1[k]-m0[k]) * (k.endsWith("Duration") ? 1000 : 1)).toFixed(0)]));
  const m = await pg.evaluate(() => window.__m);
  const dom = await pg.evaluate(() => document.getElementsByTagName("*").length);
  runs.push({ loadKB: +(loadBytes/1024).toFixed(0), totalKB: +(bytes/1024).toFixed(0), reqs, lcp:+m.lcp.toFixed(0), cls:+m.cls.toFixed(3), tbt:+m.tbt.toFixed(0), longTasks:m.long, scrollMs:pmd, dom, ...jank,
    typeKB:Object.fromEntries(Object.entries(byType).map(([k,v])=>[k,+(v/1024).toFixed(0)])) });
  await b.close();
}
srv.close();
const med = k => runs.map(r=>r[k]).sort((a,b)=>a-b)[1];
console.log(JSON.stringify({ page: page_path, variant: variant.join("+"), median: Object.fromEntries(["loadKB","totalKB","reqs","lcp","cls","tbt","longTasks","dom","p50","p95","over50","frames"].map(k=>[k,med(k)])), scrollMs: runs[1].scrollMs, runs: runs.length, typeKB: runs[1].typeKB }, null, 1));
