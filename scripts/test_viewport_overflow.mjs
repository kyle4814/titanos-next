// C10 regression test (f385): the viewport overflow sweep must fail on a planted 2000 px element at every width, reject an allowlist rule
// without a reason, and refuse a cap that rises. Part A (always): pure checks plus planted fixtures rendered in a real browser.
// Part B (--built <dir>): the full export at 360/768/1024/1440, zero unclassified defects, follow-ups within caps.
// Usage: node scripts/test_viewport_overflow.mjs [--built out]
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { sweep, listRoutes, WIDTHS } from "./lib/viewport_sweep.mjs";
import { loadAllowlist, lintAllowlist, classifyHit, evaluate, capsRise, allowlistAt, findings } from "./viewport_overflow_classify.mjs";

let fails = 0; const ok = (c, m) => { if (c) console.log("ok   " + m); else { fails++; console.error("FAIL " + m); } };
const al = loadAllowlist();
ok(lintAllowlist(al).length === 0, "committed allowlist lints clean: " + lintAllowlist(al).join("; "));

// allowlist lint: a rule without a reason (or a too-short one) is rejected
const good = { id: "r1", metric: "tap", routes: "^/x$", class: "intended", reason: "Decorative control, labelled on the page and measured by hand on 2026-11-10." };
ok(lintAllowlist({ rules: [good] }).length === 0, "a complete rule passes lint");
ok(lintAllowlist({ rules: [{ ...good, reason: undefined }] }).some((m) => /missing reason/.test(m)), "a rule with no reason is rejected");
ok(lintAllowlist({ rules: [{ ...good, reason: "because" }] }).some((m) => /too short/.test(m)), "a rule with a one-word reason is rejected");
ok(lintAllowlist({ rules: [{ ...good, class: "followup" }] }).some((m) => /max cap/.test(m)), "a followup with no cap is rejected");
ok(lintAllowlist({ rules: [{ ...good, metric: "hscroll", routes: ".*" }] }).some((m) => /catch-all/.test(m)), "a catch-all route rule on hscroll is rejected");
ok(lintAllowlist({ rules: [good, good] }).some((m) => /duplicate/.test(m)), "a duplicate id is rejected");

// pure classification
ok(classifyHit({ route: "/x", width: 360, metric: "hscroll", sel: "document" }, { rules: [] }).class === "defect", "an unlisted hit is a defect");
ok(classifyHit({ route: "/x", width: 360, metric: "tap", sel: "a" }, { rules: [good] }).class === "intended", "a listed hit is classed by its rule");
ok(classifyHit({ route: "/y", width: 360, metric: "tap", sel: "a" }, { rules: [good] }).class === "defect", "a rule on another route does not leak");
ok(classifyHit({ route: "/x", width: 1440, metric: "tap", sel: "a" }, { rules: [{ ...good, widths: [360] }] }).class === "defect", "a width-scoped rule does not leak to other widths");

// caps may fall, never rise
const fu = (max, id = "f1") => ({ rules: [{ id, metric: "tap", routes: "^/x$", class: "followup", max, followup: 1, reason: "Known tap target shortfall, tracked as numbered follow-up 1 in the receipt." }] });
ok(capsRise(fu(10), fu(10)).length === 0, "an unchanged cap is fine");
ok(capsRise(fu(10), fu(7)).length === 0, "a falling cap is fine");
ok(capsRise(fu(10), fu(11)).length === 1, "a rising cap is rejected");
ok(capsRise(fu(10), { rules: [...fu(10).rules, ...fu(5, "f2").rules] }).length === 1, "a brand new followup rule is rejected as a rise");
const committed = allowlistAt("HEAD");
if (committed) ok(capsRise(committed, al).length === 0, "working allowlist does not raise any cap versus HEAD");
else console.log("skip cap-vs-HEAD (allowlist not yet committed)");
// evaluate enforces the cap
const cap1 = { rules: [{ ...fu(1).rules[0], routes: "^/x$" }] };
const mk = (n) => ({ route: "/x", width: 360, error: null, hscroll: { over: false }, offenders: [], footer: [], taps: Array.from({ length: n }, (_, i) => ({ sel: "a", w: 20, h: 20, inline: false, text: "t" + i })) });
ok(evaluate([mk(1)], cap1).overCap.length === 0 && evaluate([mk(2)], cap1).overCap.length === 1, "evaluate fails a followup above its cap");
ok(findings([mk(3)]).length === 3 && findings([{ ...mk(1), taps: [{ sel: "a", inline: true, w: 5, h: 5 }] }]).length === 0, "inline text links are exempt from the tap count");

