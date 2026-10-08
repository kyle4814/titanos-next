// Headless screenshots of the TIX demo at phone width. Usage: node scripts/tix_shots.mjs <outdir>  (needs `npm run build` first)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const outDir = process.argv[2]; fs.mkdirSync(outDir, { recursive: true });
const root = path.resolve("out");
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  const ext = path.extname(f); const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
  res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const pg = await ctx.newPage();
const errs = []; pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); }); pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(base + "/demo/tix"); await pg.waitForSelector("text=Create event");
await pg.fill('[aria-label="Event name"]', "Demo Fest 2026"); await pg.click("text=Create event");
await pg.fill('[aria-label="Fan name"]', "Sam Fan"); await pg.click("text=Issue ticket");
await pg.screenshot({ path: path.join(outDir, "organiser.png"), fullPage: true });
await pg.goto(base + "/demo/tix/wallet"); await pg.waitForSelector('[data-testid="token"]:not(:empty)');
const t1 = await pg.textContent('[data-testid="token"]'); await pg.waitForTimeout(500);
await pg.screenshot({ path: path.join(outDir, "wallet.png"), fullPage: true });
await pg.waitForFunction((t) => document.querySelector('[data-testid="token"]').textContent !== t, t1, { timeout: 20000 });
const t2 = await pg.textContent('[data-testid="token"]');
await pg.goto(base + "/demo/tix/scan"); await pg.waitForSelector("text=Verify code");
await pg.fill('[aria-label="Ticket code"]', t2); await pg.click("text=Verify code", { force: true }); await pg.waitForTimeout(1500); console.log("BODY:", (await pg.textContent("main")).slice(0,200), JSON.stringify(errs).slice(0,600)); await pg.waitForSelector("text=ADMIT");
await pg.screenshot({ path: path.join(outDir, "scanner_admit.png"), fullPage: true });
await pg.click("text=Verify code", { force: true }); await pg.waitForSelector("text=DUPLICATE");
await pg.screenshot({ path: path.join(outDir, "scanner_duplicate.png"), fullPage: true });
await pg.fill('[aria-label="Ticket code"]', t1); await pg.click("text=Verify code", { force: true }); await pg.waitForSelector("text=EXPIRED");
await pg.screenshot({ path: path.join(outDir, "scanner_expired.png"), fullPage: true });
console.log("token rotated:", t1 !== t2, "| console errors:", JSON.stringify(errs));
await b.close(); srv.close();
