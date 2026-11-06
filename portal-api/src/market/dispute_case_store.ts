// F-C4 residual (f187): a DURABLE dispute case store behind the f103 DisputeCaseStore interface (dispute_trail.ts, unchanged).
// Two adapters, one contract (test/dispute_case_store.test.ts): MemoryTenantCaseStore and D1DisputeCaseStore (migrations/0007_dispute_case.sql).
// Invariants (tests + mutants in test/mutate_dispute_case_store.mjs):
//   D1 tenant scope: tenant_id is in EVERY statement's WHERE. The tenant is resolved from the job (tenantOf); unresolvable = absent on read, refused on write.
//   D2 chain and case are one write: the audit chain is inside the case row, written by one INSERT (new) or one UPDATE guarded by the previous head (CAS).
//   D3 compare-and-set: a write is accepted only if the row's head is still the head this instance last read or wrote; else CaseConflict ("case_conflict", 409), nothing changes.
//   D4 fail closed: a row whose JSON disagrees with its head / audit_len / state / job is NOT returned (CaseRowCorrupt), and a write with no prior read is refused.
// The CAS token lives in the instance (lastSeen), so build one store per request / unit of work. Two instances over one database DO conflict (tested).
// Honest limit: the anchor table is still a second table in the same database; a writer of both defeats it (separate witness = GATE5).
import type { D1Like } from "../env.ts";
import type { DisputeCase } from "./dispute.ts";
import { TrailError, type DisputeCaseStore } from "./dispute_trail.ts";

export type TenantOf = (jobId: string) => Promise<string | undefined> | string | undefined;
export class CaseConflict extends TrailError { constructor() { super("case_conflict"); } }
export class CaseRowCorrupt extends Error { constructor(why: string) { super(`case_row_corrupt:${why}`); } }

const GENESIS = "0".repeat(64);
const headOf = (c: DisputeCase) => (c.audit.length ? c.audit[c.audit.length - 1].hash : GENESIS);
function checkCase(c: DisputeCase, jobId: string, head: string, len: number, state: string) {
  if (!c || c.jobId !== jobId) throw new CaseRowCorrupt("job");
  if (!Array.isArray(c.audit) || c.audit.length !== len) throw new CaseRowCorrupt("audit_len");
  if (headOf(c) !== head) throw new CaseRowCorrupt("head");
  if (c.state !== state) throw new CaseRowCorrupt("state");
}

abstract class CasBase implements DisputeCaseStore {
  protected seen = new Map<string, string | null>();   // jobId -> head last read or written (null = known absent)
  protected tenantOf: TenantOf;
  constructor(tenantOf: TenantOf) { this.tenantOf = tenantOf; }
  protected abstract read(tenant: string, jobId: string): Promise<{ head: string; len: number; state: string; json: string } | undefined>;
  protected abstract insert(tenant: string, c: DisputeCase): Promise<boolean>;
  protected abstract update(tenant: string, c: DisputeCase, expect: string): Promise<boolean>;
  protected abstract remove(tenant: string, jobId: string, expect: string): Promise<boolean>;
  async get(jobId: string): Promise<DisputeCase | undefined> {
    const tenant = await this.tenantOf(jobId);
    if (!tenant) { this.seen.set(jobId, null); return undefined; }
    const row = await this.read(tenant, jobId);
    if (!row) { this.seen.set(jobId, null); return undefined; }
    const c = JSON.parse(row.json) as DisputeCase; checkCase(c, jobId, row.head, row.len, row.state);
    this.seen.set(jobId, row.head); return c;
  }
  private async tenant(jobId: string) {
    const t = await this.tenantOf(jobId); if (!t) throw new TrailError("case_tenant_unknown");
    if (!this.seen.has(jobId)) throw new TrailError("case_unread");   // D4: never write blind
    return t;
  }
  async put(c: DisputeCase): Promise<void> {
    if (!c.audit.length) throw new TrailError("case_chain_empty");
    const t = await this.tenant(c.jobId), expect = this.seen.get(c.jobId)!;
    const ok = expect === null ? await this.insert(t, c) : await this.update(t, c, expect);
    if (!ok) throw new CaseConflict();
    this.seen.set(c.jobId, headOf(c));
  }
  async delete(jobId: string): Promise<void> {
    const t = await this.tenant(jobId), expect = this.seen.get(jobId)!;
    if (expect === null) return;
    if (!(await this.remove(t, jobId, expect))) throw new CaseConflict();
    this.seen.set(jobId, null);
  }
}

export class MemoryTenantCaseStore extends CasBase {
  private rows: Map<string, { head: string; len: number; state: string; json: string }>;
  constructor(tenantOf: TenantOf, rows: Map<string, { head: string; len: number; state: string; json: string }> = new Map()) { super(tenantOf); this.rows = rows; }
  private k = (t: string, j: string) => `${t}\u0000${j}`;
  protected async read(t: string, j: string) { return this.rows.get(this.k(t, j)); }
  protected async insert(t: string, c: DisputeCase) { const k = this.k(t, c.jobId); if (this.rows.has(k)) return false; this.rows.set(k, { head: headOf(c), len: c.audit.length, state: c.state, json: JSON.stringify(c) }); return true; }
  protected async update(t: string, c: DisputeCase, expect: string) { const k = this.k(t, c.jobId), r = this.rows.get(k); if (!r || r.head !== expect) return false; this.rows.set(k, { head: headOf(c), len: c.audit.length, state: c.state, json: JSON.stringify(c) }); return true; }
  protected async remove(t: string, j: string, expect: string) { const k = this.k(t, j), r = this.rows.get(k); if (!r || r.head !== expect) return false; this.rows.delete(k); return true; }
}

// D1 adapter, written against migrations/0007_dispute_case.sql. Tested against a FakeD1 only; never applied live.
export class D1DisputeCaseStore extends CasBase {
  private db: D1Like;
  constructor(db: D1Like, tenantOf: TenantOf) { super(tenantOf); this.db = db; }
  protected async read(t: string, j: string) {
    const r = await this.db.prepare("SELECT head, audit_len, state, case_json FROM dispute_case WHERE tenant_id = ? AND job_id = ?").bind(t, j).first<Record<string, unknown>>();
    return r ? { head: String(r.head), len: Number(r.audit_len), state: String(r.state), json: String(r.case_json) } : undefined;
  }
  private changed = (r: unknown) => Number((r as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1;
  protected async insert(t: string, c: DisputeCase) {
    return this.changed(await this.db.prepare("INSERT INTO dispute_case (tenant_id, job_id, state, head, audit_len, case_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, job_id) DO NOTHING")
      .bind(t, c.jobId, c.state, headOf(c), c.audit.length, JSON.stringify(c), c.audit[c.audit.length - 1].at).run());
  }
  protected async update(t: string, c: DisputeCase, expect: string) {
    return this.changed(await this.db.prepare("UPDATE dispute_case SET state = ?, head = ?, audit_len = ?, case_json = ?, updated_at = ? WHERE tenant_id = ? AND job_id = ? AND head = ?")
      .bind(c.state, headOf(c), c.audit.length, JSON.stringify(c), c.audit[c.audit.length - 1].at, t, c.jobId, expect).run());
  }
  protected async remove(t: string, j: string, expect: string) {
    return this.changed(await this.db.prepare("DELETE FROM dispute_case WHERE tenant_id = ? AND job_id = ? AND head = ?").bind(t, j, expect).run());
  }
}
