// C9 Proof Wall bar: every case-study figure traces to a file or receipt; every case is labelled; no dashes, audit or
// certification wording, or unconsented client name. Prints the trace table, then proves the gate bites with 5 mutants.
// No network, no model calls; mutants run on a throwaway copy of the files.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { check, figures, LABELS } from "./case_trace_lib.mjs";

const root = new URL("..", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };

// 1. the real tree
const real = check(root);
for (const i of real.inv) {
  ok(i.fail === 0 && i.pass > 0, `${i.id} ${i.name}: ${i.pass} checks passed, ${i.fail} failed`);
  for (const f of i.fails.slice(0, 8)) console.log("     " + f);
}

// 2. the trace table (page, figure, source, resolves)
const rows = real.table;
const by = { yes: 0, ext: 0, no: 0 };
console.log("\nTRACE TABLE  page | figure | kind | source | resolves   (yes = file in this repo checked, ext = declared external receipt, no = broken)");
for (const r of rows) { by[r[4]]++; if (process.argv.includes("--all") || r[4] !== "yes") console.log(`  ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} | ${r[4]}`); }
console.log(`  (${rows.length} figures: ${by.yes} yes, ${by.ext} ext, ${by.no} no; "yes" rows hidden unless --all)\n`);
ok(by.no === 0 && rows.length > 0, `trace table: ${rows.length} figures, 0 unresolved`);
const pages = new Set(rows.map((r) => r[0]));
ok(["case-studies/dealer-command-centre", "case-studies/sales-coaching-course", "case-studies/trading-app", "case-studies/ariance"].every((p) => pages.has(p)) && [...pages].some((p) => p.includes("app/proof/page.tsx")), "the table covers all four case studies and app/proof/page.tsx");

// 3. unit: the figure extractor sees money, time, percent, count, date
const f = figures("US$3 of 6% over 3.5 hours from 05:10 on 7 October 2026, 1,900 lessons");
ok(["US$3", "6%", "3.5", "05:10", "7 October 2026", "1,900"].every((x) => f.includes(x)), "extractor finds money, percent, decimal, clock, date and thousands figures");

// 4. mutants on a throwaway copy
const FILES = ["lib/caseStudies.ts", "lib/case-studies", "app/case-studies", "app/proof", "components/cases", "public/proof", "lib/ledger.json", "lib/case-studies/ariance.ts"];
function withCopy(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "casetrace-"));
  try {
    for (const p of FILES) { mkdirSync(dirname(join(dir, p)), { recursive: true }); cpSync(join(root, p), join(dir, p), { recursive: true }); }
    mutate(dir);
    return check(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const edit = (dir, p, fn) => { const fp = join(dir, p); const a = readFileSync(fp, "utf8"); const b = fn(a); if (a === b) throw new Error(`mutant did not change ${p}`); writeFileSync(fp, b); };
const caught = (r, id) => r.inv.find((i) => i.id === id).fail > 0;
ok(withCopy(() => {}).inv.every((i) => i.fail === 0), "control: an unmutated copy passes every invariant");

const M = [
  ["M1 delete a source (a field loses its source ids)", "I2", (d) => edit(d, "lib/case-studies/trace.json", (s) => { const m = JSON.parse(s); const k = Object.keys(m.fields).find((x) => x.startsWith("cases.trading-app.facts[2]")); m.fields[k].src = []; return JSON.stringify(m, null, 2); })],
  ["M2 break a path (a file source points nowhere)", "I2", (d) => edit(d, "lib/case-studies/trace.json", (s) => s.replace("public/proof/trading-app-tests.log", "public/proof/trading-app-tests.MISSING.log"))],
  ["M3 drop a label (a case loses REAL/SYNTHETIC/MODELLED)", "I3", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace('    label: "REAL",\n', ""))],
  ["M4 add an unsourced figure (a new number in a teaser)", "I1", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace("598 tests passing", "598 tests passing and 41 sites shipped"))],
  ["M5 add an em dash", "I5", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace("A dealership command centre, built", "A dealership command centre — built"))],
];
for (const [name, inv, fn] of M) { let r; try { r = withCopy(fn); } catch (e) { ok(false, `${name}: mutant failed to apply (${e.message})`); continue; } ok(caught(r, inv), `${name} is caught by ${inv} (${r.inv.find((i) => i.id === inv).fails[0] || "none"})`); }

// extra mutants for the other invariants (not required, they show the rest of the gate bites)
const X = [
  ["X1 an audit claim", "I6", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace("independent reviews", "independent audits"))],
  ["X2 a certification claim", "I6", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace("The aging maths matched", "ISO 27001 certified. The aging maths matched"))],
  ["X3 a client named in an unnamed case", "I7", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace("A 4x4 yard needed", "Ariance needed"))],
  ["X4 ariance consent field removed", "I7", (d) => edit(d, "lib/case-studies/ariance.json", (s) => s.replace('"client_consent": false,', ""))],
  ["X5 a case label not rendered on the page", "I4", (d) => edit(d, "app/case-studies/[slug]/page.tsx", (s) => s.replace("{c.label}", "{c.sector}"))],
  ["X6 a figure edited without its sum (70 minutes to 71)", "I8", (d) => edit(d, "lib/caseStudies.ts", (s) => s.replace("(16:46)", "(16:47)"))],
  ["X7 a source claim the file does not hold", "I2", (d) => edit(d, "public/proof/trading-app-tests.log", (s) => s.replace("# pass 250", "# pass 249"))],
];
for (const [name, inv, fn] of X) { let r; try { r = withCopy(fn); } catch (e) { ok(false, `${name}: mutant failed to apply (${e.message})`); continue; } ok(caught(r, inv), `${name} is caught by ${inv}`); }

// 5. SYNTHETIC fixture: the label vocabulary and the rule that a SYNTHETIC case must say so
ok(LABELS.join() === "REAL,SYNTHETIC,MODELLED", "label vocabulary is REAL, SYNTHETIC, MODELLED");
const synth = withCopy((d) => edit(d, "lib/caseStudies.ts", (s) => s.replace('label: "REAL",', 'label: "SYNTHETIC",')));
ok(caught(synth, "I3") || caught(synth, "I4"), "a case flipped to SYNTHETIC without the manifest and its own text saying so is caught");

console.log(`\n== test_case_trace: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
