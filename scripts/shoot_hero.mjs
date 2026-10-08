// Usage: node scripts/shoot_hero.mjs <outDir (static export)> <shotsDir> [path=/] [port=4313]
// Headless chromium screenshots of a page at 390, 768 and 1440 wide (viewport shot after the WebGL scene is live).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
const [, , dir, shots, path = "/", portArg = "4313"] = process.argv;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]); let f = join(dir, p);
  try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); await stat(f); } catch { f = join(dir, p + ".html"); }
  try { const b = await readFile(f); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(+portArg);
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const tag = path === "/" ? "home" : path.replace(/\W+/g, "");
for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 140)));
  page.on("pageerror", (e) => errs.push(e.message.slice(0, 140)));
  await page.goto(`http://localhost:${portArg}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(14000);
  await page.screenshot({ path: join(shots, `${tag}-${w}.png`) });
  console.log(w, "errors:", JSON.stringify(errs));
  await page.close();
}
await browser.close(); server.close();
