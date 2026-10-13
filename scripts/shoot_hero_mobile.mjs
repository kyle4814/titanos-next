// Hero like-for-like shots. Usage: node scripts/shoot_hero_mobile.mjs <outDir> <shotsDir> <label> [helix=none]
// Phone 390x844 @3x (iPhone UA), phone 412x915 @2.6x (Galaxy S-class UA), desktop 1440x900. Each device gets the
// hero at its natural state (poster or live WebGL, whichever the page picks) plus a deterministic "diff" shot of the
// desktop hero (reduced motion, helix pinned to the given variant) for pixel comparison across builds.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const root = path.resolve(process.argv[2]); const shots = path.resolve(process.argv[3]); const label = process.argv[4]; const helix = process.argv[5] || "none";
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".avif":"image/avif",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".mp3":"audio/mpeg",".json":"application/json",".txt":"text/plain"};
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  for (const c of [f, f + ".html", path.join(f, "index.html")]) { try { if (fs.statSync(c).isFile()) { f = c; break; } } catch {} }
  try { const b = fs.readFileSync(f); r.writeHead(200, {"content-type": MIME[path.extname(f)] || "application/octet-stream"}); r.end(b); } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch();
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const GALAXY = "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const devices = {
  phone390: { viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:IPHONE },
  phone412: { viewport:{width:412,height:915}, deviceScaleFactor:2.6, isMobile:true, hasTouch:true, userAgent:GALAXY },
  desktop: { viewport:{width:1440,height:900}, deviceScaleFactor:1 },
  desktopdiff: { viewport:{width:1440,height:900}, deviceScaleFactor:1, reducedMotion:"reduce" },
  desktopstill: { viewport:{width:1440,height:900}, deviceScaleFactor:1, reducedMotion:"reduce" }, // poster + the build's helix, for Kyle
};
const pin = (v) => { document.documentElement.style.scrollBehavior = "auto"; const t = document.querySelector(".fx-thread"); if (t && v !== "none") t.dataset.helix = v;
  document.querySelectorAll(".fx-thread__pulse").forEach(e => { e.style.animationPlayState = "paused"; e.style.animationDelay = "-3.5s"; }); };
for (const [dev, opts] of Object.entries(devices)) {
  const ctx = await b.newContext(opts); const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await pg.waitForTimeout(3500);
  await pg.evaluate(pin, dev === "desktopdiff" ? "B" : helix);
  await pg.waitForTimeout(600);
  const state = await pg.evaluate(() => { const h = document.querySelector(".ds-hero"); const img = h.querySelector(".ds-hero__poster img");
    return { live: h.classList.contains("is-live"), posterOpacity: getComputedStyle(h.querySelector(".ds-hero__poster")).opacity, src: img.currentSrc.split("/").pop(), heroH: h.getBoundingClientRect().height,
      h1: getComputedStyle(h.querySelector("h1")).fontSize, h1Lines: Math.round(h.querySelector("h1").getBoundingClientRect().height / parseFloat(getComputedStyle(h.querySelector("h1")).lineHeight)),
      ctaBottom: h.querySelector(".ds-cta").getBoundingClientRect().bottom, canvases: h.querySelectorAll("canvas").length }; });
  console.log(label, dev, JSON.stringify(state));
  await pg.screenshot({ path: path.join(shots, `${label}_${dev}_hero.png`) });
  await ctx.close();
}
await b.close(); srv.close();
console.log("shot", label, helix);