// browser plants
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpsweep-"));
if (!dir.includes("vpsweep-")) throw new Error("fixture dir guard");
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>body{margin:0;font:16px sans-serif}.btn{display:inline-block;min-width:44px;min-height:44px}.footer-columns{display:grid;grid-template-columns:1fr 1fr}</style></head><body><main>${body}</main></body></html>`;
fs.writeFileSync(path.join(dir, "control.html"), page(`<h1>Control</h1><a class="btn" href="/x">Go</a>`));
fs.writeFileSync(path.join(dir, "plant-wide.html"), page(`<h1>Plant</h1><div style="width:2000px;height:20px;background:#c00">wide</div>`));
fs.writeFileSync(path.join(dir, "plant-clipped.html"), page(`<h1>Clipped</h1><div style="overflow-x:auto;width:100%"><div style="width:2000px;height:20px">scroller</div></div>`));
fs.writeFileSync(path.join(dir, "plant-footer.html"), page(`<h1>Footer</h1><div class="footer-columns"><div style="margin-right:-30px;position:relative;left:-30px;height:40px">A</div><div style="height:40px">B</div></div>`));
fs.writeFileSync(path.join(dir, "plant-tap.html"), page(`<h1>Tap</h1><a href="/x" style="display:block;width:20px;height:20px">x</a>`));
const sw = await sweep({ root: dir, routes: ["/control", "/plant-wide", "/plant-clipped", "/plant-footer", "/plant-tap"], settleMs: 100 });
if (sw.skipped) { console.log("SKIP " + sw.skipped); process.exit(fails ? 1 : 0); }
const only = (route, a = { rules: [] }) => evaluate(sw.results.filter((r) => r.route === route), a);
const c = only("/control"); ok(c.defects.length === 0 && c.errors.length === 0, "clean control passes at all four widths");
const w = only("/plant-wide");
for (const width of WIDTHS) ok(w.defects.some((d) => d.width === width && d.metric === "hscroll") && w.defects.some((d) => d.width === width && d.metric === "offender"), `planted 2000px element fails at ${width}px (hscroll and offender)`);
ok(only("/plant-clipped").defects.filter((d) => d.metric === "offender" || d.metric === "hscroll").length === 0, "a 2000px child inside an overflow-x:auto scroller is not a defect");
ok(only("/plant-footer").defects.some((d) => d.metric === "footer" && /outside-viewport/.test(d.detail)), "a planted footer column pushed off the left edge fails");
ok(only("/plant-tap").defects.some((d) => d.metric === "tap" && d.width === 360) && !only("/plant-tap").defects.some((d) => d.metric === "tap" && d.width !== 360), "a planted 20px tap target fails at 360 only");
fs.rmSync(dir, { recursive: true, force: true });

// Part B
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const root = process.argv[bi + 1] || "out";
  const routes = listRoutes(root);
  const real = await sweep({ root, routes });
  const ev = evaluate(real.results, al);
  ok(ev.errors.length === 0, `every route rendered (${routes.length} routes x ${WIDTHS.length} widths)` + (ev.errors.length ? ": " + ev.errors.slice(0, 3).join("; ") : ""));
  ok(ev.defects.length === 0, `zero unclassified viewport defects` + (ev.defects.length ? ":\n  " + ev.defects.slice(0, 15).map((d) => `${d.route}@${d.width} [${d.metric}] ${d.detail}`).join("\n  ") : ""));
  ok(ev.overCap.length === 0, "follow-up counts within their caps " + JSON.stringify(ev.followupCounts) + ev.overCap.join("; "));
}
console.log(fails ? `\nviewport_overflow: ${fails} FAILED` : "\nviewport_overflow: all passed");
process.exit(fails ? 1 : 0);
