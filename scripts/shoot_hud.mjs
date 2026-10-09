// Screenshots of the built HUD page (static export in out/) at 390 and 1440, reduced motion on.
// Usage: node scripts/shoot_hud.mjs [outDir=out] [shotDir=public/case-studies/own/titanos-hud]. Prints a JSON summary.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.argv[2] || "out");
const DEST = path.resolve(process.argv[3] || "public/case-studies/own/titanos-hud");
fs.mkdirSync(DEST, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".txt": "text/plain" };
const file = (p) => { for (const c of [p, p + ".html", path.join(p, "index.html")]) { const f = path.join(OUT, c); if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; } return null; };
const srv = http.createServer((q, s) => {
  const f = file(decodeURIComponent(q.url.split("?")[0]));
  if (!f) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(s);
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const seen = { shots: [], consoleErrors: [] };
for (const [label, vp, mobile] of [["390", { width: 390, height: 844 }, true], ["1440", { width: 1440, height: 900 }, false]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") seen.consoleErrors.push(`${label}: ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => seen.consoleErrors.push(`${label}: pageerror ${String(e).slice(0, 160)}`));
  await page.goto(BASE + "/hud", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const shot = async (name) => {
    await page.screenshot({ path: path.join(DEST, `${name}-${label}.png`) });
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    seen.shots.push({ file: `${name}-${label}.png`, overflowPx: ov });
  };
  await shot("top");
  const wrap = page.locator(".hud-wrap");
  await wrap.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot("panels");
  await page.locator(".hud-wide").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot("feed");
  await ctx.close();
}
await browser.close();
srv.close();
console.log(JSON.stringify(seen, null, 1));
process.exit(seen.consoleErrors.length ? 3 : 0);
