// Tests for scripts/link_meta_gate.mjs (STATIC LINT). Synthetic fixtures only, built in a temp dir.
// Each rule: a failing fixture, a passing fixture, and a mutant (rule disabled) that must be caught.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { lintSite, summarise, parseHtml, RULES, SITE } from "./link_meta_gate.mjs";

let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error("FAIL " + m); } else console.log("ok   " + m); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lmg-"));
if (!tmp.startsWith(os.tmpdir() + path.sep)) throw new Error("bad tmp");

function page({ title = "T", desc = "D", canon, og = "/og.png", ogTitle = "OT", body = "", route = "/" } = {}) {
  const c = canon === undefined ? SITE + (route === "/" ? "" : route) : canon;
  return `<!DOCTYPE html><html><head>${title === null ? "" : `<title>${title}</title>`}${desc === null ? "" : `<meta name="description" content="${desc}"/>`}${c ? `<link rel="canonical" href="${c}"/>` : ""}${ogTitle === null ? "" : `<meta property="og:title" content="${ogTitle}"/>`}${og === null ? "" : `<meta property="og:image" content="${SITE}${og}"/>`}</head><body>${body}</body></html>`;
}
function site(name, pages) {
  const out = path.join(tmp, name, "out"), pub = path.join(tmp, name, "public");
  fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(pub, { recursive: true });
  fs.writeFileSync(path.join(pub, "og.png"), "x");
  for (const [route, html] of Object.entries(pages)) {
    const f = route === "/" ? "index.html" : route.slice(1) + ".html";
    fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
    fs.writeFileSync(path.join(out, f), html);
  }
  return { out, pub };
}
const count = (routes, rule) => Object.values(routes).flat().filter((v) => v.rule === rule).length;
const good = (route, extra = {}) => page({ route, title: "Title " + route, desc: "Desc " + route, ...extra });

// baseline: clean site has zero violations
{
  const s = site("clean", { "/": good("/", { body: '<a href="/about">a</a><img src="/og.png"/>' }), "/about": good("/about") });
  const r = lintSite(s.out, { publicDir: s.pub });
  ok(summarise(r).total === 0, "clean fixture: zero violations");
}

// [rule, failing pages, passing pages]
const CASES = {
  "link-unresolved": [
    { "/": good("/", { body: '<a href="/nope">x</a>' }) },
    { "/": good("/", { body: '<a href="/about#x">x</a><a href="mailto:a@b.c">m</a><a href="https://x.y">e</a>' }), "/about": good("/about") },
  ],
  "dup-title": [
    { "/": good("/", { title: "Same" }), "/a": good("/a", { title: "Same" }) },
    { "/": good("/", { title: "One" }), "/a": good("/a", { title: "Two" }) },
  ],
  "dup-description": [
    { "/": good("/", { desc: "Same" }), "/a": good("/a", { desc: "Same" }) },
    { "/": good("/", { desc: "One" }), "/a": good("/a", { desc: "Two" }) },
  ],
  "missing-title": [{ "/": good("/", { title: null }) }, { "/": good("/") }],
  "missing-description": [{ "/": good("/", { desc: null }) }, { "/": good("/") }],
  "missing-canonical": [{ "/": good("/", { canon: "" }) }, { "/": good("/") }],
  "canonical-not-self": [{ "/a": good("/a", { canon: SITE + "/b" }) }, { "/a": good("/a", { canon: SITE + "/a/" }) }],
  "missing-og-title": [{ "/": good("/", { ogTitle: null }) }, { "/": good("/") }],
  "og-image-tag-missing": [{ "/": good("/", { og: null }) }, { "/": good("/") }],
  "og-image-file-missing": [{ "/": good("/", { og: "/ghost.png" }) }, { "/": good("/") }],
};
ok(Object.keys(CASES).sort().join() === [...RULES].sort().join(), "every rule has a case");
for (const [rule, [bad, pass]] of Object.entries(CASES)) {
  const b = site("bad-" + rule, bad), p = site("pass-" + rule, pass);
  ok(count(lintSite(b.out, { publicDir: b.pub }), rule) >= 1, `${rule}: failing fixture flagged`);
  ok(count(lintSite(p.out, { publicDir: p.pub }), rule) === 0, `${rule}: passing fixture clean`);
  ok(count(lintSite(b.out, { publicDir: b.pub, disable: [rule] }), rule) === 0, `${rule}: mutant (rule disabled) caught, failing fixture goes silent`);
}

// parser edge cases: quotes, comments, script bodies, entities
{
  const h = '<!--<title>x</title>--><script>var a="<title>no</title>"</script><title>A &amp; B</title><a href=\'/q?a=1&amp;b=2\' data-x="1>2">l</a>';
  const { tags, title } = parseHtml(h);
  ok(title === "A & B", "parser: comment/script ignored, entity decoded");
  ok(tags.find((t) => t.name === "a")?.attrs.href === "/q?a=1&b=2", "parser: single-quoted href, > inside quoted attr");
}

// CLI: exit non-zero over baseline, zero at/under it; worst-5 and per-route counts printed
{
  const b = site("cli", { "/": good("/", { title: null, desc: null, body: '<a href="/x">x</a>' }), "/a": good("/a") });
  const run = (n) => spawnSync("node", ["scripts/link_meta_gate.mjs", b.out, "--public", b.pub, "--baseline", String(n)], { encoding: "utf8" });
  const over = run(0), under = run(99);
  ok(over.status === 1 && /LINKMETA FAIL/.test(over.stderr), "CLI: exit 1 over baseline");
  ok(under.status === 0 && /LINKMETA PASS/.test(under.stdout), "CLI: exit 0 under baseline");
  ok(/worst 5 routes:\n\s+\d+\t\//.test(over.stdout), "CLI: prints worst routes with counts");
  ok(/STATIC LINT/.test(over.stdout), "CLI: labelled static lint");
  ok(spawnSync("node", ["scripts/link_meta_gate.mjs", path.join(tmp, "absent")]).status === 2, "CLI: missing out/ exits 2");
}

// real export, when present: must be at or under the stated baseline
{
  const out = process.env.LMG_OUT || "out";
  if (fs.existsSync(out)) {
    const r = spawnSync("node", ["scripts/link_meta_gate.mjs", out, "--public", process.env.LMG_PUBLIC || "public"], { encoding: "utf8" });
    ok(r.status === 0, `real export ${out}: at or under baseline`);
  } else console.log("skip real export (no out/; run next build, or set LMG_OUT)");
}
fs.rmSync(tmp, { recursive: true, force: true });
if (fail) { console.error(fail + " failure(s)"); process.exit(1); }
console.log("link_meta_gate tests: ALL OK");
