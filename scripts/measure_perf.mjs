// Usage: node scripts/measure_perf.mjs <outDir> [path=/] [port=4311]
// Serves a static export, loads the page on a mid-phone profile (390x844, 4x CPU throttle, ~1.6 Mbps / 150 ms RTT)
// and prints JSON: LCP ms, CLS, first-load JS (gzip bytes, same-origin script responses), console errors.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { gzipSync } from "node:zlib";

const [, , dir, path = "/", portArg = "4311"] = process.argv;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain", ".ico": "image/x-icon", ".jpg": "image/jpeg" };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  let f = join(dir, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); await stat(f); } catch { f = join(dir, p + ".html"); }
  try { const b = await readFile(f); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end("nf"); }
}).listen(+portArg);

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 90000 });
let jsBytes = 0, jsGz = 0; const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 160)));
page.on("response", async (r) => {
  try { if (/javascript/.test(r.headers()["content-type"] || "") && r.url().startsWith("http://localhost")) { const b = await r.body(); jsBytes += b.length; jsGz += gzipSync(b).length; } } catch {}
});
await page.addInitScript(() => {
  window.__lcp = 0; window.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
});
await page.goto(`http://localhost:${portArg}${path}`, { waitUntil: "load", timeout: 120000 });
await page.waitForTimeout(5000);
const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(4) }));
console.log(JSON.stringify({ path, ...m, jsKB: +(jsBytes / 1024).toFixed(1), jsGzipKB: +(jsGz / 1024).toFixed(1), consoleErrors: errors }));
await browser.close(); server.close();
