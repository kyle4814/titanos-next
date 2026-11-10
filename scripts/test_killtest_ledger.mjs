// Test for killtest_ledger.mjs using SYNTHETIC fixture receipts under a temp dir.
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { scan, renderTable, parsePlan, maturity } from "./killtest_ledger.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("PASS " + m); } else { fail++; console.log("FAIL " + m); } };

const plan = `
| # | Chunk | Ships | L10 bar | Kill test |
|---|---|---|---|---|
| C1 | Guest scan | home | fast | at least 3% press |
| C2 | Login | acct | green | 0 human touches |
| C3 | Owner | lvl | rescan | 20 planted faults |
| C4 | Pro | jobs | proof | first 10 jobs paid |
| C5 | Shop | cat | graded | 1,000 shelves |
| C6 | Concierge | router | 80% | the 80% |
| C7 | Agent | mcp | receipts | 10 agents |
| C8 | Ent | sso | iso | 0 cross-tenant |
| C9 | Trust | pol | lint | 0 tells |
| C10 | Soak | 24h | board | green 24 h |
`;
const rows0 = parsePlan(plan);
ok(rows0.length === 10 && rows0[9].id === "C10" && rows0[0].kill === "at least 3% press", "plan parsed: 10 rows, kill text is the last cell");

const d = mkdtempSync(join(tmpdir(), "ktl-"));
if (!d.startsWith(tmpdir())) throw new Error("bad tmp");
const w = (name, body, t) => { const p = join(d, name); writeFileSync(p, body); utimesSync(p, t, t); };
w("WEB_w1_c1scan_RECEIPT.md", "x\nC1SCAN OK 56 7cdaab3121c51541434614cc4c90e400b2db9dce\n", 1000);
w("FILL_f10_c2_drill50_RECEIPT.md", "mentions C3 in body\nDRILL OK 50 runs, 12 tests pass\n", 1000);
w("FILL_f11_c10_soak_harness_RECEIPT.md", "SOAK OK stub run GREEN, commit d2f\n", 1000);
w("WEB_wA_accept_RECEIPT.md", "body\nACCEPT FAILED C3 C4\n", 1000);
w("FILL_f20_c3_spf_RECEIPT.md", "q\nSPF OK 9 new tests, 113/113 pass\n", 2000);
w("FILL_f99_c7_x_RECEIPT.md", "q\nX FAILED blocked\n", 1000);
w("FILL_f98_c8_y_RECEIPT.md", "q\nY OK 5 tests pass, INDEPENDENTLY VERIFIED by reviewer\n", 1000);
w("FILL_fp_1_RECEIPT.md", "PLAN OK f1_c5_z\n", 1000);
w("FILL_f97_c9_empty_RECEIPT.md", "\n\n", 1000);
w("notes.md", "NOTE OK c6\n", 1000);

const rows = scan(plan, d);
const by = Object.fromEntries(rows.map((r) => [r.id, r]));
ok(by.C1.maturity === "TESTED" && by.C1.receipts.join() === "WEB_w1_c1scan", "C1 TESTED via WEB_w1 name tag");
ok(by.C2.maturity === "TESTED" && by.C2.receipts.length === 1, "C2 TESTED via _c2_ tag");
ok(by.C10.maturity === "IMPLEMENTED", "C10 OK without test evidence is IMPLEMENTED, never TESTED");
ok(by.C3.receipts.includes("FILL_f20_c3_spf") && by.C3.receipts.includes("WEB_wA_accept") && !by.C3.receipts.includes("FILL_f10_c2_drill50"), "C3 names f20 and wA (final line token), not the C2 receipt whose body mentions C3");
ok(by.C3.okCount === 1 && by.C3.failedCount === 1 && by.C3.maturity === "TESTED", "C3 counts OK 1 / FAILED 1, TESTED from the OK");
ok(!by.C1.receipts.includes("FILL_f20_c3_spf"), "R-C1 finding id in a final line does not name chunk C1");
ok(by.C4.maturity === "PROPOSED" && by.C4.last.startsWith("FAILED"), "C4 only FAILED -> PROPOSED");
ok(by.C7.maturity === "PROPOSED", "C7 FAILED only -> PROPOSED");
ok(by.C8.maturity === "INDEPENDENTLY VERIFIED", "C8 final line says so -> INDEPENDENTLY VERIFIED");
ok(by.C5.maturity === "UNKNOWN" && by.C5.last === "UNKNOWN" && by.C5.receipts.length === 0, "C5 planner receipt excluded -> UNKNOWN");
ok(by.C6.maturity === "UNKNOWN", "C6 non-RECEIPT file ignored -> UNKNOWN");
ok(by.C9.maturity === "UNKNOWN" || by.C9.maturity === "PROPOSED", "C9 empty receipt does not become TESTED");
ok(!rows.some((r) => ["ENFORCED LIVE"].includes(r.maturity)), "nothing reaches ENFORCED LIVE without a receipt saying so");
ok(maturity([]) === "UNKNOWN", "maturity([]) is UNKNOWN");

const md = renderTable(rows, { date: "2026-11-06", dir: d, count: 8 });
ok(md.includes("TESTED or above: 4 of 10 (C1, C2, C3, C8).") || /TESTED or above: \d of 10/.test(md), "summary line present");
ok(md.includes("| C5 Shop |") && md.includes("| none |"), "table row for chunk with no receipts says none");
ok(!md.includes("—") && !md.includes("–"), "no em or en dashes in output");

const out = join(d, "out.md");
const r = spawnSync("node", ["scripts/killtest_ledger.mjs", join(d, "plan.md"), d, out]);
ok(r.status === 2 || r.status === 1, "missing plan file fails closed (non-zero)");
writeFileSync(join(d, "plan.md"), plan);
const r2 = spawnSync("node", ["scripts/killtest_ledger.mjs", join(d, "plan.md"), d, out]);
ok(r2.status === 0, "CLI exits 0 with plan and dir");
const r3 = spawnSync("node", ["scripts/killtest_ledger.mjs"]);
ok(r3.status === 2, "CLI without args exits 2");

rmSync(d, { recursive: true, force: true });
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
