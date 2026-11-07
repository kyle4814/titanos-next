// f262: every in-page anchor of the portal seats exists exactly once per page, is linked from the page's own
// "On this page" nav, is honest ("Built" or "Coming, not built yet"), and carries no dash or unlisted figure.
// Source checks always; with `--built out` also checks the exported HTML.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const PAGES = { "/app": "app/app", "/pro": "app/pro", "/agents": "app/agents", "/enterprise": "app/enterprise" };
const EXPECT = {
  "/app": ["auto-fix"], "/pro": ["white-label-reports", "leads"], "/agents": ["upgrade-dock"],
  "/enterprise": ["estate", "dossiers", "nukes", "savings-calculator", "sso"],
};
const comp = fs.readFileSync("components/SeatAnchors.tsx", "utf8");
ok(/id=\{r\.id\}/.test(comp) && /href=\{`#\$\{r\.id\}`\}/.test(comp), "component renders id={r.id} once and links href=#id for every row");
ok((comp.match(/id=\{r\.id\}/g) || []).length === 1, "component sets the section id in exactly one place");
// /enterprise#estate moved from PARKED (coming) to built: live status, component wired into the section (f274).
{
  const a = fs.readFileSync("app/enterprise/anchors.ts", "utf8").split('id: "estate"')[1]?.split('id: "dossiers"')[0] || "";
  ok(/status: "live"/.test(a), "/enterprise#estate anchor is built (live)");
  ok(/<EstateView \/>/.test(comp), "/enterprise#estate section renders the EstateView component");
}
const builtIdx = process.argv.indexOf("--built");
const out = builtIdx > 0 ? process.argv[builtIdx + 1] : null;
const allText = [];
for (const [route, dir] of Object.entries(PAGES)) {
  const src = fs.readFileSync(path.join(dir, "anchors.ts"), "utf8");
  const page = fs.readFileSync(path.join(dir, "page.tsx"), "utf8");
  const ids = [...src.matchAll(/^\s*id: "([a-z0-9-]+)"/gm)].map((m) => m[1]);
  ok(JSON.stringify(ids) === JSON.stringify(EXPECT[route]), `${route} anchors = ${EXPECT[route].join(", ")}`);
  ok(new Set(ids).size === ids.length, `${route} anchor ids unique`);
  ok(/<SeatAnchors rows=\{ANCHORS\} \/>/.test(page) && (page.match(/<SeatAnchors /g) || []).length === 1, `${route} page renders SeatAnchors exactly once (nav link + section per id)`);
  for (const m of src.matchAll(/status: "(\w+)"/g)) ok(m[1] === "live" || m[1] === "coming", `${route} status ${m[1]} is live|coming`);
  for (const m of src.matchAll(/body: "([^"]*)"/g)) {
    allText.push(m[1]);
    ok(!/[–—]/.test(m[1]), `${route} body has no em or en dash`);
    ok(!/\d/.test(m[1]), `${route} body publishes no number (figures stay in lib/pricing.ts)`);
  }
  if (out) {
    const f = path.join(out, route.slice(1) + ".html"), g = path.join(out, route.slice(1), "index.html");
    const file = fs.existsSync(f) ? f : g;
    ok(fs.existsSync(file), `${route} exported at ${file}`);
    if (fs.existsSync(file)) {
      const html = fs.readFileSync(file, "utf8");
      for (const id of ids) {
        ok((html.match(new RegExp(`<section[^>]* id="${id}"`, "g")) || []).length === 1, `${route}#${id} section id appears exactly once in HTML`);
        ok(new RegExp(`href="#${id}"`).test(html), `${route}#${id} linked from the On this page nav`);
      }
    }
  }
}
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
if (fs.existsSync(lint)) {
  const tmp = fs.mkdtempSync("/tmp/f262-lint-"); const f = path.join(tmp, "copy.txt");
  fs.writeFileSync(f, allText.join("\n\n") + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  ok(r.status === 0, "content_lint --no-cta CLEAN on anchor copy" + (r.status ? " :: " + (r.stdout + r.stderr).slice(0, 300) : ""));
  fs.rmSync(tmp, { recursive: true, force: true });
} else console.log("NOTE content_lint absent, lint check skipped");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
