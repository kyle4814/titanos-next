// f271: Enterprise savings calculator UI contract. Synthetic inputs only. Env overrides feed the mutation runner.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = new URL("..", import.meta.url).pathname;
const viewPath = process.env.SAVCALCUI_VIEW ? path.resolve(process.env.SAVCALCUI_VIEW) : path.join(root, "lib/savings-view.ts");
const compPath = process.env.SAVCALCUI_COMP ? path.resolve(process.env.SAVCALCUI_COMP) : path.join(root, "components/EnterpriseSavingsCalculator.tsx");
const { calculateSavings } = await import(path.join(root, "lib/savings-calculator.ts"));
const { buildSavingsView } = await import(viewPath);
let fail = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fail++; };
const mk = (o = {}) => ({ headcount: 10, loadedHourlyCostAud: 80, tasks: [{ name: "SYNTHETIC repeat tasks", hoursPerWeek: 5 }], currentToolSpendAud: 20000, ...o });

// Source contract: the section imports the engine and renders band, payback, method line and notes.
const comp = fs.readFileSync(compPath, "utf8");
ok(/import \{ calculateSavings \} from "@\/lib\/savings-calculator"/.test(comp), "component imports calculateSavings from the engine");
ok(/buildSavingsView\(\s*calculateSavings\(/.test(comp), "component runs the engine through the view model");
ok(/\{view\.hoursBand\}/.test(comp) && /\{view\.dollarsBand\}/.test(comp), "component renders the floor to ceiling band (hours and dollars)");
ok(/\{view\.payback\}/.test(comp) && /\{view\.paybackNote\}/.test(comp), "component renders payback months and its note");
ok(/Method: \{view\.method\}/.test(comp), "component renders the method line");
ok(/view\.notes\.map/.test(comp), "component renders the clamp notes");
ok(/view\.kind === "error"/.test(comp) && /\{view\.message\}/.test(comp), "component renders the typed error as a plain message");
ok(/"use client"/.test(comp.split("\n")[0]), "component is a client component");
ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(comp), "component sends nothing (no network call)");
ok(/Example numbers/.test(comp), "synthetic defaults are labelled as an example");

// Wiring: page passes the slot, anchor is live.
const page = fs.readFileSync(path.join(root, "app/enterprise/page.tsx"), "utf8");
const anchors = fs.readFileSync(path.join(root, "app/enterprise/anchors.ts"), "utf8");
ok(/extras=\{\{ "savings-calculator": <EnterpriseSavingsCalculator \/>/.test(page), "/enterprise page wires the calculator into the savings-calculator section");
const row = anchors.slice(anchors.indexOf('id: "savings-calculator"'), anchors.indexOf('id: "sso"'));
ok(/status: "live"/.test(row) && !/status: "coming"/.test(row), "savings-calculator anchor is live (built), not coming");
ok(/extras\?\.\[r\.id\]/.test(fs.readFileSync(path.join(root, "components/SeatAnchors.tsx"), "utf8")), "SeatAnchors renders the slot inside the section");

// Behaviour: golden (10 x 5 x 46 = 2300 h; hours 690..1610; AU$ 55,200..133,800 incl. tool spend; payback 4.5..32.6 months).
const v = buildSavingsView(calculateSavings(mk()));
ok(v.kind === "result", "valid input gives a result view");
ok(v.hoursBand.includes("690") && v.hoursBand.includes("1,610"), "band shows both floor and ceiling hours: " + v.hoursBand);
ok(v.dollarsBand.includes("55,200") && v.dollarsBand.includes("133,800"), "band shows both floor and ceiling dollars: " + v.dollarsBand);
ok(v.payback.includes("4.5") && v.payback.includes("32.6") && /Enterprise band/.test(v.payback), "payback months against the Enterprise band: " + v.payback);
ok(/annual hours = headcount 10/.test(v.method) && /payback months/.test(v.method), "method line carries the formulas");
ok(/Nobody is replaced/.test(v.disclaimer) && !/\b(jobs?|redundan|headcount reduction|layoff)/i.test(v.hoursBand + v.dollarsBand + v.payback + v.disclaimer), "output is hours given back, no job removal language");

// Clamp notes render.
const c = buildSavingsView(calculateSavings(mk({ headcount: 9_999_999, loadedHourlyCostAud: 99999 })));
ok(c.kind === "result" && c.notes.length === 2, "two clamped fields give two notes");
ok(c.notes.some((n) => n.startsWith("People on the team")) && c.notes.some((n) => n.startsWith("Loaded hourly cost")), "notes name the fields in plain words");

// Zero hours: no NaN, null payback handled.
const z = buildSavingsView(calculateSavings(mk({ tasks: [{ name: "SYNTHETIC idle", hoursPerWeek: 0 }], currentToolSpendAud: 0 })));
ok(z.kind === "result" && z.payback === "No payback to show yet.", "zero hours gives a plain no-payback line");

// Bad input: typed error becomes a plain message, never NaN/undefined/raw code.
const bads = [
  calculateSavings(mk({ headcount: NaN })), calculateSavings(mk({ loadedHourlyCostAud: -5 })),
  calculateSavings(mk({ currentToolSpendAud: "abc" })), calculateSavings(null), calculateSavings(mk({ tasks: [{ name: "x", hoursPerWeek: NaN }] })),
];
for (const b of bads) {
  const e = buildSavingsView(b);
  ok(e.kind === "error" && e.message.length > 10 && !/NaN|undefined|null|NOT_A_|NEGATIVE|\[object/.test(e.message), "typed error is plain: " + (e.message ?? JSON.stringify(e)));
}
ok(/People on the team/.test(buildSavingsView(bads[0]).message), "error names the field the person can fix");
for (const r of [v, c, z]) for (const s of Object.values(r)) ok(!/NaN|undefined/.test(JSON.stringify(s)), "no NaN or undefined in a result view");

// Copy: AU English, no dash, no urgency or fear words; content_lint --no-cta CLEAN.
const copy = [comp.match(/>[^<>{}]{12,}</g)?.join("\n") ?? "", ...Object.values(v).flat().filter((x) => typeof x === "string"), ...c.notes, ...bads.map((b) => buildSavingsView(b).message)].join("\n\n");
ok(!/[–—]/.test(copy + comp), "no em or en dash in the calculator copy");
ok(!/\b(act now|hurry|limited time|last chance|don't miss|risk of|you will lose|before it's too late)\b/i.test(copy), "no urgency or fear words");
const lint = "/home/tech2/klinge-kernel/bin/content_lint.py";
if (fs.existsSync(lint)) {
  const tmp = fs.mkdtempSync("/tmp/f271-lint-"); const f = path.join(tmp, "copy.txt");
  fs.writeFileSync(f, copy + "\n");
  const r = spawnSync("python3", [lint, "--no-cta", f], { encoding: "utf8" });
  ok(r.status === 0, "content_lint --no-cta CLEAN" + (r.status ? " :: " + (r.stdout + r.stderr).slice(0, 300) : ""));
  fs.rmSync(tmp, { recursive: true, force: true });
} else console.log("NOTE content_lint absent, lint skipped");
console.log(fail ? `FAIL ${fail}` : "ALL PASS");
process.exit(fail ? 1 : 0);
