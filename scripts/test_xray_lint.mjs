// Claim-lint port for the Free Workflow X-Ray: parity with the Python lint (bin/mf_claim_lint.py + bin/mf_xray.py,
// klinge-kernel origin/mf6-int + origin/ent/e1_xray-2026-11-06) and 6 scripted mutants of the TS lint that must die.
// Parity runs the PYTHON LIVE when XRAY_PY_ROOT points at a checkout holding bin/mf_xray.py (and checks the golden
// against it); otherwise it compares the TS to the committed golden (scripts/fixtures/xray/lint_parity.golden.json,
// regenerate with: XRAY_PY_ROOT=<root> node scripts/test_xray_lint.mjs --write-golden). No network, no real data.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const here = new URL(".", import.meta.url).pathname;
const libDir = path.resolve(here, "../lib/xray");
const goldenPath = path.join(here, "fixtures/xray/lint_parity.golden.json");
const fixture = JSON.parse(fs.readFileSync(path.join(here, "fixtures/xray/trades_brisbane.input.json"), "utf8"));
const fixtures = ["trades_brisbane", "wholesale_hardware", "accounting_practice"]
  .map((n) => JSON.parse(fs.readFileSync(path.join(here, `fixtures/xray/${n}.input.json`), "utf8")));

// e5 finding F8 probes (ENT_e5_accept_RECEIPT.md line 23) plus the rest of the Python rule list and evasions.
const F8 = ["guaranteed savings", "will save you money", "certified", "ISO 27001 compliant", "100% secure", "$50,000 saved", "AI replaces staff", "Essential Eight"];
const MORE = [
  "Weekly stock order", "Job quotes from site visits", "risk free setup", "foolproof filing", "our clients love it", "case study intake",
  "equity in the firm", "investor update", "world first process", "unique method", "HIPAA records", "SOC 2 audit", "PCI DSS forms",
  "passive income report", "free build week", "live connectors", "live in 30 days", "imagine halo", "AU$2,500 quote", "path 4 $100 job",
  "Quote $500 ESTIMATED", "trusted by trades", "fully compliant", "accredited trainer", "zero risk", "saves you hours", "will definitely cut costs",
  "minority stake", "300k ask", "cap table", "valuation review", "Monday rota", "guarantee", "GUARANTEED", "g u a r a n t e e d",
  "dash — here", "en – dash", "cert​ified", "ｇｕａｒａｎｔｅｅｄ", "сertified", "guarаnteed",
  "Email sam@example.com", "Call 0491 570 156", "Café orders", "5 dollars a job", "AUD 2500 quote", "p4 pricing",
];
const LINT_CASES = [...F8, ...MORE];
const withName = (s) => ({ ...fixture, workflows: [{ ...fixture.workflows[0], name: s }, ...fixture.workflows.slice(1)] });
const withLabel = (s) => ({ ...fixture, business_label: s });
const DOCS = [
  ...LINT_CASES.map(withName), ...LINT_CASES.map(withLabel),
  { ...fixture, mystery_key: 1 },
  { ...fixture, workflows: [{ ...fixture.workflows[0], extra: 1 }] },
  { ...fixture, workflows: [{ ...fixture.workflows[0], name: "Quotes", n_per_week: 5, owner: "x" }] },
  ...fixtures,
];
const DOC_LABELS = [...LINT_CASES.map((s) => `name:${s}`), ...LINT_CASES.map((s) => `label:${s}`), "top-level unknown key", "workflow unknown key", "workflow unknown key 2", "fixture 1", "fixture 2", "fixture 3"];

async function tsResults(dir) {
  const claim = await import(pathToFileURL(path.join(dir, "claimlint.ts")).href);
  const eng = await import(pathToFileURL(path.join(dir, "engine.ts")).href);
  const lint = LINT_CASES.map((s) => [...new Set([...claim.lintMarkdown("SYNTHETIC DEMO\n\n" + s), ...claim.lintJson(s)].map((f) => f.rule))].sort());
  const docs = DOCS.map((d) => { try { eng.buildReport(d); return "accept"; } catch (e) { return e instanceof eng.XrayError ? "refuse" : "crash:" + e.message; } });
  return { lint, docs };
}

