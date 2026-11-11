// TIX-999 demo e2e: two isolated browser contexts (desktop wallet + phone-width scanner) that share ONLY the pairing link.
// The phone "camera" is a synthetic getUserMedia stream that shows whatever QR canvas the desktop hands over, so the
// real camera -> jsQR -> verifier path runs. Usage: node scripts/test_tix_e2e.mjs [shotsDir]   (needs `npm run build`)
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright";
const shots = process.argv[2]; if (shots) fs.mkdirSync(shots, { recursive: true });
const root = path.resolve("out");
if (!fs.existsSync(path.join(root, "demo/tix.html"))) {
  console.log("SKIP e2e: no build in out/ (run `npm run build` first; set TIX_E2E_REQUIRE=1 to make this fatal)");
  process.exit(process.env.TIX_E2E_REQUIRE ? 1 : 0);
}
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
  let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
let fail = 0; const errs = [];
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const shot = (pg, n) => shots ? pg.screenshot({ path: path.join(shots, n), fullPage: true }) : null;
const watch = (pg, who) => { pg.on("pageerror", (e) => errs.push(`${who}: ${e}`)); pg.on("console", (m) => { if (m.type() === "error") errs.push(`${who}: ${m.text()}`); }); };


// LOAD-AWARE BUDGETS (f324). Every wait budget = nominal idle-box ms x SCALE, where SCALE is measured in THIS run
// (a fixed CPU micro-benchmark vs its idle reference), clamped to [1, SCALE_MAX]. The ratio and denominator are printed.
// A wait only ever ends early on a REAL signal (selector present / verdict shown); the budget bounds a genuine break,
// so a removed selector or a 500 route still goes red, within nominal x SCALE (never an unbounded wait).
const REF_MS = 60, SCALE_MAX = 10;
const sample = () => { const t = performance.now(); let x = 0; for (let i = 0; i < 3e7; i++) x += i % 7; return performance.now() - t; };
const med = [sample(), sample(), sample()].sort((m, n) => m - n)[1];
const SCALE = Math.min(SCALE_MAX, Math.max(1, med / REF_MS));
const T = (nominal) => Math.ceil(nominal * SCALE);
console.log(`BUDGET baseline ${med.toFixed(0)}ms (median of 3) / idle ref ${REF_MS}ms = scale x${SCALE.toFixed(2)} (cap x${SCALE_MAX}); budget = nominal ms x scale`);
const steps = [];
const step = async (name, nominal, fn) => {
  const budget = T(nominal), t0 = performance.now();
  try { const r = await fn(budget); steps.push([name, performance.now() - t0, budget]); return r; }
  catch (e) { console.log(`FAIL step "${name}" after ${(performance.now() - t0).toFixed(0)}ms of ${budget}ms budget (nominal ${nominal} x${SCALE.toFixed(2)}): ${String(e.message).split("\n")[0]}`); throw e; }
};
const waitSel = (pg, sel, nominal = 20000, name = sel) => step(name, nominal, (t) => pg.waitForSelector(sel, { timeout: t }));
// TIX_E2E_MUTATE=selector|route500 proves the test still goes red on a genuine break (see test_tix_e2e_mutants.sh).
const MUT = process.env.TIX_E2E_MUTATE || "";

const b = await chromium.launch();
const A = await b.newContext({ viewport: { width: 1280, height: 800 } });
await A.addInitScript(() => { try { localStorage.setItem("titanos.declaration.dismissed.2026-11", "1"); } catch {} });  // keep the declaration popup out of this flow
const P = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await P.addInitScript(() => { try { localStorage.setItem("titanos.declaration.dismissed.2026-11", "1"); } catch {} });  // keep the declaration popup out of this flow
await P.addInitScript(() => {
  window.__frame = null;
  const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  if (!orig) return;
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement("canvas"); c.width = 640; c.height = 640;
    const g = c.getContext("2d"); const img = new Image();
    setInterval(() => { g.fillStyle = "#888"; g.fillRect(0, 0, 640, 640); if (window.__frame && img.complete && img.naturalWidth) g.drawImage(img, 20, 20, 600, 600); }, 50);
    setInterval(() => { if (window.__frame && img.src !== window.__frame) img.src = window.__frame; }, 50);
    return c.captureStream(15);
  };
});
const a = await A.newPage(); const p = await P.newPage(); watch(a, "desktop"); watch(p, "phone");
for (const pg of [a, p]) { pg.setDefaultTimeout(T(20000)); pg.setDefaultNavigationTimeout(T(30000)); }
if (MUT === "route500") await P.route("**/demo/tix/scan**", (r) => r.fulfill({ status: 500, body: "boom" }));
if (MUT === "selector") await P.addInitScript(() => { new MutationObserver(() => document.querySelectorAll('[data-testid="paired"]').forEach((e) => e.removeAttribute("data-testid"))).observe(document, { subtree: true, childList: true, attributes: true }); });

