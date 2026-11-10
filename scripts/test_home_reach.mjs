// C10 gate: every exported route reachable from / (menu counts as 2 clicks), none deeper than 3, the shipped
// product pages within 2 clicks by a visible link, and a planted orphan must fail. Needs `next build` output.
// usage: node scripts/test_home_reach.mjs --built out   (without --built: allowlist hygiene only, prints SKIPPED-NO-BUILD)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { walk } from "./seo_audit.mjs";
import { evaluate } from "./home_reach.mjs";

const bi = process.argv.indexOf("--built");
const out = bi > 0 ? process.argv[bi + 1] : null;
const allow = JSON.parse(fs.readFileSync(new URL("./home_reach_allowlist.json", import.meta.url), "utf8"));
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const entries = Object.entries({ ...allow.orphans, ...allow.deep });
ok(entries.every(([, why]) => String(why).trim().length >= 15), `all ${entries.length} allowlist entries carry a written reason`);
if (!out || !fs.existsSync(path.join(out, "index.html"))) {
  console.log(fail ? `FAIL ${fail}` : "SKIPPED-NO-BUILD (allowlist hygiene only; run with --built out after next build)");
  process.exit(fail ? 1 : 0);
}

const { bad, pages, staticDepth, menuDepth } = evaluate(out, allow);
bad.forEach((b) => console.log("  " + b));
ok(bad.length === 0, `${pages.size} routes: no orphan, no depth breach, product pages within 2 clicks`);

// Mutation: copy the export, plant an unlinked page and a 4-deep chain; the gate must catch both.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "homereach-"));
try {
  fs.cpSync(out, tmp, { recursive: true });
  fs.writeFileSync(path.join(tmp, "planted-orphan.html"), '<html><head><meta name="robots" content="index"></head><body><h1>x</h1></body></html>');
  const m1 = evaluate(tmp, allow).bad;
  ok(m1.some((b) => b.startsWith("ORPHAN /planted-orphan")), "planted orphan page is caught");
  fs.writeFileSync(path.join(tmp, "planted-a.html"), '<a href="/planted-b">b</a>');
  fs.writeFileSync(path.join(tmp, "planted-b.html"), '<a href="/planted-c">c</a>');
  fs.writeFileSync(path.join(tmp, "planted-c.html"), '<a href="/planted-d">d</a>');
  fs.writeFileSync(path.join(tmp, "planted-d.html"), "<p>end</p>");
  let idx = fs.readFileSync(path.join(tmp, "index.html"), "utf8");
  fs.writeFileSync(path.join(tmp, "index.html"), idx.replace("</body>", '<a href="/planted-a">a</a></body>'));
  const m2 = evaluate(tmp, allow).bad;
  ok(m2.some((b) => b.startsWith("DEEP /planted-d")), "planted 4-click page is caught");
  // Mutation: drop the product links from every page -> product check must fail.
  for (const f of walk(tmp)) {
    const p = f; fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/href="\/(pro|agents|enterprise|app\/login)"/g, 'href="#"'));
  }
  ok(evaluate(tmp, allow).bad.some((b) => b.startsWith("PRODUCT")), "removing the seat links trips the product check");
  // Mutation: an allowlist entry with no reason, and a stale one.
  ok(evaluate(out, { orphans: { "/zzz": "" } }).bad.some((b) => /no written reason/.test(b)), "allowlist entry without a reason fails");
  ok(evaluate(out, { orphans: { "/zzz": "stale test" } }).bad.some((b) => /STALE/.test(b)), "stale allowlist entry fails");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
