// Homepage phone-width height measurement (C10). Serves out/ on 127.0.0.1 only, loads / at 390 px,
// scrolls through once so lazy/reveal content mounts, returns document height + each top-level section.
// Usage: node scripts/home_height.mjs [outDir=out] [--json]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2" };

export async function measureHome(outDir = "out", width = 390, injectCss = "") {
  const root = path.resolve(outDir);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    for (const c of [p, p + ".html", path.join(p, "index.html")]) {
      const f = path.join(root, c);
      if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
        return fs.createReadStream(f).pipe(res);
      }
    }
    res.writeHead(404); res.end("nf");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    if (injectCss) await page.addStyleTag({ content: injectCss });
    for (let y = 0; y < 90000; y += 700) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(25); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    return await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const kids = [...main.children].filter((e) => e.getBoundingClientRect().height > 0);
      const sections = kids.map((e) => ({
        tag: e.tagName.toLowerCase(),
        label: (e.querySelector("h1,h2,h3")?.innerText || e.getAttribute("aria-label") || e.className?.toString().slice(0, 30) || "").trim().replace(/\s+/g, " ").slice(0, 50),
        px: Math.round(e.getBoundingClientRect().height),
      }));
      return { docHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), mainChildren: sections };
    });
  } finally { await browser.close(); server.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await measureHome(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "out");
  if (process.argv.includes("--json")) console.log(JSON.stringify(r));
  else { console.log("docHeight", r.docHeight); [...r.mainChildren].sort((a, b) => b.px - a.px).forEach((s) => console.log(String(s.px).padStart(7), s.tag, s.label)); }
}
