// Screenshot the helix variants from one build. Usage: node shoot_helix.mjs <outDir> <shotsDir> <label> [variant|none]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const root = path.resolve(process.argv[2]); const shots = path.resolve(process.argv[3]); const label = process.argv[4]; const variant = process.argv[5] || "none";
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".webp":"image/webp",".avif":"image/avif",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml",".woff2":"font/woff2",".mp3":"audio/mpeg",".json":"application/json",".txt":"text/plain"};
const srv = http.createServer((q, r) => {
  let f = path.join(root, decodeURIComponent(q.url.split("?")[0]));
  for (const c of [f, f + ".html", path.join(f, "index.html")]) { try { if (fs.statSync(c).isFile()) { f = c; break; } } catch {} }
  try { const b = fs.readFileSync(f); r.writeHead(200, {"content-type": MIME[path.extname(f)] || "application/octet-stream"}); r.end(b); } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const port = srv.address().port;
fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch();
const devices = {
  phone: { viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" },
  desktop: { viewport:{width:1440,height:900}, deviceScaleFactor:1 },
};
for (const [dev, opts] of Object.entries(devices)) {
  const ctx = await b.newContext(opts); const pg = await ctx.newPage();
  await pg.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
  await pg.waitForTimeout(2500);
  await pg.evaluate((v) => { document.documentElement.style.scrollBehavior = "auto"; const t = document.querySelector(".fx-thread"); if (t && v !== "none") t.dataset.helix = v;
    // freeze the breathing at its midpoint so every variant is shot at the same phase
    document.querySelectorAll(".fx-thread__pulse").forEach(e => { e.style.animationPlayState = "paused"; e.style.animationDelay = "-3.5s"; }); }, variant);
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: path.join(shots, `${label}_${dev}_hero.png`) });
  await pg.evaluate(() => { const s = document.querySelector('section[aria-label="Find the right offer"]'); s.scrollIntoView({ block: "center" }); });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: path.join(shots, `${label}_${dev}_offer.png`) });
  // seam check: a 2x crop of the helix column around a tile boundary (desktop only)
  if (dev === "desktop") {
    const box = await pg.evaluate(() => { const r = document.querySelector(".fx-thread__pulse").getBoundingClientRect(); return { x: r.left, w: r.width }; });
    await pg.screenshot({ path: path.join(shots, `${label}_desktop_column.png`), clip: { x: box.x, y: 0, width: box.w, height: 900 } });
  }
  await ctx.close();
}
await b.close(); srv.close();
console.log("shot", label, variant);
