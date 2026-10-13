// Scroll perf probe: node scripts/scroll_perf.mjs <outDir> [path=/] [label]
// Serves out/ locally, iPhone-class touch emulation, 4x CPU throttle, scrolls top to bottom with real
// touch swipe gestures (CDP Input.synthesizeScrollGesture) while recording rAF gaps, long tasks and a
// Chromium trace (summed by event name). Prints JSON. Median of 3 runs for the frame stats.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const root = path.resolve(process.argv[2] || "out"); const pagePath = process.argv[3] || "/"; const label = process.argv[4] || "run";
const RUNS = +(process.env.RUNS || 3);
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".avif":"image/avif",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".mp3":"audio/mpeg",".json":"application/json",".txt":"text/plain"};
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  for (const c of [f, f + ".html", path.join(f, "index.html")]) { try { if (fs.statSync(c).isFile()) { f = c; break; } } catch {} }
  try { const b = fs.readFileSync(f); r.writeHead(200, {"content-type": MIME[path.extname(f)] || "application/octet-stream"}); r.end(b); } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
const ABL = {
  blend: "*,*::before,*::after{mix-blend-mode:normal!important}",
  specular: ".vault-specular{display:none!important}",
  blobs: ".vault-mesh{display:none!important}",
  grain: "body::before{display:none!important}",
  lattice: "body::after{display:none!important}",
  thread: ".vault-edge-thread,.fx-thread{display:none!important}",
  anim: "*,*::before,*::after{animation:none!important}",
  bdf: "*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
  filter: "*{filter:none!important}",
  gl: "canvas{display:none!important}",
};
const abl = (process.env.ABL || "").split("+").filter(Boolean);
const ablCss = abl.map(k => ABL[k] || "").join("");
const out = [];
for (let i = 0; i < RUNS; i++) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true,
    userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await pg.addInitScript(() => {
    window.__long = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({type:"longtask",buffered:true});
  });
  if (ablCss) await pg.addInitScript(css => document.addEventListener("DOMContentLoaded", () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); }), ablCss);
  await pg.goto(`http://127.0.0.1:${port}${pagePath}`, { waitUntil: "load" });
  await pg.waitForTimeout(3500);
  const H = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await pg.evaluate(() => { window.__long.length = 0; window.__frames = []; window.__run = true; let last = performance.now();
    const t = ts => { window.__frames.push(ts - last); last = ts; if (window.__run) requestAnimationFrame(t); }; requestAnimationFrame(t); });
  const events = [];
  cdp.on("Tracing.dataCollected", e => events.push(...e.value));
  const done = new Promise(r => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,v8", transferMode: "ReportEvents" });
  // swipe in 600 px strokes until the bottom (cap 120 swipes)
  let y = 0, n = 0;
  while (y < H - 5 && n++ < 120) {
    await cdp.send("Input.synthesizeScrollGesture", { x: 195, y: 600, yDistance: -600, speed: 1800, gestureSourceType: "touch" });
    y = await pg.evaluate(() => scrollY);
  }
  await cdp.send("Tracing.end"); await done;
  const r = await pg.evaluate(() => { window.__run = false; return { frames: window.__frames.slice(1), long: window.__long }; });
  const agg = {}; for (const e of events) if (e.ph === "X" && e.dur) { const k = e.name; (agg[k] ??= { ms: 0, n: 0 }); agg[k].ms += e.dur / 1000; agg[k].n++; }
  const keep = ["RunTask","FunctionCall","EvaluateScript","FireAnimationFrame","UpdateLayoutTree","Layout","PrePaint","Paint","Layerize","Commit","RasterTask","TimerFire","EventDispatch","MajorGC","MinorGC","IntersectionObserverController::computeIntersections","HitTest","UpdateLayer"];
  const top = Object.fromEntries(keep.filter(k => agg[k]).map(k => [k, { ms: +agg[k].ms.toFixed(0), n: agg[k].n }]));
  const fr = r.frames.slice().sort((a, c) => a - c);
  out.push({ H, swipes: n, frames: fr.length, p50: +fr[Math.floor(fr.length*.5)].toFixed(1), p95: +fr[Math.floor(fr.length*.95)].toFixed(1), max: +fr[fr.length-1].toFixed(1),
    over16: fr.filter(f => f > 16.7*1.5).length, janky_pct: +(100*fr.filter(f => f > 16.7*1.5).length/fr.length).toFixed(1),
    longTasks: r.long.length, longTaskMs: +r.long.reduce((a, c) => a + c, 0).toFixed(0), longestTask: +Math.max(0, ...r.long).toFixed(0), top, _agg: i === 0 ? agg : undefined });
  await b.close();
}
srv.close();
const mid = k => out.map(r => r[k]).sort((a, c) => a - c)[Math.floor(out.length/2)];
const res = { label, page: pagePath, runs: out.length, median: Object.fromEntries(["H","frames","p50","p95","max","over16","janky_pct","longTasks","longTaskMs","longestTask"].map(k => [k, mid(k)])), top: out[Math.floor(out.length/2)].top };
fs.mkdirSync("/tmp/ksc", { recursive: true });
const a = out[0]._agg || {}; const topFn = Object.entries(a).filter(([k]) => !/^(RunTask|ThreadControllerImpl|ThreadPool|TaskQueue)/.test(k)).sort((x, y) => y[1].ms - x[1].ms).slice(0, 14).map(([k, v]) => `${k}:${v.ms.toFixed(0)}ms/${v.n}`);
res.biggest_events_run1 = topFn;
fs.writeFileSync(`/tmp/ksc/${label}_${pagePath.replace(/\W+/g, "_")}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
