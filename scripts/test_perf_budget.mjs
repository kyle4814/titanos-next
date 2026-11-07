// test_perf_budget.mjs - static page-weight gate (f282_c9). Usage: node scripts/test_perf_budget.mjs [outDir=out]
// Part 1 (always): fixtures prove the gate fails over budget and passes under it, one mutant per budget line.
// Part 2: measure the real built out/ against scripts/perf_budget.json. No out/ = "SKIPPED-NO-BUILD" (exit 0, said plainly).
// Budgets are page weight only (HTML bytes, JS bytes, image bytes, render-blocking scripts); gzip JS per route stays in js_budget.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { measure, check, renderBlocking } from "./lib/perf_budget.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const budget = JSON.parse(fs.readFileSync(path.join(HERE, "perf_budget.json"), "utf8"));
let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { if (c) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, extra); } };

// ---- Part 1: fixtures ----
const T = fs.mkdtempSync(path.join(os.tmpdir(), "perfbud."));
if (!T.startsWith(os.tmpdir() + path.sep + "perfbud.")) { console.log("refusing fixture path", T); process.exit(97); }
try {
  const mk = (name, { html = "<html><head></head><body>x</body></html>", js = 100, img = 100 } = {}) => {
    const d = path.join(T, name); fs.mkdirSync(path.join(d, "_next"), { recursive: true }); fs.mkdirSync(path.join(d, "img"), { recursive: true });
    fs.writeFileSync(path.join(d, "index.html"), html);
    fs.writeFileSync(path.join(d, "_next", "a.js"), "x".repeat(js));
    fs.writeFileSync(path.join(d, "img", "a.png"), "x".repeat(img));
    return d;
  };
  const tiny = { schema: 1, maxHtmlBytesPerRoute: 1000, maxRenderBlockingScriptsPerRoute: 1, maxTotalJsBytes: 1000, maxTotalImageBytes: 1000, routeOverrides: {} };
  ok(check(measure(mk("under")), tiny).length === 0, "fixture under budget passes");
  ok(check(measure(mk("bightml", { html: "<html>" + "x".repeat(2000) + "</html>" })), tiny).some((f) => f.startsWith("html /index")), "fixture over HTML budget fails");
  ok(check(measure(mk("bigjs", { js: 2000 })), tiny).some((f) => f.startsWith("total js")), "fixture over JS budget fails");
  ok(check(measure(mk("bigimg", { img: 2000 })), tiny).some((f) => f.startsWith("total images")), "fixture over image budget fails");
  const blocking = '<html><head><script src="/a.js"></script><script src="/b.js"></script></head></html>';
  ok(check(measure(mk("block", { html: blocking })), tiny).some((f) => f.startsWith("render-blocking")), "fixture with 2 blocking scripts (limit 1) fails");
  ok(check(measure(mk("ovr", { html: "<html>" + "x".repeat(2000) + "</html>" })), { ...tiny, routeOverrides: { "/index": { maxHtmlBytes: 5000 } } }).length === 0, "route override raises that route's HTML budget");
  ok(renderBlocking('<head><script src="/a.js" async></script><script src="/b.js" defer></script><script src="/c.js" type="module"></script><script src="/d.js" noModule></script><script>inline()</script></head>') === 0, "async, defer, module, noModule and inline scripts are not render-blocking");
  ok(renderBlocking('<head></head><body><script src="/a.js"></script></body>') === 0, "body scripts are not counted");
  ok(renderBlocking('<head><script src="/a.js"></script></head>') === 1, "plain head script counts");
} finally { fs.rmSync(T, { recursive: true, force: true }); }

// ---- Part 2: the real build ----
const OUT = path.resolve(process.argv[2] || path.join(HERE, "..", "out"));
if (!fs.existsSync(OUT) || !fs.statSync(OUT).isDirectory() || !fs.readdirSync(OUT).some((f) => f.endsWith(".html"))) {
  console.log(`SKIPPED-NO-BUILD real-site budget not checked: no built export at ${OUT} (run npm run build, then node scripts/test_perf_budget.mjs). Fixtures above are the only evidence this run.`);
} else {
  const m = measure(OUT);
  const fails = check(m, budget);
  const worst = Object.entries(m.routes).sort((a, b) => b[1].htmlBytes - a[1].htmlBytes)[0];
  console.log(`real build ${OUT}: routes ${Object.keys(m.routes).length} js ${m.jsBytes} img ${m.imageBytes} worst html ${worst[0]} ${worst[1].htmlBytes}`);
  ok(fails.length === 0, "real build within perf_budget.json", "\n  " + fails.slice(0, 20).join("\n  "));
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