// start page + guide
await a.goto(base + "/demo/tix");
ok((await a.locator('[data-testid="guide"] li').count()) === 4, "start page shows the 4-step guide");
ok((await a.locator("meta[name=robots]").getAttribute("content")).includes("noindex"), "start page is noindex");
ok((await a.textContent("main")).includes("DEMO MODE"), "DEMO MODE note visible");
await shot(a, "01_start_desktop.png");
await a.click("text=Start the demo"); await waitSel(a, "text=Create event");
await a.fill('[aria-label="Event name"]', "Demo Fest 2026"); await a.click("text=Create event");
await a.fill('[aria-label="Fan name"]', "Sam Fan"); await a.click("text=Issue ticket");
await a.click("text=Show pairing code"); await waitSel(a, '[data-testid="pair"]');
const link = await a.inputValue('[aria-label="Pairing link"]');
ok(link.includes("/scan#p="), "organiser shows a pairing link/QR");
await shot(a, "02_organiser_pairing_desktop.png");

// phone shares only the link
await p.goto(base + "/demo/tix/scan");
await waitSel(p, '[data-testid="unpaired"]'); ok(true, "phone before pairing says Not paired");
await shot(p, "03_scanner_unpaired_phone.png");
await p.goto(link); await waitSel(p, '[data-testid="paired"]');
ok((await p.textContent('[data-testid="paired"]')).includes("Demo Fest 2026"), "phone paired from the link alone");
ok(!p.url().includes("#p="), "pairing key scrubbed from the address bar");

// wallet on desktop; camera path ADMIT
await a.goto(base + "/demo/tix/wallet"); await waitSel(a, '[data-testid="token"]:not(:empty)');
await shot(a, "04_wallet_desktop.png");
const frame = (sel) => a.evaluate((s) => document.querySelector(s).toDataURL("image/png"), sel);
const t1 = await a.textContent('[data-testid="token"]');
await p.click("text=Start camera");
await p.evaluate((u) => { window.__frame = u; }, await frame('canvas[aria-label="Rotating ticket QR code"]'));
await waitSel(p, "text=ADMIT", 15000, "camera verdict ADMIT");
ok((await p.textContent('[data-testid="sentence"]')).length > 20, "ADMIT shows a plain sentence");
await shot(p, "05_scanner_admit_phone.png");

// DUPLICATE (same live token pasted; camera dedupe window skipped by paste)
await p.fill('[aria-label="Ticket code"]', t1); await p.click("text=Verify code");
await waitSel(p, "text=DUPLICATE");
ok((await p.textContent('[data-testid="verdict"]')).includes("First scanned at"), "DUPLICATE shows first-scan time");
await shot(p, "06_scanner_duplicate_phone.png");

// screenshot copy goes stale -> EXPIRED through the camera
await a.click("text=Save a screenshot copy"); await waitSel(a, '[data-testid="copy-qr"]');
await step("copy goes stale (2 x 15s real clock + slack)", 45000, (t) => a.waitForFunction(() => document.querySelector('[data-testid="copy-age"]').textContent.startsWith("Stale"), null, { timeout: t }));
await shot(a, "07_wallet_cheat_desktop.png");
await p.evaluate((u) => { window.__frame = u; }, await frame('[data-testid="copy-qr"]'));
await waitSel(p, "text=EXPIRED", 15000, "camera verdict EXPIRED");
ok(true, "stale screenshot copy scanned by camera reads EXPIRED");
await shot(p, "08_scanner_expired_phone.png");

// forged code -> FAKE
await a.click("text=Show a forged code"); await waitSel(a, '[data-testid="forged-qr"]');
await p.evaluate((u) => { window.__frame = u; }, await frame('[data-testid="forged-qr"]'));
await waitSel(p, "text=FAKE", 15000, "camera verdict FAKE");
ok(true, "forged code scanned by camera reads FAKE");
await shot(p, "09_scanner_fake_phone.png");

// camera refused -> paste fallback visible and working; reset
const P2 = await b.newContext({ viewport: { width: 390, height: 844 } });
await P2.addInitScript(() => { try { localStorage.setItem("titanos.declaration.dismissed.2026-11", "1"); } catch {} });  // keep the declaration popup out of this flow
await P2.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("denied", "NotAllowedError"); }; });
const q = await P2.newPage(); watch(q, "phone-nocam");
await q.goto(link); await waitSel(q, '[data-testid="paired"]'); await q.click("text=Start camera");
await waitSel(q, '[role="alert"]');
await q.fill('[aria-label="Ticket code"]', await a.textContent('[data-testid="token"]')); await q.click("text=Verify code");
await waitSel(q, "text=ADMIT");
ok(true, "camera refused: alert shown and paste-code fallback ADMITs");
await shot(q, "10_scanner_camera_refused_paste.png");
q.on("dialog", (d) => d.accept()); await q.click("text=Reset scanner");
await waitSel(q, '[data-testid="unpaired"]');
ok(true, "scanner reset returns to Not paired");
a.on("dialog", (d) => d.accept()); await a.goto(base + "/demo/tix/organiser"); await a.click("text=Reset demo");
await a.waitForFunction(() => !document.body.textContent.includes("Demo Fest 2026"));
ok(true, "organiser reset clears the demo");

ok(errs.length === 0, `no console/page errors (${errs.length}) ${errs.slice(0, 3).join(" | ")}`);
await b.close(); srv.close();
console.log("STEPS " + steps.map(([n, ms, bud]) => `${n.slice(0, 28)}=${ms.toFixed(0)}/${bud}`).join(" | "));
console.log(fail ? `FAIL ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