// ---- Python side (live when available) and the golden
const pyRoot = process.env.XRAY_PY_ROOT || "";
const driver = path.join(here, "xray_lint_py_driver.py");
let live = null;
if (pyRoot && fs.existsSync(path.join(pyRoot, "bin/mf_xray.py"))) {
  const r = spawnSync("python3", ["-I", driver, pyRoot], { input: JSON.stringify({ lint: LINT_CASES, docs: DOCS }), encoding: "utf8", maxBuffer: 1 << 26, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  if (r.status !== 0) { console.log(r.stderr.slice(0, 800)); ok(false, "python driver ran"); }
  else live = JSON.parse(r.stdout);
}
if (process.argv.includes("--write-golden")) {
  if (!live) { console.log("--write-golden needs XRAY_PY_ROOT"); process.exit(1); }
  fs.writeFileSync(goldenPath, JSON.stringify({ note: "Python outputs, SYNTHETIC probe strings only. Source: klinge-kernel origin/mf6-int bin/mf_claim_lint.py + origin/ent/e1_xray-2026-11-06 bin/mf_xray.py", lint_cases: LINT_CASES, doc_labels: DOC_LABELS, ...live }, null, 1));
  console.log("golden written");
  process.exit(0);
}
const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
ok(JSON.stringify(golden.lint_cases) === JSON.stringify(LINT_CASES) && golden.docs.length === DOCS.length, `golden covers all ${LINT_CASES.length} lint cases and ${DOCS.length} documents`);
if (live) ok(JSON.stringify(live.lint) === JSON.stringify(golden.lint) && JSON.stringify(live.docs) === JSON.stringify(golden.docs), "golden equals the LIVE Python output");
else console.log("NOTE live Python not available (set XRAY_PY_ROOT); comparing to the committed golden");
const py = live || golden;

// ---- parity
const base = await tsResults(libDir);
let diffs = 0;
LINT_CASES.forEach((s, i) => { if (JSON.stringify(base.lint[i]) !== JSON.stringify(py.lint[i])) { diffs++; console.log(`DIFF lint ${JSON.stringify(s)} ts=${base.lint[i]} py=${py.lint[i]}`); } });
ok(diffs === 0, `lint parity: TS rule set equals Python rule set on all ${LINT_CASES.length} strings`);
diffs = 0;
DOCS.forEach((d, i) => { if (base.docs[i] !== py.docs[i]) { diffs++; console.log(`DIFF engine ${DOC_LABELS[i]} ts=${base.docs[i]} py=${py.docs[i]}`); } });
ok(diffs === 0, `engine parity: TS accept/refuse equals Python on all ${DOCS.length} documents (probe strings as workflow name and business label, unknown keys, 3 fixtures)`);
ok(py.docs.slice(-3).every((x) => x === "accept"), "the three SYNTHETIC fixtures are still accepted");
const refused = F8.filter((s) => base.docs[LINT_CASES.indexOf(s)] === "refuse");
const accepted = F8.filter((s) => base.docs[LINT_CASES.indexOf(s)] === "accept");
console.log(`F8 probes refused by both: ${JSON.stringify(refused)}`);
console.log(`F8 probes accepted by BOTH Python and TS (Python has no rule for them): ${JSON.stringify(accepted)}`);
for (const s of ["guaranteed savings", "will save you money", "certified", "ISO 27001 compliant", "Essential Eight"]) ok(base.docs[LINT_CASES.indexOf(s)] === "refuse", `refused: ${s}`);

// ---- refusal text names the rule and WOULD-FLIP; unknown keys are loud
const eng = await import(pathToFileURL(path.join(libDir, "engine.ts")).href);
const msgOf = (d) => { try { eng.buildReport(d); return ""; } catch (e) { return String(e.message); } };
const m1 = msgOf(withName("guaranteed savings"));
ok(/claim rule "forbidden-claim \/ guaranteed"/.test(m1) && /WOULD-FLIP/.test(m1), `refusal names the rule and WOULD-FLIP: ${m1.slice(0, 90)}`);
const m2 = msgOf(withLabel("Essential Eight"));
ok(/business name/.test(m2) && /cert-standard/.test(m2), "business label refusal names the field and the rule");
ok(/unknown keys: mystery_key/.test(msgOf({ ...fixture, mystery_key: 1 })), "unknown top-level key is refused loudly by name");
ok(/workflow 1 has unknown keys/.test(msgOf(DOCS[DOCS.length - 5])), "unknown workflow key is refused loudly");
// every generated report line is linted: a rule-breaking line injected into the lint is found
const claim = await import(pathToFileURL(path.join(libDir, "claimlint.ts")).href);
ok(claim.lintReport({ a: "fine" }, ["# ok", "Guaranteed to save you money"]).length > 0, "lintReport flags a bad generated line");
ok(claim.lintReport({ a: "Certified" }, ["# ok"]).length > 0, "lintReport flags a bad JSON string");

// ---- 6 mutants, scripted source edits on a scratch copy of lib/xray (the real files are never touched)
const MUTANTS = [
  ["M1 drop the 'certified' rule", "claimlint.ts", String.raw`\bcertified\b|\baccredited\b|\battested\b`, String.raw`\bzzneverzz\b`],
  ["M2 skip NFKC normalisation", "claimlint.ts", 'text.normalize("NFKC")', "text"],
  ["M3 drop Essential Eight from cert-standard", "claimlint.ts", String.raw`|essential\s+(?:8|eight)`, ""],
  ["M4 ignore unknown workflow keys", "engine.ts", "Object.keys(w).some((k) => !WF_INPUT_KEYS.includes(k))", "false"],
  ["M5 disable the output lint", "engine.ts", "if (found.length) throw", "if (false) throw"],
  ["M6 stop reporting hidden characters", "claimlint.ts", "if (hc.length) out.push", "if (false) out.push"],
];
const baseVec = JSON.stringify(base);
let killed = 0;
for (const [name, file, from, to] of MUTANTS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xraymut-"));
  try {
    for (const f of ["claimlint.ts", "engine.ts"]) fs.copyFileSync(path.join(libDir, f), path.join(tmp, f));
    const src = fs.readFileSync(path.join(tmp, file), "utf8");
    const n = src.split(from).length - 1;
    if (n !== 1) { ok(false, `${name}: edit target found ${n} times (need exactly 1)`); continue; }
    fs.writeFileSync(path.join(tmp, file), src.replace(from, () => to));
    let vec;
    try { vec = JSON.stringify(await tsResults(tmp)); } catch (e) { vec = "crash:" + e.message; }
    const dead = vec !== baseVec;
    if (dead) killed++;
    ok(dead, `mutant killed: ${name}`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
ok(killed === 6, `${killed} of 6 mutants killed`);
assert.ok(JSON.stringify(await tsResults(libDir)) === baseVec, "real lib unchanged by the mutation run");
process.exit(fail ? 1 : 0);
