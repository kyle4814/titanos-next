// f97 mutation runner: apply one bug at a time to src/market/dispute.ts, run test/dispute.test.ts, require a FAIL, restore.
// Usage: node test/mutate_dispute.mjs   (from portal-api). Synthetic only; the source file is restored in a finally block.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const SRC = new URL("../src/market/dispute.ts", import.meta.url).pathname, orig = readFileSync(SRC, "utf8");
const M = [
  ["I1 allow RESOLVE_PAID straight from OPEN", `"OPEN:SUBMIT_EVIDENCE": "EVIDENCE",`, `"OPEN:SUBMIT_EVIDENCE": "EVIDENCE",\n  "OPEN:RESOLVE_PAID": "RESOLVED_PAID",`],
  ["I1 allow exit from CLAWBACK", `"RESOLVED_PAID:REGRESSION": "CLAWBACK",`, `"RESOLVED_PAID:REGRESSION": "CLAWBACK",\n  "CLAWBACK:RESOLVE_REFUND": "RESOLVED_REFUNDED",`],
  ["I1 refund edge lands on the wrong state", `"EVIDENCE:RESOLVE_REFUND": "RESOLVED_REFUNDED"`, `"EVIDENCE:RESOLVE_REFUND": "RESOLVED_PAID"`],
  ["I1 skip the illegal check", `if (!to) return reject(input, \`illegal_transition:\${input.state}:\${e.kind}\`);`, `const to2 = to ?? input.state; if (false) return reject(input, "x");`],
  ["I2 replay re-applies instead of no-op", `if (seen) return seen.payloadHash === ph ?`, `if (false && seen) return seen.payloadHash === ph ?`],
  ["I2 same id different payload accepted as replay", `: reject(input, "event_id_reused_with_different_payload")`, `: { ok: true, case: input, replay: true }`],
  ["I3 transition forgets the audit entry", `append(c, { eventId: e.eventId, kind: e.kind, from, to,`, `if (e.kind !== "SUBMIT_EVIDENCE") append(c, { eventId: e.eventId, kind: e.kind, from, to,`],
  ["I3 audit chain not linked", `const prev = c.audit.length ? c.audit[c.audit.length - 1].hash : GENESIS;`, `const prev = GENESIS;`],
  ["I3 verifier ignores hash", `entryHash(rest) !== hash)`, `false)`],
  ["I3 detail left out of the hash", `x.at, x.actor, x.detail, x.payloadHash, x.prev]`, `x.at, x.actor, x.payloadHash, x.prev]`],
  ["I4 OPEN counts toward rank", `case "OPEN": case "EVIDENCE": return "frozen";`, `case "OPEN": return "counts"; case "EVIDENCE": return "frozen";`],
  ["I4 EVIDENCE counts toward rank", `case "OPEN": case "EVIDENCE": return "frozen";`, `case "OPEN": return "frozen"; case "EVIDENCE": return "counts";`],
  ["I4 CLAWBACK keeps credit", `case "RESOLVED_REFUNDED": case "CLAWBACK": return "revoked";`, `case "RESOLVED_REFUNDED": return "revoked"; case "CLAWBACK": return "counts";`],
  ["I4 refund keeps credit", `case "RESOLVED_REFUNDED": case "CLAWBACK": return "revoked";`, `case "CLAWBACK": return "revoked"; case "RESOLVED_REFUNDED": return "counts";`],
  ["I5 clawback without a payout", `if (c.paidAt === undefined || c.proofAt === undefined) return reject(input, "no_payout_to_claw_back");`, ``],
  ["I5 window check removed", `if (r - c.proofAt > WARRANTY_WINDOW_DAYS * DAY) return reject(input, "outside_warranty_window");`, ``],
  ["I5 window off by one (< instead of <=)", `r - c.proofAt > WARRANTY_WINDOW_DAYS * DAY`, `r - c.proofAt >= WARRANTY_WINDOW_DAYS * DAY`],
  ["I5 regression before proof accepted", `if (r < c.proofAt) return reject(input, "regression_before_proof");`, ``],
  ["I5 future-dated regression accepted", `if (r > e.at) return reject(input, "regression_in_the_future");`, ``],
  ["I5 card claims money moved", `resolved: false, moneyMoved: false };\n    c.cards.push(card);`, `resolved: false, moneyMoved: true as any };\n    c.cards.push(card);`],
  ["I5 card is not recorded on the case", `c.cards.push(card);`, ``],
  ["I5 card amount wrong", `jobId: c.jobId, amountCents: c.amountCents, reason`, `jobId: c.jobId, amountCents: 0, reason`],
  ["I6 time may run backwards", `if (last && e.at < last.at) return reject(input, "time_runs_backwards");`, ``],
  ["I-mut input mutated in place", `const c = structuredClone(input);`, `const c = input;`],
  ["I-ev empty evidence accepted", `if (!note) return reject(input, "evidence_empty");`, ``],
];
let killed = 0; const survivors = [];
try {
  for (const [name, from, to] of M) {
    if (!orig.includes(from)) { console.log(`NOAPPLY  ${name}`); survivors.push(name + " (pattern did not apply)"); continue; }
    writeFileSync(SRC, orig.replace(from, to));
    const r = spawnSync("node", ["--test", "--experimental-strip-types", new URL("./dispute.test.ts", import.meta.url).pathname], { encoding: "utf8" });
    if (r.status !== 0) { killed++; console.log(`KILLED   ${name}`); } else { survivors.push(name); console.log(`SURVIVED ${name}`); }
  }
} finally { writeFileSync(SRC, orig); }
console.log(`MUTATIONS ${killed}/${M.length} killed; survivors: ${survivors.length ? survivors.join("; ") : "none"}`);
process.exit(survivors.length ? 1 : 0);
