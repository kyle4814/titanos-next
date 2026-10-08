// Usage: node scripts/make_poster.mjs <outDir (static export)> [port=4312]
// Renders the live hero scene (copy and scrim hidden) in headless chromium and writes public/hero/poster-{d,m}.webp.
// The poster is the LCP image; the WebGL scene fades in over it.
import { chromium } from "playwright";
import sharp from "sharp";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
const [, , dir, portArg = "4312"] = process.argv;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]); let f = join(dir, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); await stat(f); } catch { f = join(dir, p + ".html"); }
  try { const b = await readFile(f); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(+portArg);
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
for (const [name, w, h, q] of [["d", 1440, 900, 62], ["m", 780, 1000, 58]]) {
  const page = await browser.newPage({ viewport: { width: name === "d" ? w : 390, height: name === "d" ? h : 500 }, deviceScaleFactor: name === "d" ? 1 : 2 });
  await page.goto(`http://localhost:${portArg}/`, { waitUntil: "load" });
  await page.addStyleTag({ content: "body>*:not(main){display:none!important} main>*:not(.ds-hero){display:none!important} .ds-hero__copy,.ds-hero::after,.ds-hero__poster{display:none!important} .ds-hero__julia{opacity:.55!important;transition:none!important} .ds-hero__stars{opacity:1!important;transition:none!important}" });
  await page.waitForTimeout(17000);
  const png = await page.locator(".ds-hero").screenshot();
  await sharp(png).resize(w, h, { fit: "cover" }).webp({ quality: q }).toFile(`public/hero/poster-${name}.webp`);
  await page.close();
}
await browser.close(); server.close();
