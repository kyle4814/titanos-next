// /pro#leads UI: source contract, view-model behaviour, typed errors, mutations. SYNTHETIC rows only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const R = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => fs.readFileSync(R(p), "utf8");

async function suite(vm, comp, anchorsSrc, seatSrc, label) {
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; if (label === "real") console.log(`FAIL ${m}`); } else if (label === "real") console.log(`PASS ${m}`); };
  const { checkLeads, SAMPLE_TEXT, RULES_VERSION } = vm;
  // source contract
  ok(/from "@\/lib\/leads-ui"/.test(comp), "component imports the view-model");
  ok(/DRAFT rules, pending legal sign-off/.test(comp), "component renders the DRAFT banner");
  ok(/ALLOW/.test(comp) && /BLOCK/.test(comp) && /r\.text/.test(comp), "component renders verdict and plain reason per row");
  ok(/view\.rulesVersion/.test(comp), "component renders the rule table version");
  ok(/role="alert"/.test(comp) && /view\.message/.test(comp), "component renders the typed error message");
  ok(/made-up people/.test(comp), "example list is labelled as an example");
  ok(!/fetch\(|XMLHttpRequest|sendBeacon|mailto:|smtp/i.test(comp), "component has no send path");
  ok(/from "\.\/leads-export\.ts"/.test(vm.__src), "view-model imports the f269 engine");
  ok(/status: "live"/.test(anchorsSrc.split('id: "leads"')[1] || ""), "leads anchor is live (built)");
  ok(/<LeadsExport \/>/.test(seatSrc), "SeatAnchors wires the component into the leads section");
  // behaviour
  const v = checkLeads(SAMPLE_TEXT, "AU", "unknown");
  ok(v.ok && v.rows.length === 4, "sample renders four row verdicts");
  if (v.ok) {
    const by = Object.fromEntries(v.rows.map((r) => [r.id, r]));
    ok(by["EX-1"].allowed === true && by["EX-1"].reason === null, "EX-1 allowed");
    ok(by["EX-2"].allowed === false && by["EX-2"].reason === "NO_CONSENT", "EX-2 blocked NO_CONSENT");
    ok(by["EX-3"].allowed === false && by["EX-3"].reason === "OPTED_OUT", "EX-3 blocked OPTED_OUT");
    ok(by["EX-4"].allowed === false && by["EX-4"].reason === "UNKNOWN", "EX-4 phone with no DNC reading blocked UNKNOWN");
    ok(v.rows.every((r) => r.text && !/NaN|undefined/.test(r.text)), "every row has a plain reason");
    ok(v.rulesVersion === RULES_VERSION && /DRAFT/.test(v.rulesVersion), "rule table version says DRAFT");
    ok(v.emitted === 1 && v.withheld === 3, "counts 1 allowed 3 held back");
  }
  const c = checkLeads(SAMPLE_TEXT, "au", "clear");
  ok(c.ok && c.rows.find((r) => r.id === "EX-4").allowed === true, "clear reading (lower-case country) allows EX-4");
  const l = checkLeads(SAMPLE_TEXT, "AU", "listed");
  ok(l.ok && l.rows.find((r) => r.id === "EX-4").reason === "DNC_LISTED", "listed reading blocks with DNC_LISTED");
  // typed errors
  const E = (r, code) => ok(r.ok === false && r.code === code && r.message.length > 10 && !/NaN|undefined/.test(r.message), `typed error ${code}`);
  E(checkLeads("{not json", "AU", "unknown"), "BAD_JSON");
  E(checkLeads("{}", "AU", "unknown"), "NOT_A_LIST");
  E(checkLeads("[]", "AU", "unknown"), "EMPTY");
  E(checkLeads(JSON.stringify(Array(501).fill({})), "AU", "unknown"), "TOO_MANY");
  E(checkLeads(SAMPLE_TEXT, "", "unknown"), "BAD_COUNTRY");
  E(checkLeads(SAMPLE_TEXT, "A1", "unknown"), "BAD_COUNTRY");
  E(checkLeads(SAMPLE_TEXT, "ZZ", "unknown"), "UNSUPPORTED_COUNTRY");
  E(checkLeads(SAMPLE_TEXT, "__proto__", "unknown"), "BAD_COUNTRY");
  E(checkLeads(undefined, "AU", "unknown"), "BAD_JSON");
  const junk = checkLeads("[1,null,\"x\",[]]", "AU", "clear");
  ok(junk.ok && junk.rows.length === 4 && junk.rows.every((r) => !r.allowed && r.reason === "UNKNOWN" && r.id.startsWith("row ")), "junk rows blocked as UNKNOWN with a plain id, no throw");
  return fail;
}

