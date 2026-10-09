// L10 gap guards (SITE_GRADE_2026-10-09): touch targets, footer contrast, FlowDriver reduced motion, js_budget behaviour.
// Addresses the PASS_WITH_NOTES in state/fleet/reviews.jsonl for a-site-flow (no FlowDriver test) and a-site-js-trim (no js_budget test).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const rd = (p) => fs.readFileSync(p, "utf8");

const footer = rd("components/Footer.tsx");
ok(!/opacity:\s*0\.6/.test(footer) && /color:\s*"var\(--dim\)"/.test(footer), "footer microcopy uses --dim (AA), not opacity 0.6 (measured 3.36:1)");
ok(!/minHeight:\s*(2\d|3\d)\b/.test(footer) && /minHeight:\s*44/.test(footer), "footer links are 44 px tall");
ok(/minHeight:\s*44/.test(rd("components/AnimatedButton.tsx")), "secondary link buttons are 44 px tall");
const ds = rd("app/design-system.css");
ok(/L10 touch targets/.test(ds) && /main li > a/.test(ds) && /\.nav-burger \{ min-height: 44px/.test(ds), "design-system.css carries the 44 px touch-target block");

const fd = rd("components/flow/FlowDriver.tsx");
ok(fd.indexOf("prefers-reduced-motion: reduce") > 0 && fd.indexOf("prefers-reduced-motion: reduce") < fd.indexOf("querySelectorAll<HTMLElement>(\"[data-flow]\")"), "FlowDriver bails out for reduced motion before touching any layer");
ok(/data-flow-thread/.test(rd("components/flow/FlowThread.tsx")) && /data-tile=/.test(rd("components/flow/FlowThread.tsx")), "FlowThread renders the data-flow-thread + data-tile hooks FlowDriver reads");
ok(/\.fx-thread__pulse[^}]*animation: none/.test(rd("app/design-system.css").replace(/\n/g, " ")), "reduced-motion CSS stills the thread pulse");

// js_budget.mjs behaviour on a fixture export: over budget exits 1, under budget exits 0, noModule polyfill is not counted
const T = fs.mkdtempSync(path.join(os.tmpdir(), "jsb-"));
try {
  fs.mkdirSync(path.join(T, "_next"), { recursive: true });
  const rnd = (n) => { let b = Buffer.alloc(n); for (let i = 0; i < n; i++) b[i] = (i * 2654435761) >>> 24; return b; };
  fs.writeFileSync(path.join(T, "_next/a.js"), rnd(60000));
  fs.writeFileSync(path.join(T, "_next/poly.js"), rnd(60000));
  fs.writeFileSync(path.join(T, "index.html"), '<script src="/_next/a.js"></script><script src="/_next/poly.js" noModule></script>');
  const kb = zlib.gzipSync(rnd(60000)).length / 1024;
  const run = (b) => spawnSync("node", ["scripts/js_budget.mjs", T, String(b)], { encoding: "utf8" });
  ok(run(Math.floor(kb) - 5).status === 1, "js_budget exits 1 when a route is over budget");
  ok(run(Math.ceil(kb) + 5).status === 0, "js_budget exits 0 under budget, and the noModule polyfill is not counted");
} finally { fs.rmSync(T, { recursive: true, force: true }); }

if (fs.existsSync("out/index.html")) {
  const h = rd("out/index.html");
  ok(/data-flow-thread/.test(h) && /data-flow="0\.\d+"/.test(h), "built home carries the flow thread and parallax layer attributes");
}
console.log(fail ? `FAIL ${fail}` : "ALL PASS"); process.exit(fail ? 1 : 0);
