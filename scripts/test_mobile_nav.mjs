// Regression: at 390px the burger must open a full-viewport drawer with >=5 visible links (bug 2026-11-28: backdrop-filter on
// .pe-nav made it the containing block of the fixed drawer, collapsing it to one link). Usage: node scripts/test_mobile_nav.mjs [out] [shotDir] [baseUrl]
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const out = path.resolve(process.argv[2] || "out"), shots = process.argv[3], ext = process.argv[4];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };
let srv, base = ext;
if (!base) {
  srv = http.createServer((q, r) => {
    let f = path.join(out, decodeURIComponent(q.url.split("?")[0]));
    if (!f.startsWith(out)) { r.writeHead(403).end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = fs.existsSync(path.join(f, "index.html")) ? path.join(f, "index.html") : f + ".html";
    else if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
    if (!fs.existsSync(f)) { r.writeHead(404).end(); return; }
    r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); base = `http://127.0.0.1:${srv.address().port}`;
}
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch();
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36" });
  const pg = await ctx.newPage(); await pg.goto(base + "/", { waitUntil: "load" });
  const burger = pg.locator(".pe-nav__burger");
  await burger.waitFor(); await pg.waitForTimeout(500);
  ok(await burger.getAttribute("aria-expanded") === "false", "burger starts aria-expanded=false");
  await burger.tap(); await pg.waitForTimeout(300);
  ok(await burger.getAttribute("aria-expanded") === "true", "burger aria-expanded=true after tap");
  const id = await burger.getAttribute("aria-controls"); ok(!!id && !!(await pg.$(`[id="${id}"]`)), "aria-controls points at the panel");
  const m = await pg.evaluate(() => {
    const d = document.querySelector(".pe-drawer"), r = d.getBoundingClientRect(), vh = innerHeight;
    const links = [...d.querySelectorAll("a")].filter((a) => { const q = a.getBoundingClientRect(); return q.width > 0 && q.height > 0 && q.top < vh && q.bottom > r.top; });
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh, links: links.length, total: d.querySelectorAll("a").length, bodyOv: getComputedStyle(document.body).overflow, scrollable: d.scrollHeight > d.clientHeight, ov: getComputedStyle(d).overflowY, focusIn: d.contains(document.activeElement), cta: !!document.evaluate("//a[contains(.,'Book a free call')]", d, null, 9, null).singleNodeValue, hit: document.elementFromPoint(195, 300)?.closest(".pe-drawer") !== null };
  });
  console.log(JSON.stringify(m));
  ok(m.links >= 5, `>=5 nav links visible in viewport (${m.links}, ${m.total} total)`);
  ok(m.left <= 0 && m.right >= m.vw - 1 && m.bottom >= m.vh - 1 && m.top < 100 && m.bottom - m.top >= m.vh - 100, "panel covers the viewport below the bar");
  ok(m.hit, "panel is the top layer at screen centre (hero not on top)");
  ok(m.bodyOv === "hidden", "body scroll locked"); ok(m.ov === "auto" || m.ov === "scroll", "panel scrolls (overflow-y)");
  ok(m.focusIn, "focus moved into the panel"); ok(m.cta, "Book a free call CTA present");
  if (shots) { fs.mkdirSync(shots, { recursive: true }); await pg.screenshot({ path: path.join(shots, "mobile_390_open.png") }); }
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(200);
  ok(await burger.getAttribute("aria-expanded") === "false", "Escape closes");
  await burger.tap(); await pg.waitForTimeout(200); await burger.tap(); await pg.waitForTimeout(200);
  ok(await burger.getAttribute("aria-expanded") === "false", "X (burger) closes");
  ok(await pg.evaluate(() => getComputedStyle(document.body).overflow !== "hidden"), "body scroll restored");
  await burger.tap(); await pg.waitForTimeout(200); await pg.locator('.pe-drawer a[href="/proof"]').first().tap(); await pg.waitForTimeout(800);
  ok(await burger.getAttribute("aria-expanded") === "false", "link tap closes");
  const dctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const dp = await dctx.newPage(); await dp.goto(base + "/", { waitUntil: "load" }); await dp.waitForTimeout(500);
  ok(!(await dp.locator(".pe-nav__burger").isVisible()) && await dp.locator(".pe-nav__main").isVisible(), "desktop 1440: burger hidden, nav visible");
  if (shots) await dp.screenshot({ path: path.join(shots, "desktop_1440.png"), clip: { x: 0, y: 0, width: 1440, height: 300 } });
} finally { await b.close(); srv?.close(); }
if (fails) { console.log(`${fails} FAILED`); process.exit(1); } console.log("test_mobile_nav: all passed");
