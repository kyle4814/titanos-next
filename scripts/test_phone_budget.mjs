// Tests for scripts/phone_budget.mjs: fixture exports only, in a checked temp dir. All figures MODELLED.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { measureRoute, modelTti, discoverRoutes, BUDGET } from "./phone_budget.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "phonebud-"));
assert.ok(root && root.startsWith(os.tmpdir()), "fixture root must be a real temp dir");
const noise = (n) => crypto.randomBytes(n).toString("base64"); // incompressible-ish text, so gzip size ~ raw
const page = (head, body = "<main>hi</main>") => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
function fixture(name, { routes, files }) {
  const d = path.join(root, name);
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); }
  for (const [r, h] of Object.entries(routes)) fs.writeFileSync(path.join(d, r === "/" ? "index.html" : `${r.slice(1)}.html`), h);
  return d;
}
const clean = (extraHead = "") => page(`<link rel="stylesheet" href="/a.css"/><script src="/a.js" async></script>${extraHead}`);
const base = { "a.css": "body{margin:0}", "a.js": "console.log(1)" };

// 1. clean fixture passes
{
  const d = fixture("clean", { routes: { "/": clean(), "/scan": clean() }, files: base });
  for (const r of ["/", "/scan"]) { const m = measureRoute(d, r); assert.equal(m.pass, true, JSON.stringify(m.fails)); assert.equal(m.label, "MODELLED"); assert.equal(m.requests, 3); assert.equal(m.thirdPartyHosts.length, 0); }
  assert.deepEqual(discoverRoutes(d), ["/", "/scan"]);
}
// 2. oversize asset fails (JS over 170 KB gzip), names it in top 3
{
  const d = fixture("big", { routes: { "/": clean() }, files: { ...base, "a.js": noise(300 * 1024) } });
  const m = measureRoute(d, "/");
  assert.equal(m.pass, false); assert.ok(m.jsGzKB > BUDGET.jsGzKB); assert.match(m.fails.join(), /JS gzip/); assert.equal(m.top3[0].url, "/a.js");
}
// 3. third-party script fails; first-party absolute URL does not
{
  const d = fixture("tp", { routes: { "/": clean(`<script src="https://cdn.evil.example/x.js" async></script>`) }, files: base });
  const m = measureRoute(d, "/");
  assert.equal(m.pass, false); assert.deepEqual(m.thirdPartyHosts, ["cdn.evil.example"]);
  const d2 = fixture("fp", { routes: { "/": clean(`<link rel="stylesheet" href="https://titanos.tech/a.css"/>`) }, files: base });
  assert.equal(measureRoute(d2, "/").thirdPartyHosts.length, 0);
}
// 4. too many requests fails
{
  const imgs = Array.from({ length: 31 }, (_, i) => `<img src="/i${i}.png"/>`).join("");
  const files = { ...base, ...Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`i${i}.png`, "x"])) };
  const m = measureRoute(fixture("many", { routes: { "/": page(`<script src="/a.js" async></script>`, imgs) }, files }), "/");
  assert.equal(m.pass, false); assert.match(m.fails.join(), /requests 33/);
}
// 5. render-blocking script detected; async/defer/module/noModule are not
{
  const d = fixture("rb", { routes: { "/": page(`<script src="/a.js"></script><script src="/b.js" defer></script><script src="/c.js" type="module"></script><script src="/d.js" noModule=""></script>`) }, files: { "a.js": "1", "b.js": "1", "c.js": "1", "d.js": "1" } });
  const m = measureRoute(d, "/");
  assert.deepEqual(m.renderBlockingScripts, ["/a.js"]); assert.equal(m.requests, 4);
}
// 6. missing route and missing asset both fail
{
  const d = fixture("miss", { routes: { "/": clean() }, files: { "a.css": "x" } });
  assert.equal(measureRoute(d, "/scan").missing, true);
  assert.match(measureRoute(d, "/").fails.join(), /missing from export/);
}
// 7. formula monotone in every byte/count input, and TTI exceeds budget for a huge page
{
  const m0 = { htmlGz: 10e3, criticalGz: 100e3, criticalRequests: 10, jsRaw: 300e3 };
  const t0 = modelTti(m0).tti;
  for (const k of Object.keys(m0)) { let prev = t0; for (const mult of [1.5, 3, 10]) { const t = modelTti({ ...m0, [k]: m0[k] * mult }).tti; assert.ok(t >= prev, `${k} not monotone`); prev = t; } assert.ok(modelTti({ ...m0, [k]: m0[k] * 10 }).tti > t0, `${k} has no effect`); }
  assert.ok(modelTti({ ...m0, criticalGz: 3e6 }).tti > BUDGET.ttiS);
  // worked check: 1.6 Mbps = 200000 B/s; 100 kB critical = 0.5 s
  const z = modelTti({ htmlGz: 0, criticalGz: 200000, criticalRequests: 0, jsRaw: 0 });
  assert.ok(Math.abs(z.transfer - 1) < 1e-9 && Math.abs(z.connect - 0.45) < 1e-9);
}
fs.rmSync(root, { recursive: true, force: true });
console.log("test_phone_budget: OK (clean pass, oversize fail, third-party fail, request cap, render-blocking, missing, formula monotone)");
