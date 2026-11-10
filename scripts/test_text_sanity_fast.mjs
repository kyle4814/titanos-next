// C9 FAST text-sanity gate test (f384). Part A (always): pure checks, mutation tests (cap cannot rise, sample must cover families), and
// planted pages rendered in a real browser run through runFast: a planted defect fails, a planted off-centre CTA fails, an over-cap F1 fails,
// a clean control passes. Part B (--built <dir>): the real sample covers every route family in the export, and the fast gate passes.
// Usage: node scripts/test_text_sanity_fast.mjs [--built out]
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { listRoutes } from "./lib/text_sanity.mjs";
import { loadAllowlist } from "./text_sanity_classify.mjs";
import { loadSample, loadRatchet, familyMap, checkSample, checkRatchet, runFast } from "./lib/text_sanity_fast.mjs";

let fails = 0; const ok = (c, m) => { if (c) console.log("ok   " + m); else { fails++; console.error("FAIL " + m); } };
const al = loadAllowlist(); const ratchet = loadRatchet(); const clone = (x) => JSON.parse(JSON.stringify(x));

// ratchet: real files agree; raising a cap or adding an un-ratcheted followup fails
ok(checkRatchet(al, ratchet).length === 0, "real allowlist caps are within the ratchet: " + checkRatchet(al, ratchet).join("; "));
const raised = clone(al); raised.textRules.find((r) => r.class === "followup").max += 1;
ok(checkRatchet(raised, ratchet).length === 1, "MUTATION: raising a followup cap by 1 fails the ratchet");
const lowered = clone(al); lowered.textRules.find((r) => r.class === "followup").max -= 1;
ok(checkRatchet(lowered, ratchet).length === 0, "lowering a cap is allowed");
const added = clone(al); added.textRules.push({ id: "F9-new", token: "NaN", routes: "^/x$", text: "x", class: "followup", max: 5, reason: "a brand new followup with no ratchet entry must fail the gate" });
ok(checkRatchet(added, ratchet).some((p) => p.includes("F9-new")), "MUTATION: a new followup rule without a ratchet entry fails");

// sample coverage: pure
const fake = ["/", "/a", "/b", "/offers", "/offers/x", "/offers/y", "/proof"];
ok(JSON.stringify(familyMap(fake)) === JSON.stringify({ "/": "root", "/a": "top", "/b": "top", "/offers": "offers", "/offers/x": "offers", "/offers/y": "offers", "/proof": "top" }), "family map: root, top-level singletons, multi-route segments");
ok(checkSample(["/", "/a", "/offers/x", "/proof"], fake, al).length === 0, "full-family sample passes the coverage check");
ok(checkSample(["/", "/a"], fake, al).some((p) => p.includes("offers")), "MUTATION: dropping a family from the sample fails");
ok(checkSample(["/", "/offers/x", "/gone"], fake, al).some((p) => p.includes("/gone")), "a sample route missing from the export fails");
ok(checkSample(["/", "/a", "/offers/x", "/proof"], [...fake, "/learning-loop"], al).some((p) => p.includes("F1-stale-feed")), "MUTATION: a route an F1 cap applies to but the sample omits fails");

// browser plants through runFast
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "textsanityfast-"));
if (!dir.includes("textsanityfast-")) throw new Error("fixture dir guard");
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>body{margin:0;font:16px sans-serif}section{padding:40px 20px;text-align:center}.row{display:flex;flex-wrap:wrap;justify-content:center;gap:14px}.btn{display:inline-block;padding:12px 24px;background:#c9a454;color:#000;text-decoration:none}.note{margin:8px 0}</style></head><body><main>${body}</main></body></html>`;
const hero = (row) => `<section><h1>Fixture hero</h1><div class="row">${row}</div></section>`;
const btn = `<a class="btn" href="/x">Start</a>`;
const w = (n, b) => fs.writeFileSync(path.join(dir, n), page(b));
w("control.html", hero(btn)); w("plant-text.html", hero(btn) + `<p>Savings: undefined per month</p>`);
w("plant-off.html", hero(`${btn}<p class="note" style="flex:0 1 700px">A note that shares the button row and drags it left.</p>`));
w("proof.html", hero(btn) + Array.from({ length: 170 }, () => `<p>UNKNOWN now. Last measured 2026-10-08.</p>`).join(""));
w("learning-loop.html", hero(btn) + Array.from({ length: 10 }, () => `<p>UNKNOWN now. Last measured 2026-10-08.</p>`).join(""));
const routes = ["/control", "/plant-text", "/plant-off", "/proof", "/learning-loop"];
const run = (sample, extra = {}) => runFast({ root: dir, sample, al, ratchet, exportRoutes: [...new Set([...sample.filter((r) => routes.includes(r)), ...(extra.also || [])])], ...extra });
const c = await run(["/control"]);
if (c.skipped) { console.log("SKIP " + c.skipped); fs.rmSync(dir, { recursive: true, force: true }); process.exit(fails ? 1 : 0); }
ok(c.ok && c.renders === 2, "clean control passes (2 renders)");
const t = await run(["/control", "/plant-text"]); ok(!t.ok && t.problems.some((p) => p.startsWith("text defect") && p.includes("undefined")), "planted 'undefined' defect fails the fast gate");
const o = await run(["/control", "/plant-off"]); ok(!o.ok && o.problems.some((p) => p.startsWith("off-centre CTA")), "planted off-centre CTA fails the fast gate");
const p = await run(["/control", "/proof"]); ok(!p.ok && p.problems.some((x) => x.startsWith("over cap F1-stale-feed")), `F1 hits above the cap fail (${p.followupCounts && p.followupCounts["F1-stale-feed"]} > 328)`);
const q = await run(["/control", "/learning-loop"]); ok(q.ok && q.followupCounts["F1-stale-feed"] === 20, "F1 hits under the cap pass (20 labelled hits)");
const lowCap = clone(al); lowCap.textRules.find((r) => r.id === "F1-stale-feed").max = 5;
const lc = await run(["/control", "/learning-loop"], { al: lowCap }); ok(!lc.ok, "MUTATION: lowering the cap below the hit count fails");
const bad = await run(["/control", "/nope"], { exportRoutes: routes }); ok(!bad.ok && bad.problems.some((x) => x.includes("/nope")), "a sample route absent from the export fails before rendering");
fs.rmSync(dir, { recursive: true, force: true });

// Part B
const bi = process.argv.indexOf("--built");
if (bi > 0) {
  const root = process.argv[bi + 1] || "out"; const exp = listRoutes(root); const sample = loadSample();
  const fam = familyMap(exp); const all = [...new Set(Object.values(fam))].sort();
  ok(checkSample(sample, exp, al).length === 0, `sample covers all ${all.length} route families of ${exp.length} routes [${all.join(" ")}]: ` + checkSample(sample, exp, al).join("; "));
  const seats = ["/scan", "/app", "/pro", "/agents", "/enterprise", "/partners"]; ok(seats.every((s) => sample.includes(s)), "sample has one route per seat");
  ok(["/", "/proof", "/learning-loop"].every((s) => sample.includes(s)), "sample has home, /proof, /learning-loop");
  const real = await runFast({ root }); ok(real.ok, `fast gate passes on the real export (${real.renders} renders, ${real.seconds && real.seconds.toFixed(1)}s)` + (real.problems.length ? ": " + real.problems.slice(0, 5).join("; ") : ""));
}
console.log(fails ? `\ntext_sanity_fast: ${fails} FAILED` : "\ntext_sanity_fast: all passed");
process.exit(fails ? 1 : 0);
