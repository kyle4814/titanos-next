// f187 mutation runner: one bug at a time into src/market/dispute_case_store.ts and migrations/0007_dispute_case.sql; require
// test/dispute_case_store.test.ts to FAIL; restore. Usage: node test/mutate_dispute_case_store.mjs (from portal-api). Synthetic only.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const P = (f) => new URL(f, import.meta.url).pathname;
const C = P("../src/market/dispute_case_store.ts"), Q = P("../migrations/0007_dispute_case.sql");
const orig = { [C]: readFileSync(C, "utf8"), [Q]: readFileSync(Q, "utf8") };
const M = [
  [C, "D1 read ignores tenant", `WHERE tenant_id = ? AND job_id = ?").bind(t, j).first`, `WHERE job_id = ?").bind(j).first`],
  [C, "D1 update ignores tenant", `WHERE tenant_id = ? AND job_id = ? AND head = ?")\n      .bind(c.state, headOf(c), c.audit.length, JSON.stringify(c), c.audit[c.audit.length - 1].at, t, c.jobId, expect)`, `WHERE job_id = ? AND head = ?")\n      .bind(c.state, headOf(c), c.audit.length, JSON.stringify(c), c.audit[c.audit.length - 1].at, c.jobId, expect)`],
  [C, "D1 delete ignores tenant", `DELETE FROM dispute_case WHERE tenant_id = ? AND job_id = ? AND head = ?").bind(t, j, expect)`, `DELETE FROM dispute_case WHERE job_id = ? AND head = ?").bind(j, expect)`],
  [C, "D1 update not CAS (no head guard)", ` AND job_id = ? AND head = ?")\n      .bind(c.state, headOf(c), c.audit.length, JSON.stringify(c), c.audit[c.audit.length - 1].at, t, c.jobId, expect)`, ` AND job_id = ?")\n      .bind(c.state, headOf(c), c.audit.length, JSON.stringify(c), c.audit[c.audit.length - 1].at, t, c.jobId)`],
  [C, "D1 delete not CAS", `AND job_id = ? AND head = ?").bind(t, j, expect)`, `AND job_id = ?").bind(t, j)`],
  [C, "D1 insert overwrites (no DO NOTHING)", `ON CONFLICT(tenant_id, job_id) DO NOTHING`, `ON CONFLICT(tenant_id, job_id) DO UPDATE SET head = excluded.head, audit_len = excluded.audit_len, state = excluded.state, case_json = excluded.case_json`],
  [C, "D1 stores a stale head", `.bind(t, c.jobId, c.state, headOf(c), c.audit.length`, `.bind(t, c.jobId, c.state, GENESIS, c.audit.length`],
  [C, "memory update not CAS", `if (!r || r.head !== expect) return false; this.rows.set(k, {`, `if (!r) return false; this.rows.set(k, {`],
  [C, "memory insert overwrites", `if (this.rows.has(k)) return false; this.rows.set(k, {`, `this.rows.set(k, {`],
  [C, "memory delete not CAS", `if (!r || r.head !== expect) return false; this.rows.delete(k)`, `if (!r) return false; this.rows.delete(k)`],
  [C, "memory key drops tenant", "private k = (t: string, j: string) => `${t}\\u0000${j}`;", "private k = (_t: string, j: string) => `${j}`;"],
  [C, "write with no prior read allowed", `if (!this.seen.has(jobId)) throw new TrailError("case_unread");`, ``],
  [C, "unknown tenant write allowed (falls back to empty)", `const t = await this.tenantOf(jobId); if (!t) throw new TrailError("case_tenant_unknown");`, `const t = (await this.tenantOf(jobId)) ?? "none";`],
  [C, "lastSeen not advanced after a write", `this.seen.set(c.jobId, headOf(c));\n  }`, `}`],
  [C, "lastSeen not cleared after delete", `this.seen.set(jobId, null);\n  }\n}`, `}\n}`],
  [C, "corrupt head accepted", `if (headOf(c) !== head) throw new CaseRowCorrupt("head");`, ``],
  [C, "corrupt audit_len accepted", `c.audit.length !== len) throw new CaseRowCorrupt("audit_len")`, `c.audit.length < 0) throw new CaseRowCorrupt("audit_len")`],
  [C, "corrupt state accepted", `if (c.state !== state) throw new CaseRowCorrupt("state");`, ``],
  [C, "corrupt job id accepted", `if (!c || c.jobId !== jobId) throw new CaseRowCorrupt("job");`, `if (!c) throw new CaseRowCorrupt("job");`],
  [C, "conflict swallowed on put", `if (!ok) throw new CaseConflict();\n    this.seen`, `this.seen`],
  [C, "conflict swallowed on delete", `if (!(await this.remove(t, jobId, expect))) throw new CaseConflict();`, `await this.remove(t, jobId, expect);`],
  [C, "conflict is a generic error (not a TrailError reason)", `super("case_conflict")`, `super("anchor_failed:conflict")`],
  [C, "empty chain accepted", `if (!c.audit.length) throw new TrailError("case_chain_empty");`, ``],
  [Q, "migration: state CHECK dropped", `CHECK (state IN ('OPEN','EVIDENCE','RESOLVED_PAID','RESOLVED_REFUNDED','CLAWBACK'))`, ``],
  [Q, "migration: head length CHECK dropped", `CHECK (length(head) = 64)`, ``],
  [Q, "migration: identity trigger dropped", `CREATE TRIGGER IF NOT EXISTS dispute_case_identity_fixed BEFORE UPDATE OF tenant_id, job_id ON dispute_case BEGIN SELECT RAISE(ABORT, 'dispute_case_identity_fixed'); END;`, ``],
  [Q, "migration: primary key drops tenant", `PRIMARY KEY (tenant_id, job_id)`, `PRIMARY KEY (job_id)`],
];
let killed = 0, applied = 0; const survivors = [];
try {
  for (const [file, name, from, to] of M) {
    if (!orig[file].includes(from)) { console.log(`NOAPPLY  ${name}`); survivors.push(name + " (pattern did not apply)"); continue; }
    applied++; writeFileSync(file, orig[file].replace(from, to));
    const r = spawnSync("node", ["--test", "--experimental-strip-types", P("./dispute_case_store.test.ts")], { encoding: "utf8" });
    writeFileSync(file, orig[file]);
    if (r.status !== 0) { killed++; console.log(`KILLED   ${name}`); } else { survivors.push(name); console.log(`SURVIVED ${name}`); }
  }
} finally { for (const f of Object.keys(orig)) writeFileSync(f, orig[f]); }
console.log(`MUTATIONS ${killed}/${M.length} killed; survivors: ${survivors.length ? survivors.join("; ") : "none"}`);
process.exit(survivors.length ? 1 : 0);
