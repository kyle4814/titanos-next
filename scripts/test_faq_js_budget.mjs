// F284 regression: /faq first-load JS (gzip, module scripts) must stay <= 250 KB, and the static guard must hold.
// Usage: node scripts/test_faq_js_budget.mjs [--built out]   (static guard always runs; the built check runs when --built is given)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
const BUDGET = 250;
let fail = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
// Static guard: nothing on the /faq path may statically import the offer catalogue (57 KB gz of shelves).
const src = (f) => fs.readFileSync(f, "utf8");
const staticImports = (f) => [...src(f).matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
const heavy = /lib\/concierge\/(catalogue|portal|offers)|lib\/offers\/data\//;
ok(!staticImports("components/Concierge.tsx").some((i) => heavy.test(i)), "Concierge.tsx has no static import of the offer catalogue");
// f330: either lazy route keeps the catalogue out of first-load JS: a dynamic import(), or the f307 JSON loader (lib/concierge/lazy.ts, which never imports the catalogue).
const lazyJson = /from\s+["']@\/lib\/concierge\/lazy["']/.test(src("components/Concierge.tsx")) && !staticImports("lib/concierge/lazy.ts").some((i) => /catalogue/.test(i));
ok(/import\(["']@\/lib\/concierge\/catalogue["']\)/.test(src("components/Concierge.tsx")) || lazyJson, "Concierge.tsx loads the catalogue lazily (dynamic import() or the JSON loader)");
const i = process.argv.indexOf("--built");
if (i > 0) {
  const OUT = path.resolve(process.argv[i + 1] || "out");
  const html = fs.readFileSync(path.join(OUT, "faq.html"), "utf8");
  const tags = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].filter((m) => !/noModule/i.test(m[0]));
  const files = [...new Set(tags.map((m) => m[1].replace(/^\//, "")))].filter((s) => fs.existsSync(path.join(OUT, s)));
  const kb = files.reduce((a, s) => a + zlib.gzipSync(fs.readFileSync(path.join(OUT, s))).length, 0) / 1024;
  console.log(`/faq first-load JS ${kb.toFixed(1)} KB gz over ${files.length} scripts (budget ${BUDGET})`);
  ok(files.length > 0, "faq.html lists script files");
  ok(kb <= BUDGET, `/faq ${kb.toFixed(1)} KB <= ${BUDGET} KB`);
}
console.log(fail ? `faq js budget: ${fail} FAILED` : "faq js budget: all passed");
process.exit(fail ? 1 : 0);
