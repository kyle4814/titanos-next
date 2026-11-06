// Mutation check for the F45 tests: copy sources to scratch, put each bug back, require test_ask_log_scorer.mjs to FAIL. Real tree untouched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
const real = new URL("..", import.meta.url).pathname;
const L = "lib/concierge/asklog.ts", S = "lib/concierge/askscore.ts", C = "scripts/score_asks.mjs";
const MUTANTS = [
  ["min sample lowered to 100", S, "export const MIN_SAMPLE = 200;", "export const MIN_SAMPLE = 100;"],
  ["sample gate removed", S, 'n < MIN_SAMPLE ? "INSUFFICIENT SAMPLE" : ', ""],
  ["sample gate off by one (>)", S, "n < MIN_SAMPLE ?", "n < MIN_SAMPLE - 1 ?"],
  ["target raised to 0.81", S, "export const TARGET = 0.8;", "export const TARGET = 0.81;"],
  ["target lowered to 0.79", S, "export const TARGET = 0.8;", "export const TARGET = 0.79;"],
  ["pass uses > not >=", S, ">= TARGET ? \"PASS\"", "> TARGET ? \"PASS\""],
  ["partial counted as yes", S, 'if (l.answerable === "yes") yes++;', 'if (l.answerable === "yes" || l.answerable === "partial") yes++;'],
  ["unlabelled counted as labelled", S, "const n = labels.length;", "const n = rows.length;"],
  ["orphan label tolerated", S, 'if (!byId.has(l.ask_id)) throw new Error("label for ask_id " + l.ask_id + " has no row in the log");', ""],
  ["duplicate label tolerated", S, 'if (seen.has(l.ask_id)) throw new Error("duplicate label for ask_id " + l.ask_id);', ""],
  ["unanswered list dropped", S, "unanswered.push(", "void ("],
  ["synthetic banner dropped", S, 'if (s.synthetic) L.push("DATA: SYNTHETIC.', 'if (false) L.push("DATA: SYNTHETIC.'],
  ["label answerable not validated", S, 'if (a !== "yes" && a !== "no" && a !== "partial") throw', 'if (false) throw'],
  ["email scrub removed", L, 'replace(/[A-Za-z0-9._%+\'-]+\\s*(?:@|', 'replace(/ZZ[A-Za-z0-9._%+\'-]+\\s*(?:@|'],
  ["abn scrub removed", L, '"[ABN]");          // bare 11 digits', '"$&");          // bare 11 digits'],
  ["phone scrub removed", L, '\\(?0[2-9]\\)?[\\s-]?(?:\\d{4}', '\\(?0[2-9]ZZ\\)?[\\s-]?(?:\\d{4}'],
  ["ip allowed in schema", L, 'export const ASK_KEYS = ["ask_id",', 'export const ASK_KEYS = ["ip", "ask_id",'],
  ["unknown keys tolerated", L, 'for (const k of Object.keys(o)) if (!(ASK_KEYS as readonly string[]).includes(k)) throw', 'for (const k of Object.keys(o)) if (false) throw'],
  ["visitor stored raw", L, "const visitor = hashVisitor(a.salt, a.visitorId);", "const visitor = a.visitorId.padEnd(16, \"0\");"],
  ["salt not required", L, "salt.length < MIN_SALT", "false"],
  ["salt ignored in hash", L, 'update(salt + ":" + String(visitorId))', 'update(":" + String(visitorId))'],
  ["junk text kept", L, 'intent === "junk" ? "" : scrubPii(a.question)', "scrubPii(a.question)"],
  ["q stored unscrubbed", L, 'intent === "junk" ? "" : scrubPii(a.question)', 'intent === "junk" ? "" : a.question'],
  ["recordAsk throws on adapter failure", L, "} catch { return false; }", "} catch (e) { throw e; }"],
  ["jsonl append skips validation", L, "JSON.stringify(validateRow(r)) + \"\\n\"", "JSON.stringify(r) + \"\\n\""],
  ["cli exit code for insufficient is 0", C, ": 3);", ": 0);"],
];
const copy = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "f45_mut_"));
  if (!d.startsWith(os.tmpdir() + "/f45_mut_")) throw new Error("unsafe scratch dir");
  for (const p of ["lib/concierge", "lib/offers", "scripts"]) { fs.mkdirSync(path.dirname(d + "/" + p), { recursive: true }); fs.cpSync(real + p, d + "/" + p, { recursive: true }); }
  return d;
};
const runTest = (d) => { try { execFileSync("node", ["--experimental-strip-types", "--no-warnings", d + "/scripts/test_ask_log_scorer.mjs"], { env: { ...process.env, ASKLOG_ROOT: d }, stdio: "pipe" }); return 0; } catch (e) { return e.status || 1; } };
let bad = 0;
const base = copy(); const baseCode = runTest(base); fs.rmSync(base, { recursive: true, force: true });
console.log("unmutated copy:", baseCode === 0 ? "PASS (required)" : "FAIL (BAD)"); if (baseCode !== 0) bad++;
for (const [name, file, from, to] of MUTANTS) {
  const d = copy(); const f = d + "/" + file; const src = fs.readFileSync(f, "utf8");
  if (!src.includes(from)) { console.log("MUTANT NOT APPLIED (pattern missing):", name); bad++; fs.rmSync(d, { recursive: true, force: true }); continue; }
  fs.writeFileSync(f, src.replace(from, to));
  const code = runTest(d); fs.rmSync(d, { recursive: true, force: true });
  console.log((code !== 0 ? "KILLED  " : "SURVIVED ") + name); if (code === 0) bad++;
}
console.log(bad ? "MUTATION CHECK FAILED: " + bad : "MUTATION CHECK OK: " + MUTANTS.length + " mutants all killed, unmutated copy green");
process.exit(bad ? 1 : 0);
