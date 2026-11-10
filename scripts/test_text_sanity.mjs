// C9 regression test (f373): the rendered-text sanity sweep must fail on an unclassified banned token, an empty counter slot or an
// off-centre hero CTA. Part A (always): allowlist lint, pure classifier checks, and two PLANTS rendered in a real browser:
// a planted bad string and a planted off-centre button must each fail the sweep, and a clean control must pass.
// Part B (--built <dir>): the full export, every route at 390 and 1280, zero unclassified hits and zero CTA offsets above 2 px.
// Usage: node scripts/test_text_sanity.mjs [--built out]
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { sweep, listRoutes } from "./lib/text_sanity.mjs";
import { loadAllowlist, lintAllowlist, classifyHit, ctaOffset, evaluate } from "./text_sanity_classify.mjs";

let fails = 0; const ok = (c, m) => { if (c) console.log("ok   " + m); else { fails++; console.error("FAIL " + m); } };
const al = loadAllowlist();
ok(lintAllowlist(al).length === 0, "allowlist lint clean: " + lintAllowlist(al).join("; "));
// pure classifier
ok(classifyHit({ token: "UNKNOWN", text: "UNKNOWN" }, "/contact", al).class === "defect", "bare UNKNOWN on /contact is a defect");
ok(classifyHit({ token: "undefined", text: "undefined" }, "/offers/x", al).class === "defect", "undefined is never allowlisted");
ok(classifyHit({ token: "NaN", text: "NaN%" }, "/", al).class === "defect", "NaN on / is a defect");
ok(classifyHit({ token: "UNKNOWN", text: "UNKNOWN now. Last measured 2026-10-08." }, "/", al).class === "followup", "stale tile on / is a labelled follow-up");
ok(classifyHit({ token: "UNKNOWN", text: "UNKNOWN now. Last measured 2026-10-08." }, "/contact", al).class === "defect", "stale tile text on a non-feed route is a defect");
ok(ctaOffset({ h1Align: "start", groupCx: 100, heroCx: 640 }) === null, "left-aligned hero is not measured for centring");
ok(ctaOffset({ h1Align: "center", groupCx: 641.5, heroCx: 640 }).off === false, "1.5 px offset is inside tolerance");
ok(ctaOffset({ h1Align: "center", groupCx: 643, heroCx: 640 }).off === true, "3 px offset is flagged");

// browser plants
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "textsanity-"));
if (!dir.includes("textsanity-")) throw new Error("fixture dir guard");
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>body{margin:0;font:16px sans-serif}section{padding:40px 20px;text-align:center}.row{display:flex;flex-wrap:wrap;justify-content:center;gap:14px}.btn{display:inline-block;padding:12px 24px;background:#c9a454;color:#000;text-decoration:none}.note{margin:8px 0}</style></head><body><main>${body}</main></body></html>`;
const hero = (row) => `<section><h1>Fixture hero</h1><div class="row">${row}</div></section>`;
fs.writeFileSync(path.join(dir, "control.html"), page(hero(`<a class="btn" href="/x">Start</a>`)));
fs.writeFileSync(path.join(dir, "plant-text.html"), page(hero(`<a class="btn" href="/x">Start</a>`) + `<p>Savings: undefined per month</p>`));
fs.writeFileSync(path.join(dir, "plant-off.html"), page(hero(`<a class="btn" href="/x">Start</a><p class="note" style="flex:0 1 700px">A note that shares the button row and drags it left.</p>`)));
fs.writeFileSync(path.join(dir, "plant-off2.html"), page(`<section><h1>Fixture hero</h1><div style="display:flex"><a class="btn" href="/x" style="margin-left:0">Start</a></div></section>`));
const sw = await sweep({ root: dir, routes: ["/control", "/plant-text", "/plant-off", "/plant-off2"], settleMs: 100 });
if (sw.skipped) { console.log("SKIP " + sw.skipped); process.exit(fails ? 1 : 0); }
const only = (route) => evaluate(sw.results.filter((r) => r.route === route), al);
const c = only("/control"); ok(c.defects.length === 0 && c.ctaDefects.length === 0 && c.errors.length === 0, "clean control passes at 390 and 1280");
const t = only("/plant-text"); ok(t.defects.length >= 2 && t.defects.every((d) => d.token === "undefined"), `planted 'undefined' string fails the sweep (${t.defects.length} hits at 2 widths)`);
const o = only("/plant-off"); ok(o.ctaDefects.length >= 1, `planted button dragged off-centre by a shared note fails (${o.ctaDefects.map((x) => x.offset + "px@" + x.width).join(", ")})`);
const o2 = only("/plant-off2"); ok(o2.ctaDefects.length >= 1, `planted left-pinned button under a centred heading fails (${o2.ctaDefects.map((x) => x.offset + "px@" + x.width).join(", ")})`);
fs.rmSync(dir, { recursive: true, force: true });

// Part B
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const root = process.argv[bi + 1] || "out";
  const routes = listRoutes(root);
  const real = await sweep({ root, routes });
  const ev = evaluate(real.results, al);
  ok(ev.errors.length === 0, `every route rendered (${routes.length} routes x 2 widths)` + (ev.errors.length ? ": " + ev.errors.slice(0, 3).join("; ") : ""));
  ok(ev.defects.length === 0, `zero unclassified text hits` + (ev.defects.length ? ":\n  " + ev.defects.slice(0, 15).map((d) => `${d.route}@${d.width} ${d.token} "${d.text}"`).join("\n  ") : ""));
  ok(ev.overCap.length === 0, "follow-up counts within their caps " + JSON.stringify(ev.followupCounts) + ev.overCap.join("; "));
  ok(ev.ctaDefects.length === 0, `zero off-centre hero CTAs above 2 px` + (ev.ctaDefects.length ? ":\n  " + ev.ctaDefects.slice(0, 15).map((d) => `${d.route}@${d.width} ${d.offset}px "${d.label}"`).join("\n  ") : ""));
}
console.log(fails ? `\ntext_sanity: ${fails} FAILED` : "\ntext_sanity: all passed");
process.exit(fails ? 1 : 0);
