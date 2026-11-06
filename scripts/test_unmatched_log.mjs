// C5/C6 unmatched-ask log: one contract suite on MemoryLog and D1UnmatchedLog (over the fake D1 on real SQLite), the router integration,
// the migration-draft guard, and MUTANTS that must fail (cap dropped, eviction dropped, redaction off, injection check off, dedup off, guard length off).
// Real D1 and live traffic are PENDING LIVE (see the f67 receipt).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSuite } from "./unmatched_suite.mjs";
import { buildIndex, route, concierge } from "../lib/concierge/router.ts";
import { MemoryLog } from "../lib/concierge/unmatched.ts";
import { D1UnmatchedLog } from "../lib/concierge/d1log.ts";
import { FakeD1 } from "./fake_d1.ts";
import { index } from "./concierge_eval.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const lib = root + "/lib/concierge";
const fake = here + "/fake_d1.ts";
let pass = 0, fail = 0;
const t = (name, ok, extra = "") => { if (ok) pass++; else { fail++; console.log("FAIL " + name + " " + extra); } };

// 1. the contract suite on the real tree
const fails = await runSuite(lib, fake);
for (const f of fails) { fail++; console.log("FAIL " + f); }
t("contract suite: zero failures on both adapters", fails.length === 0, String(fails.length));
console.log(`contract suite ran ${fails.checks} checks on MemoryLog and D1UnmatchedLog`);

// 2. router integration, both adapters
{
  const day = () => "2026-11-06";
  const m = new MemoryLog({ day }); const d = new D1UnmatchedLog(new FakeD1(), { day });
  for (const log of [m, d]) {
    const ask = concierge(index, log);
    const u = ask("sing me a song about volcano pottery 0412345678", "owner");
    t("unmatched ask still returns the unmatched reply", u.kind === "unmatched" && u.configStub.status === "LOGGED_FOR_GENERATOR" && u.configStub.quote === null);
    ask("pricing", "guest");
    for (let i = 0; i < 20 && (await log.entries()).length < 1; i++) await new Promise((r) => setImmediate(r));
    const e = await log.entries();
    t("only the unmatched ask is logged, redacted", e.length === 1 && e[0].seat === "owner" && !/0412|345/.test(e[0].normalised) && /redacted-number/.test(e[0].normalised), JSON.stringify(e));
  }
}

// 3. the migration is a DRAFT: unnumbered file, no identifier columns, not in any numbered migrations dir, no apply command in the tree
{
  const sql = fs.readFileSync(lib + "/migrations/DRAFT_unmatched_asks.sql", "utf8");
  t("migration draft is marked DRAFT ONLY / NOT APPLIED", /DRAFT ONLY/.test(sql) && /NOT APPLIED/.test(sql));
  const cols = sql.replace(/--.*$/gm, "");
  t("migration draft has no identifier columns", !/\b(ip|visitor|session|user_?agent|cookie|raw|ask)\b\s+(TEXT|INTEGER)/i.test(cols), cols);
  t("migration draft has the bounded-table keys", /UNIQUE \(day, seat, normalised\)/.test(sql) && /AUTOINCREMENT/.test(sql));
  t("no numbered migrations dir was created", !fs.existsSync(root + "/migrations") && !fs.existsSync(root + "/portal-api"));
  const code = ["d1log.ts", "unmatched.ts", "digest.ts"].map((f) => fs.readFileSync(lib + "/" + f, "utf8")).join("\n").replace(/\/\/.*$/gm, "");
  t("adapter code has no network, clock, env or randomness", !/\b(fetch\s*\(|XMLHttpRequest|process\.env|Math\.random|Date\.now|new Date)/.test(code), (code.match(/fetch\s*\(|Date\.now|new Date|Math\.random|process\.env/) || [])[0]);
  const prose = ["d1log.ts", "unmatched.ts", "digest.ts", "migrations/DRAFT_unmatched_asks.sql"].map((f) => fs.readFileSync(lib + "/" + f, "utf8")).join("\n");
  t("no em or en dashes in the new files", !/[–—]/.test(prose));
}

// 4. MUTANTS: each breaks one guard in a temp copy of lib/concierge; the contract suite must go red.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "f67-mut-"));
  const mutants = [
    ["d1: eviction statement dropped (no cap)", "d1log.ts", (s) => s.replace(/,\s*\n\s*this\.db\.prepare\("DELETE FROM unmatched_asks[^\n]*\n/, "\n")],
    ["d1: cap passed as 1e9", "d1log.ts", (s) => s.replace(".bind(this.cap)", ".bind(1e9)")],
    ["d1: dedup off (DO NOTHING)", "d1log.ts", (s) => s.replace("DO UPDATE SET count = count + 1", "DO NOTHING")],
    ["memory: cap loop dropped", "unmatched.ts", (s) => s.replace(/\n\s*while \(this\.m\.size > this\.cap\)[^\n]*/, "")],
    ["memory: evicts newest, not oldest", "unmatched.ts", (s) => s.replace("this.m.keys().next().value as string", "[...this.m.keys()].pop() as string")],
    ["both: redaction off", "unmatched.ts", (s) => s.replace("for (const [re, to] of REDACT) t = t.replace(re, to);", "")],
    ["both: injection check off", "unmatched.ts", (s) => s.replace(/for \(const re of INJECTION\) if \(re\.test\(raw\)\)[^\n]*\n/, "").replace(/for \(const re of INJECTION\) if \(re\.test\(line\)\)[^\n]*\n/, "")],
    ["both: guard length off", "unmatched.ts", (s) => s.replace("export const MAX_RAW = 500;", "export const MAX_RAW = 1e9;")],
    ["both: line cap off", "unmatched.ts", (s) => s.replace("if (line.length > MAX_LINE)", "if (false)")],
    ["digest: order-dependent (no sort)", "digest.ts", (s) => s.replace(/const rows = \[\.\.\.merged\.values\(\)\]\.sort\([^\n]*\n/, "const rows = [...merged.values()];\n")],
    ["digest: clusters across seats", "digest.ts", (s) => s.replace("c.rep.seat === r.seat && ", "")],
  ];
  const real = fs.readdirSync(lib).filter((f) => f.endsWith(".ts"));
  for (const [name, file, edit] of mutants) {
    const dir = fs.mkdtempSync(path.join(tmp, "m-"));
    for (const f of real) fs.copyFileSync(lib + "/" + f, dir + "/" + f);
    const before = fs.readFileSync(dir + "/" + file, "utf8"), after = edit(before);
    if (before === after) { t("mutant applies: " + name, false, "edit changed nothing"); continue; }
    fs.writeFileSync(dir + "/" + file, after);
    let red = false, why = "";
    try { const f = await runSuite(dir, fake, name.startsWith("d1: eviction statement")); red = f.length > 0; why = f[0] || ""; } catch (e) { red = true; why = "threw " + e.message; }
    t("mutant is caught: " + name, red);
    if (red) console.log("  mutant red ok: " + name + "  <- " + why.slice(0, 90));
  }
  if (path.basename(tmp).startsWith("f67-mut-") && tmp.startsWith(os.tmpdir() + path.sep)) fs.rmSync(tmp, { recursive: true });
}

console.log(`UNMATCHED LOG: ${pass} pass, ${fail} fail`);
if (fail) process.exit(1);
