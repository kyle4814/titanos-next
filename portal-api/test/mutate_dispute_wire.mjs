// f99 mutation runner: one bug at a time in dispute.ts / service.ts; test/dispute_wire.test.ts must FAIL; sources restored in finally.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const D = new URL("../src/market/dispute.ts", import.meta.url).pathname, S = new URL("../src/market/service.ts", import.meta.url).pathname;
const src = { [D]: readFileSync(D, "utf8"), [S]: readFileSync(S, "utf8") };
const M = [
  ["W1 dispute() does not open a case", S, `j.disputeCase = openDispute(`, `void (`],
  ["W2 refund skips the machine", S, `{ closeCase(d, j, "RESOLVE_REFUND"); await refundAndClose`, `{ await refundAndClose`],
  ["W2 evidence step skipped (illegal edge swallowed)", S, `if (c.state === "OPEN") { const r = applyDispute`, `if (false) { const r = applyDispute`],
  ["W2b resume drops the audit", S, `(j.disputeArchive ??= []).push(j.disputeCase);`, ``],
  ["W4 clawback does not record the case", S, `  j.disputeCase = reg.case;\n`, ``],
  ["W4 clawback recorded without the ledger gate", S, `const cb = clawbackFor(j, now); if (!cb) return;`, `const cb = clawbackFor(j, now) ?? { amountCents: j.priceCents, id: "cb_x", jobId: j.id, proAccountId: j.proAccountId!, at: now, reason: "x", status: "recorded" as const, moneyMoved: false as const };`],
  ["W5 dispute() omits proofAt", S, `reason: text, proofAt: j.proof?.at }`, `reason: text }`],
  ["W5 openDispute ignores proofAt", D, `...(a.proofAt !== undefined ? { proofAt: a.proofAt } : {}),`, ``],
  ["W5 resolution resets the clock", D, `c.proofAt ??= e.at;`, `c.proofAt = e.at;`],
  ["W5 proofAt not validated", D, `if (a.proofAt !== undefined && !Number.isFinite(a.proofAt)) throw new Error("proof_at_invalid");`, ``],
  ["W3 dispute credit counts", D, `case "OPEN": case "EVIDENCE": return "frozen";`, `case "OPEN": case "EVIDENCE": return "counts";`],
];
let killed = 0; const surv = [];
try {
  for (const [name, f, from, to] of M) {
    if (!src[f].includes(from)) { surv.push(name + " (no apply)"); console.log("NOAPPLY  " + name); continue; }
    writeFileSync(f, src[f].replace(from, to));
    const r = spawnSync("node", ["--test", "--experimental-strip-types", new URL("./dispute_wire.test.ts", import.meta.url).pathname], { encoding: "utf8" });
    if (r.status !== 0) { killed++; console.log("KILLED   " + name); } else { surv.push(name); console.log("SURVIVED " + name); }
    writeFileSync(f, src[f]);
  }
} finally { for (const f of Object.keys(src)) writeFileSync(f, src[f]); }
console.log(`MUTATIONS ${killed}/${M.length} killed; survivors: ${surv.length ? surv.join("; ") : "none"}`);
process.exit(surv.length ? 1 : 0);
