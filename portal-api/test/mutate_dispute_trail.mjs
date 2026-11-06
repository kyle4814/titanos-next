// f103 mutation runner: one bug at a time into the anchor wiring (dispute_trail.ts, market/service.ts, index.ts); require test/dispute_trail.test.ts to FAIL; restore.
// Usage: node test/mutate_dispute_trail.mjs (from portal-api). Synthetic only; sources restored in a finally block.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const P = (f) => new URL(f, import.meta.url).pathname;
const T = P("../src/market/dispute_trail.ts"), S = P("../src/market/service.ts"), I = P("../src/index.ts");
const orig = { [T]: readFileSync(T, "utf8"), [S]: readFileSync(S, "utf8"), [I]: readFileSync(I, "utf8") };
const M = [
  [T, "W1 no restore on anchor failure", `const restore = async () => { if (good) await t.cases.put(good); else await t.cases.delete(jobId); };`, `const restore = async () => {};`],
  [T, "W1 restore ignores no-prior-case (leaves the new case)", `else await t.cases.delete(jobId); };`, `};`],
  [T, "W1 restore goes to the start, not the last anchored", `if (good) await t.cases.put(good);`, `if (start) await t.cases.put(start);`],
  [T, "W1 anchor result ignored", `if (!a.ok) throw new TrailError(\`anchor_failed:\${a.reason}\`);`, ``],
  [T, "W1 anchor throw escapes unconverted", `throw e instanceof TrailError ? e : new TrailError("anchor_failed:store_error");`, `throw e;`],
  [T, "W2 anchoring skipped", `const a = await anchorCase(t.anchors, cur, at);`, `const a = { ok: true } as any;`],
  [T, "W2 only the first step is anchored", `const a = await anchorCase(t.anchors, cur, at);`, `const a = steps.indexOf(s) === 0 ? await anchorCase(t.anchors, cur, at) : { ok: true } as any;`],
  [T, "W2 good advances before the anchor", `await t.cases.put(cur);\n      const a`, `good = cur; await t.cases.put(cur);\n      const a`],
  [T, "W3 verdict ignores anchors (verifyAudit only)", `verdict = await verifyAnchored(t.anchors, c);`, `verdict = verifyAudit(c) === null ? { ok: true, anchoredThrough: c.audit.length, unanchoredTail: 0 } : { ok: false, reason: "chain_broken" };`],
  [T, "W3 verify error reported as verified", `verdict = { ok: false, reason: "unanchored" }; }`, `verdict = { ok: true, anchoredThrough: c.audit.length, unanchoredTail: 0 }; }`],
  [T, "open allowed over an existing case", `if (cur) throw new TrailError("case_exists");`, ``],
  [S, "open: job write not undone on anchor failure", `catch (e) { if (before) await m.store.transition(["disputed"], before); return anchorFail(e); }`, `catch (e) { return anchorFail(e); }`],
  [S, "open: card raised before anchor", `  const before = await m.store.getJob(id);`, `  await m.store.putCard(card); const before = await m.store.getJob(id);`],
  [S, "open: case never recorded", `await commit(t, j.id, [reopened`, `if (false) await commit(t, j.id, [reopened`],
  [S, "evidence: party scope removed", `if (j.ownerAccountId !== a.id && j.proAccountId !== a.id) throw new HttpError(404, "not_found");\n  if (j.status !== "disputed") throw new HttpError(409, "not_disputed");`, `if (j.status !== "disputed") throw new HttpError(409, "not_disputed");`],
  [S, "evidence: no anchor (commit skipped)", `try { const c = await commit(trailOf(m), j.id, [{ event: { eventId, kind: "SUBMIT_EVIDENCE"`, `try { const c = { state: "EVIDENCE", audit: [] } as any; if (0) await commit(trailOf(m), j.id, [{ event: { eventId, kind: "SUBMIT_EVIDENCE"`],
  [S, "audit: cross-tenant answers 403", `export async function disputeAudit(d: Deps, a: Account, id: string) {\n  const m = mk(d); const j = await need(m, id);\n  if (j.ownerAccountId !== a.id && j.proAccountId !== a.id) throw new HttpError(404, "not_found");`, `export async function disputeAudit(d: Deps, a: Account, id: string) {\n  const m = mk(d); const j = await need(m, id);\n  if (j.ownerAccountId !== a.id && j.proAccountId !== a.id) throw new HttpError(403, "forbidden");`],
  [S, "audit: scope removed", `export async function disputeAudit(d: Deps, a: Account, id: string) {\n  const m = mk(d); const j = await need(m, id);\n  if (j.ownerAccountId !== a.id && j.proAccountId !== a.id) throw new HttpError(404, "not_found");`, `export async function disputeAudit(d: Deps, a: Account, id: string) {\n  const m = mk(d); const j = await need(m, id);`],
  [S, "audit: missing case is 200 empty", `const r = await report(trailOf(m), j.id); if (!r) throw new HttpError(404, "not_found");`, `const r = (await report(trailOf(m), j.id)) ?? { jobId: j.id, state: "NONE", entries: 0, verdict: { ok: true } } as any;`],
  [S, "resolve: refund before anchor", `    if (outcome === "refund_owner") { await refundAndClose(d, j, "refunded", "dispute resolved: owner refunded"); }\n    else if`, `    if (outcome === "refund_owner") { await refundAndClose(d, j, "refunded", "dispute resolved: owner refunded"); }\n    else if`],
  [S, "resolve: anchor failure swallowed", `try { await commit(t, j.id, steps, at); } catch (e) { return anchorFail(e); }`, `try { await commit(t, j.id, steps, at); } catch (e) { }`],
  [S, "resolve: reviewer note step dropped from OPEN", `if (state === "OPEN") steps.push(`, `if (false) steps.push(`],
  [S, "redispute opens a second chain", `const t = trailOf(m), reopened = !!(await t.cases.get(j.id));`, `const t = trailOf(m), reopened = false;`],
  [S, "anchor failure reported as 200-ish (409 not 503)", `e instanceof TrailError && !e.reason.startsWith("anchor_failed") ? 409 : 503`, `409`],
  [I, "audit route unregistered", `seg[4] === "audit" && m === "GET"`, `seg[4] === "audit" && m === "HEAD"`],
  [I, "evidence route unregistered", `seg[4] === "evidence" && m === "POST"`, `seg[4] === "evidence" && m === "PUT"`],
];
// the "resolve: refund before anchor" mutant moves commit after the refund: do it by swapping the block order instead
M[19] = [S, "resolve: refund before anchor", `    {\n      const t = trailOf(m), at = d.now(), steps: Step[] = [], have`, `    if (outcome === "refund_owner") await refundAndClose(d, j, "refunded", "early");\n    {\n      const t = trailOf(m), at = d.now(), steps: Step[] = [], have`];
let killed = 0; const survivors = [];
try {
  for (const [file, name, from, to] of M) {
    if (!orig[file].includes(from)) { console.log(`NOAPPLY  ${name}`); survivors.push(name + " (pattern did not apply)"); continue; }
    writeFileSync(file, orig[file].replace(from, to));
    const r = spawnSync("node", ["--test", "--experimental-strip-types", P("./dispute_trail.test.ts")], { encoding: "utf8" });
    writeFileSync(file, orig[file]);
    if (r.status !== 0) { killed++; console.log(`KILLED   ${name}`); } else { survivors.push(name); console.log(`SURVIVED ${name}`); }
  }
} finally { for (const f of Object.keys(orig)) writeFileSync(f, orig[f]); }
console.log(`MUTATIONS ${killed}/${M.length} killed; survivors: ${survivors.length ? survivors.join("; ") : "none"}`);
process.exit(survivors.length ? 1 : 0);
