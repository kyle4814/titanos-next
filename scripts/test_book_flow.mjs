// /book end to end in a real browser (2026-11-12): the built export on 127.0.0.1, the portal API MOCKED (no network leaves the machine).
// Checks at 390 px: tap targets >= 44 px, no sideways scroll, slots shown in the visitor's zone with Brisbane beside them, a good booking posts
// the right JSON and lands on the confirmation page with the .ics link, a taken slot shows the message and reloads the times, an API outage
// shows the Telegram and email fallback. Labelled SKIP (exit 0) when no browser is installed.
// Usage: node scripts/test_book_flow.mjs [outDir=out]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail = 1; };
const out = path.resolve(process.argv[2] || "out");
let chromium;
try { ({ chromium } = await import("playwright")); } catch { console.log("SKIP test_book_flow (no playwright)"); process.exit(0); }
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  for (const c of [p, p + ".html", path.join(p, "index.html")]) {
    const f = path.join(out, c);
    if (f.startsWith(out) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); return fs.createReadStream(f).pipe(res); }
  }
  res.writeHead(404); res.end("nf");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try { browser = await chromium.launch(); } catch { console.log("SKIP test_book_flow (no browser)"); server.close(); process.exit(0); }

const API = "https://api.titanos.tech";
const FRI = Date.UTC(2026, 10, 13, 4, 0), MIN = 60000;
const slots = [0, 20, 40, 60].map((m) => ({ start: new Date(FRI + m * MIN).toISOString(), startMs: FRI + m * MIN })).concat([{ start: new Date(FRI + 3 * 86400000).toISOString(), startMs: FRI + 3 * 86400000 }]);
const ID = "bk_" + "0123456789abcdef".repeat(2);
const cors = { "access-control-allow-origin": base, "content-type": "application/json" };

async function run(name, mode, fn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/Los_Angeles", reducedMotion: "reduce" });
  const posts = []; let slotCalls = 0;
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1") return route.continue();
    if (u.origin !== API) return route.abort();
    const m = route.request().method(), p = u.pathname;
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS" } });
    if (mode === "down") return route.abort();
    if (p === "/api/slots") { slotCalls++; return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ tz: "Australia/Brisbane", slotMinutes: 20, slots }) }); }
    if (p === "/api/book" && m === "POST") { posts.push(JSON.parse(route.request().postData() || "{}")); return mode === "taken" ? route.fulfill({ status: 409, headers: cors, body: '{"error":"slot_taken"}' }) : route.fulfill({ status: 201, headers: cors, body: JSON.stringify({ ok: true, id: ID, startMs: FRI, endMs: FRI + 20 * MIN }) }); }
    if (p === `/api/book/${ID}`) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ id: ID, name: "Sam", business: "B", startMs: FRI, endMs: FRI + 20 * MIN, tz: "Australia/Brisbane" }) });
    return route.fulfill({ status: 404, headers: cors, body: "{}" });
  });
  const pg = await ctx.newPage();
  console.log(`-- ${name}`);
  try { await fn(pg, posts, () => slotCalls); } catch (e) { ok(false, `${name}: ${e.message.split("\n")[0]}`); }
  await ctx.close();
}

await run("good booking", "good", async (pg, posts) => {
  await pg.goto(`${base}/book`, { waitUntil: "networkidle" });
  await pg.waitForSelector('button[aria-pressed]');
  const small = await pg.$$eval("button, input:not([tabindex='-1']), textarea, a[href]", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.closest("main, form, [role=group]") && r.height < 44 && !e.closest("nav, header, footer"); }).map((e) => `${e.tagName}:${(e.textContent || e.name || "").slice(0, 20)}:${Math.round(e.getBoundingClientRect().height)}`));
  ok(small.length === 0, `tap targets in the booking area are all 44 px or more${small.length ? " (small: " + small.join(", ") + ")" : ""}`);
  ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll at 390 px");
  const first = await pg.$$eval('div[aria-label^="Times on"] button', (b) => b.map((x) => x.textContent.trim()));
  ok(first.length === 4 && /8:00 pm/.test(first[0]) && /Brisbane 2:00 pm/.test(first[0]), `Los Angeles visitor sees Thu 8:00 pm with Brisbane 2:00 pm beside it (${first[0]})`);
  ok((await pg.$$eval('[role=group][aria-label="Day"] button', (b) => b.length)) === 2, "two days offered");
  await pg.fill("#bk-name", "Sam Tradie"); await pg.fill("#bk-business", "Sam's Plumbing"); await pg.fill("#bk-email", "sam@example.com"); await pg.fill("#bk-eats", "Quotes and invoices");
  await pg.click('text="Book my call"');
  await pg.waitForTimeout(300);
  ok(posts.length === 0 && /pick a time/i.test(await pg.textContent("[role=alert]")), "no POST until a time is picked");
  await pg.click('div[aria-label^="Times on"] button >> nth=1');
  await pg.click('text="Book my call"');
  await pg.waitForURL(/\/book\/confirmed#id=/, { timeout: 5000 });
  ok(posts.length === 1 && posts[0].slot === new Date(FRI + 20 * MIN).toISOString() && posts[0].name === "Sam Tradie" && posts[0].email === "sam@example.com" && posts[0].website === "" && posts[0].phone === "", "POST carries the picked slot, the fields, an empty honeypot, no phone");
  await pg.waitForSelector("text=You are booked in, Sam.");
  ok((await pg.getAttribute('a[download]', "href")) === `${API}/api/book/${ID}/ics`, "confirmation links the .ics download");
  ok(/Brisbane time/.test(await pg.textContent("body")), "confirmation shows Brisbane time beside the visitor's");
});
await run("slot taken", "taken", async (pg, posts, calls) => {
  await pg.goto(`${base}/book`, { waitUntil: "networkidle" });
  await pg.waitForSelector('button[aria-pressed]');
  await pg.fill("#bk-name", "A"); await pg.fill("#bk-business", "B"); await pg.fill("#bk-email", "a@example.com"); await pg.fill("#bk-eats", "x");
  await pg.click('div[aria-label^="Times on"] button >> nth=0');
  const before = calls();
  await pg.click('text="Book my call"');
  await pg.waitForSelector("text=Someone just took that time");
  await pg.waitForTimeout(300);
  ok(calls() > before, "times are reloaded after a taken slot");
  ok(/\/book$/.test(pg.url()), "stays on the form");
});
await run("api down", "down", async (pg) => {
  await pg.goto(`${base}/book`, { waitUntil: "networkidle" });
  await pg.waitForSelector("text=did not load just now");
  ok(await pg.$('a[href^="https://t.me/"]') !== null && await pg.$('a[href^="mailto:"]') !== null, "outage shows Telegram and email");
  ok(await pg.$eval('button[type=submit]', (b) => b.disabled), "submit is disabled with no times");
});
await run("honeypot is invisible", "good", async (pg) => {
  await pg.goto(`${base}/book`, { waitUntil: "networkidle" });
  const box = await pg.$eval("#bk-website", (e) => { const r = e.getBoundingClientRect(); return r.right <= 0 || r.left >= window.innerWidth || r.width <= 1; });
  ok(box, "honeypot sits off screen");
  await pg.keyboard.press("Tab");
  const focusedAfterManyTabs = [];
  for (let i = 0; i < 30; i++) { focusedAfterManyTabs.push(await pg.evaluate(() => document.activeElement && document.activeElement.id)); await pg.keyboard.press("Tab"); }
  ok(!focusedAfterManyTabs.includes("bk-website"), "keyboard never lands on the honeypot");
});
await browser.close(); server.close();
process.exit(fail);