const mod = async (dir) => { const m = await import(pathToFileURL(path.join(dir, "leads-ui.ts")).href); return { ...m, __src: fs.readFileSync(path.join(dir, "leads-ui.ts"), "utf8") }; };
const libDir = path.dirname(new URL(R("lib/leads-ui.ts")).pathname);
const real = await mod(libDir);
let fail = await suite(real, read("components/LeadsExport.tsx"), read("app/pro/anchors.ts"), read("components/SeatAnchors.tsx"), "real");

// mutations: each must fail the suite
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "leadsui-"));
fs.copyFileSync(path.join(libDir, "leads-export.ts"), path.join(tmp, "leads-export.ts"));
const vmSrc = read("lib/leads-ui.ts"), compSrc = read("components/LeadsExport.tsx"), aSrc = read("app/pro/anchors.ts"), sSrc = read("components/SeatAnchors.tsx");
let n = 0;
async function mutant(name, { vm = vmSrc, comp = compSrc, a = aSrc, s = sSrc }) {
  const d = path.join(tmp, `m${n++}`); fs.mkdirSync(d);
  fs.copyFileSync(path.join(tmp, "leads-export.ts"), path.join(d, "leads-export.ts"));
  fs.writeFileSync(path.join(d, "leads-ui.ts"), vm);
  let f; try { f = await suite(await mod(d), comp, a, s, "mutant"); } catch { f = 1; }
  const killed = f > 0; console.log(`${killed ? "PASS" : "FAIL"} mutant killed: ${name}`); if (!killed) fail++;
}
await mutant("allow every row", { vm: vmSrc.replace("allowed: reason === null", "allowed: true") });
await mutant("drop the DRAFT banner", { comp: compSrc.replace("DRAFT rules, pending legal sign-off.", "") });
await mutant("drop the reason text", { comp: compSrc.replace("{r.text}", "") });
await mutant("swallow bad JSON", { vm: vmSrc.replace('return fail("BAD_JSON"); }\n  if (!Array', 'parsed = []; }\n  if (!Array') });
await mutant("skip the engine", { vm: vmSrc.replace("const res = exportLeads(list, code);", "const res = { refusals: [], method: '', csv: '', emitted: list.length, withheld: 0 };") });
await mutant("anchor flipped back to coming", { a: aSrc.replace('title: "Leads", status: "live"', 'title: "Leads", status: "coming"') });
fs.rmSync(tmp, { recursive: true, force: true });

// client copy lint
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
const copyOnly = [...(vmSrc + compSrc).matchAll(/"([A-Z][^"]{20,})"|>([A-Z][^<{]{20,})</g)].map((m) => m[1] || m[2]).join("\n\n");
lint_block: {
  if (!fs.existsSync(lint)) { console.log("NOTE content_lint absent, lint skipped"); break lint_block; }
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "leadsui-lint-")); const f = path.join(t, "copy.txt"); fs.writeFileSync(f, copyOnly + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  console.log(`${r.status === 0 ? "PASS" : "FAIL"} content_lint --no-cta CLEAN${r.status ? " :: " + (r.stdout + r.stderr).slice(0, 300) : ""}`);
  if (r.status !== 0) fail++; fs.rmSync(t, { recursive: true, force: true });
}
const dash = /[–—]/;
for (const p of ["lib/leads-ui.ts", "components/LeadsExport.tsx", "app/pro/anchors.ts", "components/SeatAnchors.tsx"]) {
  const bad = dash.test(read(p)); console.log(`${bad ? "FAIL" : "PASS"} no em or en dash in ${p}`); if (bad) fail++;
}
console.log(fail ? `FAIL ${fail}` : "leads-ui: all green");
process.exit(fail ? 1 : 0);
