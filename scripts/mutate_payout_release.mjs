#!/usr/bin/env node
// C8 f54 mutation check for payout release / refund. Applies each mutant to a source file, runs the f54 test file, and
// expects the tests to FAIL (mutant killed). Always restores the original bytes (try/finally) and verifies the tree is clean.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = join(root, "portal-api");
const REL = "src/enterprise/payout_release.ts", SVC = "src/enterprise/service.ts", RT = "src/enterprise/routes.ts", ST = "src/enterprise/store.ts";
const M = [
  [REL, "release: skip held-only CAS (from held -> from approved_retry)", 'transitionPayout(p0.id, "held", "approved_retry"', 'transitionPayout(p0.id, "approved_retry", "approved_retry"'],
  [REL, "release: attempts not reset", "{ attempts: 0, releasedAt", "{ releasedAt"],
  [REL, "release: releasedAt not set (replay lost)", "attempts: 0, releasedAt: env.now,", "attempts: 0,"],
  [REL, "release: wrong target status", '"held", "approved_retry", {', '"held", "sending", {'],
  [REL, "release: replay refused instead of no-op", 'return { ok: true, outcome: "replayed", action: "release", payout: p0 };', 'return { ok: false, refused: "wrong_state", payout: p0 };'],
  [REL, "release: refunded row not refused", 'if (p0.status === "refunded") return { ok: false, refused: "already_refunded", payout: p0 };\n  if (p0.status !== "held") {', 'if (p0.status !== "held") {'],
  [REL, "release: operator note dropped", "...(note ? { operatorNote: note } : {}) }); // fields land", "}); // fields land"],
  [REL, "release: tenant check removed", "if (!p || p.partnerId !== req.tenantId) return", "if (!p) return"],
  [REL, "refund: reversal amount sign flipped", "amountCents: -original.amountCents", "amountCents: original.amountCents"],
  [REL, "refund: reversal uniq not per payout (double refund doubles)", "uniq: `payout_reversal:${p.id}`", "uniq: `payout_reversal:${env.newId()}`"],
  [REL, "refund: no ledger entry written", "  await reverse(env, won, original);\n  return { ok: true, outcome: \"applied\", action: \"refund\"", "  return { ok: true, outcome: \"applied\", action: \"refund\""],
  [REL, "refund: replay does not heal the ledger", 'if (p0.status === "refunded") { await reverse(env, p0, original); return', 'if (p0.status === "refunded") { return'],
  [REL, "refund: missing original entry not refused", "if (!original) return { ok: false, refused: \"ledger_entry_missing\", payout: p0 };", ""],
  [REL, "refund: lost CAS answered as success", 'return { ok: false, refused: "wrong_state", payout: now };\n  }\n  await reverse(env, won', 'return { ok: true, outcome: "replayed", action: "refund", payout: now! };\n  }\n  await reverse(env, won'],
  [REL, "refund: CAS from wrong status", 'transitionPayout(p0.id, "held", "refunded"', 'transitionPayout(p0.id, "approved_retry", "refunded"'],
  [REL, "refund: wrong target status", '"held", "refunded", {', '"held", "failed", {'],
  [SVC, "service: audit row dropped", 'if (r.outcome === "applied") await audit(d, tid, "operator", `payout_${action}`, payoutId);', ""],
  [SVC, "service: audit also on replay", 'if (r.outcome === "applied") await audit', "await audit"],
  [SVC, "service: tenant not mandatory", "if (!tid || !tenantParam(payoutId))", "if (!tenantParam(payoutId))"],
  [SVC, "service: refusal maps to 200", "throw new HttpError(409, r.refused);", "return { ok: false };"],
  [RT, "route: release/refund bypass the secret check", "s.checkOperator(d, req.headers.get(\"x-internal-secret\"));\n    if (path === \"/internal/enterprise/payouts/held\"", "if (path === \"/internal/enterprise/payouts/held\""],
  [ST, "store: CAS patch ignored", "if (patch) Object.assign(p, patch); return p;", "return p;"],
];

const read = (f) => readFileSync(join(api, f), "utf8");
const origs = new Map(); for (const f of new Set(M.map((m) => m[0]))) origs.set(f, read(f));
const restore = () => { for (const [f, s] of origs) writeFileSync(join(api, f), s); };
const run = () => spawnSync("node", ["--test", "--experimental-strip-types", "test/payout_release.test.ts"], { cwd: api, encoding: "utf8", timeout: 120000 });

let killed = 0, survived = [], skipped = [];
try {
  const base = run();
  if (base.status !== 0) { console.error("BASELINE FAILS: fix the tests before mutating"); process.exitCode = 2; throw new Error("baseline"); }
  for (const [f, name, from, to] of M) {
    const src = origs.get(f);
    if (!src.includes(from)) { skipped.push(name + " (pattern not found)"); continue; }
    writeFileSync(join(api, f), src.replace(from, () => to));
    const r = run();
    restore();
    if (r.status !== 0) { killed++; console.log("KILLED   ", name); } else { survived.push(name); console.log("SURVIVED ", name); }
  }
} catch (e) { if (e.message !== "baseline") throw e; }
finally { restore(); }
const dirty = execFileSync("git", ["status", "--porcelain", "--", "portal-api/src"], { cwd: root, encoding: "utf8" });
const total = M.length - skipped.length;
console.log(`mutants killed ${killed} of ${total}${skipped.length ? `; SKIPPED ${skipped.length}: ${skipped.join("; ")}` : ""}`);
console.log(`source files restored: ${[...origs].every(([f, s]) => read(f) === s) ? "yes" : "NO"}`);
if (survived.length) console.log("SURVIVORS:", survived.join("; "));
process.exitCode = process.exitCode || (survived.length || skipped.length ? 1 : 0);
