// LCP, CLS and first-load JS (gzip) for a few routes of a served static export, plus screenshots.
// Usage: node scripts/perf_probe.mjs <baseUrl> <label> [shotDir]
// Lab numbers: headless chromium, no throttling, one run each; compare before/after on the same machine only.
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "./lib/browser.mjs";

const [, , base, label, shotDir] = process.argv;
const ROUTES = ["/", "/offers", "/audit", "/blog", "/offers/account-change-alert"];
const browser = await launchChromium();
if (!browser) { console.error("no chromium"); process.exit(2); }
const res = {};
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let jsGz = 0, jsRaw = 0, errors = 0;
  const pending = [];
  page.on("console", (m) => { if (m.type() === "error") errors++; });
  page.on("pageerror", () => errors++);
  page.on("response", (r) => {
    if ((r.headers()["content-type"] || "").includes("javascript")) {
      pending.push(r.body().then((b) => { jsRaw += b.length; jsGz += zlib.gzipSync(b).length; }).catch(() => {}));
    }
  });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(base + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await Promise.all(pending);
  const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4) }));
  res[route] = { ...m, jsGzKB: +(jsGz / 1024).toFixed(1), jsRawKB: +(jsRaw / 1024).toFixed(1), consoleErrors: errors };
  await ctx.close();
}
if (shotDir) {
  fs.mkdirSync(shotDir, { recursive: true });
  for (const [name, w, h] of [["390", 390, 844], ["768", 768, 1024], ["1440", 1440, 900]]) {
    for (const [tag, route] of [["home", "/"], ["offer", "/offers/account-change-alert"]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(base + route, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(shotDir, `${label}-${tag}-${name}.png`) });
      await ctx.close();
    }
  }
}
await browser.close();
console.log(JSON.stringify({ label, res }, null, 1));
