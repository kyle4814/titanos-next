// C1 phone e2e: built site (out/), mobile viewport, DoH answered by planted fixtures with 300 ms latency.
// SKIPs (exit 0, says so) if no browser is installed. Real-network phone timing is PENDING LIVE.
import { chromium } from "playwright";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { FIXTURES, fakeDoh } from "../lib/guestscan/fixtures.ts";

const root = path.resolve("out");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]); let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
let fail = 0; const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

let b;
try { b = await chromium.launch(); } catch (e) { console.log("SKIP test_guestscan_e2e (no browser): " + String(e.message).split("\n")[0]); srv.close(); process.exit(0); }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem("titanos.declaration.dismissed.2026-11", "1"); } catch {} });  // keep the declaration popup out of this flow
const pg = await ctx.newPage();
const errs = [], external = new Set();
pg.on("pageerror", (e) => errs.push(String(e)));
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
const fx = FIXTURES.find((x) => x.id === "nothing-published");
const world = fakeDoh(fx.world);
await ctx.route("**/*", async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === "cloudflare-dns.com") {
    await new Promise((r) => setTimeout(r, 300));
    const body = await world.fetch(u.searchParams.get("name"), u.searchParams.get("type"));
    return route.fulfill({ status: 200, contentType: "application/dns-json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } });
  }
  if (u.hostname !== "127.0.0.1") { external.add(u.hostname); return route.abort(); }
  return route.continue();
});

await pg.goto(base + "/scan", { waitUntil: "load" });
await pg.fill('input[aria-label="Your domain"]', "https://www.bare.example/");
const t0 = Date.now();
await pg.click('button:has-text("Check now")');
await pg.waitForSelector("text=grade", { timeout: 10000 });
const wall = Date.now() - t0;
ok(wall < 10000, `result visible in ${wall} ms on a 390x844 phone viewport (limit 10000)`);
ok((await pg.textContent("#instant")).includes("grade F"), "planted worst-case domain grades F");
ok(world.calls.length === 17, `17 DNS lookups (${world.calls.length})`);
const btn = pg.locator('button:has-text("GET THIS FIXED")');
ok(await btn.count() === 1, "GET THIS FIXED button present");
await btn.click();
const txt = await pg.textContent("#instant");
ok(/v=spf1/.test(txt) && /_dmarc\.bare\.example/.test(txt) && /dig \+short TXT bare\.example/.test(txt), "fix plan shows SPF/DMARC records and verify commands");
ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "no horizontal overflow on phone");
await pg.fill('input[aria-label="Your domain"]', "not a domain");
await pg.click('button:has-text("Check now")');
await pg.waitForSelector('#instant [role="alert"]', { timeout: 3000 }).catch(() => {});
ok(await pg.locator('#instant [role="alert"]').count() === 1, "invalid domain shows an alert, no crash");
ok(![...external].some((h) => /anthropic|openai|googleapis/.test(h)), `no model host contacted (external blocked: ${[...external].join(",") || "none"})`);

await pg.goto(base + "/", { waitUntil: "load" });
const home = await pg.textContent("body");
ok(/hours/i.test(home) && /to fix by hand/.test(home) && /PENDING LIVE/.test(home), "home shows the hours counter with its labels");
const real = errs.filter((e) => !/Failed to load resource|ERR_FAILED|net::/.test(e));
ok(real.length === 0, `no page errors (${real.join(" | ")})`);
await b.close(); srv.close();
if (fail) process.exit(1);
console.log("PASS test_guestscan_e2e");
