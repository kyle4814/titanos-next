// C9 follow-up (f383): the Ariance page may be indexable/linked only when it is consented AND every figure resolves to a
// file in THIS repo. Today all 24 Ariance figures resolve to declared external receipts only, so noindex must hold.
// Proves: (1) real tree is noindex/unlinked, (2) a planted untraceable number is caught, (3) a consent flip while any
// figure is not file-traced is caught by this gate. Throwaway copies only; no network.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { check } from "./case_trace_lib.mjs";

const root = new URL("..", import.meta.url).pathname;
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };

/** Returns { rows, notFile, visible, allowed } for a site root. allowed = consent AND zero non-file-traced figures. */
function decide(dir) {
  const r = check(dir);
  const rows = r.table.filter((x) => x[0] === "case-studies/ariance");
  const notFile = rows.filter((x) => x[4] !== "yes");
  const consent = JSON.parse(readFileSync(join(dir, "lib/case-studies/ariance.json"), "utf8")).client_consent === true;
  return { r, rows, notFile, consent, allowed: consent && notFile.length === 0 };
}
const real = decide(root);
ok(real.rows.length > 0, `ariance has ${real.rows.length} traced figure rows`);
ok(real.r.inv.every((i) => i.fail === 0), "real tree: every trace invariant I1-I9 passes");
console.log(`INFO ariance figures: ${real.rows.length - real.notFile.length} file-traced, ${real.notFile.length} external-receipt only`);
// the contract: any non-file-traced figure or missing consent means noindex + unlinked + off the sitemap
ok(real.allowed || !real.consent, "gate: consent is false whenever any figure is not file-traced");
const page = readFileSync(join(root, "app/case-studies/ariance/page.tsx"), "utf8");
ok(/index: false, follow: false/.test(page) && /arianceVisible \? /.test(page), "page emits noindex unless arianceVisible");
for (const f of ["app/case-studies/page.tsx", "app/page.tsx", "lib/routes.ts"]) ok(/arianceVisible/.test(readFileSync(join(root, f), "utf8")), `${f} only references ariance behind arianceVisible`);
ok(!/ariance/i.test(readFileSync(join(root, "app/sitemap.ts"), "utf8")), "sitemap.ts holds no hard-coded ariance entry");

// mutants
const FILES = ["lib/caseStudies.ts", "lib/case-studies", "app/case-studies", "app/proof", "components/cases", "public/proof", "lib/ledger.json"];
function withCopy(fn) {
  const dir = mkdtempSync(join(tmpdir(), "arianceg-"));
  try {
    for (const p of FILES) { mkdirSync(dirname(join(dir, p)), { recursive: true }); cpSync(join(root, p), join(dir, p), { recursive: true }); }
    fn(dir);
    return decide(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const edit = (dir, p, fn) => { const fp = join(dir, p); const a = readFileSync(fp, "utf8"); const b = fn(a); if (a === b) throw new Error(`mutant did not change ${p}`); writeFileSync(fp, b); };

const m1 = withCopy((d) => edit(d, "lib/case-studies/ariance.json", (s) => s.replace('"commits_total": 8,', '"commits_total": 8,\n    "planted_note_999": "999 tests",')));
ok(m1.r.inv.find((i) => i.id === "I1").fail > 0, "M1 a planted untraceable number (999) is caught by I1");

const m2 = withCopy((d) => edit(d, "lib/case-studies/ariance.json", (s) => s.replace('"client_consent": false', '"client_consent": true')));
ok(m2.consent && m2.notFile.length > 0 && !m2.allowed, "M2 consent flipped to true while figures are external-only is BLOCKED by the gate");

const m3 = withCopy((d) => edit(d, "app/case-studies/ariance/page.tsx", (s) => s.replace("index: false, follow: false", "index: true, follow: true")));
ok(m3.r.inv.find((i) => i.id === "I7").fail > 0, "M3 removing the noindex branch is caught by I7");

console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
