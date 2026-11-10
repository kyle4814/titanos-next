// C1 beacon scan id. ALL DATA SYNTHETIC. Part A: payload logic. Part B: built site in a phone browser, sendBeacon stubbed,
// scan then GET THIS FIXED, captured events fed through funnelKillTest: scans and presses match, 0 orphans.
// Part B SKIPs (says so, exit 0) when out/ or a browser is missing.
import assert from "node:assert/strict";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { buildPayload, newScanId, payloadFromTarget } from "../lib/beacon.ts";
import { funnelKillTest } from "./funnel_killtest.mjs";
import { FIXTURES, fakeDoh } from "../lib/guestscan/fixtures.ts";

let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok - ${name}`); };
const el = (attrs) => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null) });

t("newScanId is opaque random hex, unique, 32 chars", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newScanId())); assert.equal(ids.size, 500);
  for (const i of ids) assert.match(i, /^[0-9a-f]{32}$/);
});
t("payload keys are exactly event,path,ts (+scanId when valid): no second schema", () => {
  assert.deepEqual(Object.keys(buildPayload("pageview", "/", null, 5)).sort(), ["event", "path", "ts"]);
  const id = newScanId();
  assert.deepEqual(Object.keys(buildPayload("scan-get-fixed", "/scan", id, 5)).sort(), ["event", "path", "scanId", "ts"]);
  assert.deepEqual(buildPayload("scan-get-fixed", "/scan", id, 7), { event: "scan-get-fixed", path: "/scan", ts: 7, scanId: id });
});
t("backwards compatible: old consumers reading {event,path} still see them unchanged", () => {
  const p = buildPayload("scan-instant-run", "/scan", newScanId(), 1); const { event, path: pa } = JSON.parse(JSON.stringify(p));
  assert.equal(event, "scan-instant-run"); assert.equal(pa, "/scan");
});
t("junk or personal-looking scan ids are dropped, never sent", () => {
  for (const bad of ["", "short", "yourbusiness.com.au", "a@b.com", "x".repeat(65), "has space has space has space!"]) assert.equal("scanId" in buildPayload("e", "/", bad, 1), false, bad);
});
t("payloadFromTarget reads data-scan-id; elements without it send none; no data-analytics = null", () => {
  const id = newScanId();
  assert.equal(payloadFromTarget(el({ "data-analytics": "scan-get-fixed", "data-scan-id": id }), "/scan", 9).scanId, id);
  assert.equal("scanId" in payloadFromTarget(el({ "data-analytics": "nav-click" }), "/", 9), false);
  assert.equal(payloadFromTarget(el({}), "/", 9), null);
});
t("logic-level funnel: 1,000 scans, 30 presses through payloadFromTarget -> funnelKillTest, 0 orphans", () => {
  const ev = []; let ts = 1_700_000_000_000;
  for (let k = 0; k < 1000; k++) {
    const id = newScanId();
    ev.push(JSON.stringify(payloadFromTarget(el({ "data-analytics": "scan-instant-run", "data-scan-id": id }), "/scan", ts++)));
    if (k < 30) ev.push(JSON.stringify(payloadFromTarget(el({ "data-analytics": "scan-get-fixed", "data-scan-id": id }), "/scan", ts++)));
  }
  const r = funnelKillTest(ev); assert.equal(r.scans, 1000); assert.equal(r.presses, 30); assert.equal(r.orphanPresses, 0); assert.equal(r.scansWithoutId, 0); assert.equal(r.verdict, "PASS");
});
t("OLD beacon (no scanId) is all orphans: the defect this change fixes", () => {
  const ev = [{ event: "scan-instant-run", path: "/scan" }, { event: "scan-get-fixed", path: "/scan" }].map((e) => JSON.stringify(e));
  const r = funnelKillTest(ev); assert.equal(r.orphanPresses, 1);
});

// ---- Part B: browser flow ----
const root = path.resolve("out");
let chromium;
try { ({ chromium } = await import("playwright")); } catch { chromium = null; }
if (!fs.existsSync(path.join(root, "scan.html")) && !fs.existsSync(path.join(root, "scan", "index.html"))) { console.log(`SKIP part B (no built out/ ; run npm run build). ${n} logic tests passed`); process.exit(0); }
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
const srv = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]); let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = fs.existsSync(f + ".html") ? f + ".html" : path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
let b;
try { b = await chromium.launch(); } catch (e) { console.log("SKIP part B (no browser): " + String(e.message).split("\n")[0]); srv.close(); process.exit(0); }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { window.__beacons = []; navigator.sendBeacon = (url, blob) => { blob.text().then((x) => window.__beacons.push(x)); return true; }; });
const world = fakeDoh(FIXTURES.find((x) => x.id === "nothing-published").world);
await ctx.route("**/*", async (route) => {
  const u = new URL(route.request().url());
  if (u.hostname === "cloudflare-dns.com") { const body = await world.fetch(u.searchParams.get("name"), u.searchParams.get("type")); return route.fulfill({ status: 200, contentType: "application/dns-json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*" } }); }
  if (u.hostname !== "127.0.0.1") return route.abort();
  return route.continue();
});
const pg = await ctx.newPage();
await pg.goto(base + "/scan", { waitUntil: "load" });
const RUNS = Number(process.env.BEACON_RUNS || 3);
for (let i = 0; i < RUNS; i++) {
  await pg.fill('input[aria-label="Your domain"]', `https://www.syn${i}.example/`);
  await pg.click('button:has-text("Check now")');
  await pg.waitForSelector(`text=syn${i}.example`, { timeout: 10000 });
  if (i !== 1) await pg.click('button:has-text("GET THIS FIXED")'); // scan 1 is never pressed
  await pg.waitForTimeout(150);
}
await pg.waitForTimeout(300);
const raw = await pg.evaluate(() => window.__beacons);
await b.close(); srv.close();
const parsed = raw.map((x) => JSON.parse(x));
assert.ok(parsed.some((e) => e.event === "pageview" && !("scanId" in e)), "pageview has no scanId");
for (const e of parsed) assert.deepEqual(Object.keys(e).filter((k) => !["event", "path", "ts", "scanId"].includes(k)), [], "no extra keys: " + JSON.stringify(e));
assert.ok(!raw.join("").includes("syn0.example"), "domain never in a beacon");
const scans = parsed.filter((e) => e.event === "scan-instant-run"), presses = parsed.filter((e) => e.event === "scan-get-fixed");
assert.equal(scans.length, RUNS); assert.equal(presses.length, RUNS - 1);
assert.equal(new Set(scans.map((e) => e.scanId)).size, RUNS, "a fresh id per scan");
const r = funnelKillTest(raw);
console.log(JSON.stringify(r));
assert.equal(r.scans, RUNS); assert.equal(r.presses, RUNS - 1); assert.equal(r.orphanPresses, 0); assert.equal(r.scansWithoutId, 0); assert.equal(r.duplicatePresses, 0);
n++; console.log(`ok - browser flow: ${RUNS} scans, ${RUNS - 1} presses, 0 orphans through funnelKillTest`);
console.log(`PASS test_beacon_scanid (${n} tests)`);
