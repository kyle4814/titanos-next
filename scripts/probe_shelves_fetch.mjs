// probe_shelves_fetch.mjs - first-ask latency of the lazy concierge catalogue (f333). Loopback only, no outbound.
// Usage: node scripts/probe_shelves_fetch.mjs [outDir=out] [--shelves=<file>] [--page=/faq]   (prints one JSON line; needs a built out/)
// Serves outDir on 127.0.0.1:<random port>, opens the concierge in headless Chromium (Playwright), makes the first ask,
// records shelves.json raw and gzip bytes, TTFB, time from click to answer rendered, then asks again and counts fetches.
// --shelves swaps the bytes served at /concierge/shelves.json (used by the mutation test; nothing on disk is changed).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain", ".ico": "image/x-icon" };

export function serve(outDir, shelvesFile) {
  const root = path.resolve(outDir);
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent((req.url || "/").split("?")[0]);
    let f = u === "/concierge/shelves.json" && shelvesFile ? path.resolve(shelvesFile) : path.join(root, u);
    if (f !== path.resolve(shelvesFile || "/nonexistent") && !(f === root || f.startsWith(root + path.sep))) { res.writeHead(403).end(); return; }
    for (const c of [f, f + ".html", path.join(f, "index.html")]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) { f = c; break; }
    }
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404).end("not found"); return; }
    const b = fs.readFileSync(f);
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream", "content-length": b.length, "cache-control": "no-store" }).end(b);
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

export async function probe(outDir, { shelves, page: route = "/faq" } = {}) {
  const shelvesPath = shelves || path.join(outDir, "concierge", "shelves.json");
  const raw = fs.readFileSync(shelvesPath);
  const srv = await serve(outDir, shelves);
  const port = srv.address().port;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const pg = await (await browser.newContext()).newPage();
    const reqs = [];
    pg.on("request", (r) => { if (r.url().includes("/concierge/shelves.json")) reqs.push(r); });
    await pg.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "load" });
    const fetchesBefore = reqs.length;                        // must be 0: lazy means nothing before the first ask
    const input = pg.locator("#concierge-q");
    await input.waitFor();
    await input.fill("how much does a website scan cost");
    const t0 = Date.now();
    await pg.getByRole("button", { name: "Ask" }).click();
    await pg.locator('[aria-live="polite"] p').first().waitFor({ timeout: 15000 });
    const readyMs = Date.now() - t0;
    const first = reqs[0] ? await reqs[0].response() : null;
    const t = reqs[0] ? reqs[0].timing() : null;
    const ttfbMs = t && t.responseStart >= 0 ? Math.round((t.responseStart - t.requestStart) * 10) / 10 : null;
    const fetchesAfterFirst = reqs.length;
    await input.fill("do you replace my IT provider");
    await pg.getByRole("button", { name: "Ask" }).click();
    await pg.waitForTimeout(600);
    return {
      page: route, status: first ? first.status() : null,
      rawBytes: raw.length, gzipBytes: zlib.gzipSync(raw).length,
      ttfbMs, readyMs,
      fetchesBeforeAsk: fetchesBefore, fetchesAfterFirstAsk: fetchesAfterFirst, fetchesAfterSecondAsk: reqs.length,
      loopbackOnly: true, at: new Date().toISOString(),
    };
  } finally { await browser.close(); srv.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || undefined;
  const outDir = path.resolve(args.find((a) => !a.startsWith("--")) || path.join(HERE, "..", "out"));
  if (!fs.existsSync(path.join(outDir, "faq.html"))) { console.log(`SKIPPED-NO-BUILD no built export at ${outDir}; run npm run build first`); process.exit(0); }
  console.log(JSON.stringify(await probe(outDir, { shelves: opt("shelves"), page: opt("page") })));
}
