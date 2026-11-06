// D1MarketStore: the Cloudflare D1 adapter for MarketStore (F18). Written against migrations 0004_market.sql + 0005_market_d1.sql.
// NOT applied to any live D1 (GATE5); the Worker still fails closed on /market and /pro until it is wired and deployed.
// Rules: every transition is ONE conditional UPDATE ... WHERE id=? AND status IN (...) and the caller learns the result
// from rows changed (meta.changes === 1). Never read-then-write. All values are bound, never concatenated.
// The status and pro_account_id COLUMNS are authoritative (they are what the CAS tests); state_json carries the rest.
import type { D1Like } from "../env.ts";
import type { Job, JobStatus, MarketCard, MarketStore, ProProfile } from "./store.ts";

type Row = Record<string, unknown>;
const changes = (r: unknown): number => Number((r as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0);
const hydrate = (r: Row): Job => {
  const j = JSON.parse(String(r.state_json)) as Job;
  j.status = String(r.status) as JobStatus;                       // columns win over a stale or tampered JSON copy
  j.ownerAccountId = String(r.owner_account_id); j.domainId = String(r.domain_id); j.check = String(r.check_name);   // identity: never taken from JSON
  j.proAccountId = r.pro_account_id === null || r.pro_account_id === undefined ? undefined : String(r.pro_account_id);
  return j;
};
const toCard = (r: Row): MarketCard => ({ id: String(r.id), kind: String(r.kind) as MarketCard["kind"], jobId: String(r.job_id), reason: String(r.reason), createdAt: Number(r.created_at), resolved: Number(r.resolved) === 1, ...(r.outcome === null || r.outcome === undefined ? {} : { outcome: String(r.outcome) }) });
const COLS = "id, owner_account_id, pro_account_id, domain_id, check_name, status, state_json, updated_at, claim_deadline";

export class D1MarketStore implements MarketStore {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  async getJob(id: string) { const r = await this.db.prepare(`SELECT ${COLS} FROM market_jobs WHERE id = ?`).bind(id).first<Row>(); return r ? hydrate(r) : undefined; }
  async allJobs() { const r = await this.db.prepare(`SELECT ${COLS} FROM market_jobs ORDER BY rowid`).all<Row>(); return r.results.map(hydrate); }
  // Upsert. Identity columns (owner, domain, check) are written on insert only and never changed by an update.
  async putJob(j: Job) {
    await this.db.prepare(
      `INSERT INTO market_jobs (id, owner_account_id, pro_account_id, domain_id, check_name, status, state_json, updated_at, claim_deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET pro_account_id = excluded.pro_account_id, status = excluded.status, state_json = excluded.state_json, updated_at = excluded.updated_at, claim_deadline = excluded.claim_deadline`,
    ).bind(j.id, j.ownerAccountId, j.proAccountId ?? null, j.domainId, j.check, j.status, JSON.stringify(j), j.updatedAt, j.claimDeadline ?? null).run();
  }
  // THE compare-and-set: one statement. `from` is never empty (an empty IN () would match nothing, which fails closed).
  async transition(from: JobStatus[], j: Job) {
    if (from.length === 0) return false;
    const ph = from.map(() => "?").join(", ");
    const r = await this.db.prepare(
      `UPDATE market_jobs SET pro_account_id = ?, status = ?, state_json = ?, updated_at = ?, claim_deadline = ? WHERE id = ? AND status IN (${ph})`,
    ).bind(j.proAccountId ?? null, j.status, JSON.stringify(j), j.updatedAt, j.claimDeadline ?? null, j.id, ...from).run();
    return changes(r) === 1;
  }
  // Indexed claim-expiry read (idx_market_jobs_claim_deadline); the sweep may use it instead of scanning allJobs.
  async expiredClaims(now: number) {
    const r = await this.db.prepare(`SELECT ${COLS} FROM market_jobs WHERE status = 'claimed' AND claim_deadline IS NOT NULL AND claim_deadline < ? ORDER BY rowid`).bind(now).all<Row>();
    return r.results.map(hydrate);
  }
  async getPro(accountId: string) { const r = await this.db.prepare("SELECT state_json FROM pro_profiles WHERE account_id = ?").bind(accountId).first<Row>(); return r ? (JSON.parse(String(r.state_json)) as ProProfile) : undefined; }
  async putPro(p: ProProfile) { await this.db.prepare("INSERT INTO pro_profiles (account_id, state_json) VALUES (?, ?) ON CONFLICT(account_id) DO UPDATE SET state_json = excluded.state_json").bind(p.accountId, JSON.stringify(p)).run(); }
  async allPros() { const r = await this.db.prepare("SELECT state_json FROM pro_profiles ORDER BY rowid").all<Row>(); return r.results.map((x) => JSON.parse(String(x.state_json)) as ProProfile); }
  async putCard(c: MarketCard) {
    await this.db.prepare(
      `INSERT INTO market_cards (id, kind, job_id, reason, created_at, resolved, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET reason = excluded.reason, resolved = excluded.resolved, outcome = excluded.outcome`,
    ).bind(c.id, c.kind, c.jobId, c.reason, c.createdAt, c.resolved ? 1 : 0, c.outcome ?? null).run();
  }
  async getCard(id: string) { const r = await this.db.prepare("SELECT * FROM market_cards WHERE id = ?").bind(id).first<Row>(); return r ? toCard(r) : undefined; }
  async openCards() { const r = await this.db.prepare("SELECT * FROM market_cards WHERE resolved = 0 ORDER BY rowid").all<Row>(); return r.results.map(toCard); }
}
