// D1MarketStore: the MarketStore over D1 (migration 0004 + 0006). A job and a pro profile are one JSON row each, like the owner seat;
// status and the two account ids are mirrored in columns so claim and payout are single compare-and-set statements.
import type { D1Like } from "../env.ts";
import type { Job, JobStatus, MarketCard, MarketStore, ProProfile } from "./store.ts";

const changes = (r: unknown) => Number((r as { meta?: { changes?: number } })?.meta?.changes ?? 0);
type Row = Record<string, any>;
export class D1MarketStore implements MarketStore {
  db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  private async rows(sql: string, ...a: unknown[]) { return (await this.db.prepare(sql).bind(...a).all<Row>()).results; }
  async getJob(id: string) { const r = await this.db.prepare("SELECT state_json FROM market_jobs WHERE id = ?").bind(id).first<Row>(); return r ? (JSON.parse(r.state_json) as Job) : undefined; }
  async allJobs() { return (await this.rows("SELECT state_json FROM market_jobs ORDER BY rowid")).map((r) => JSON.parse(r.state_json) as Job); }
  async putJob(j: Job) {
    await this.db.prepare("INSERT INTO market_jobs (id, owner_account_id, pro_account_id, domain_id, check_name, status, state_json, updated_at) VALUES (?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET pro_account_id=excluded.pro_account_id, status=excluded.status, state_json=excluded.state_json, updated_at=excluded.updated_at WHERE market_jobs.owner_account_id = excluded.owner_account_id")
      .bind(j.id, j.ownerAccountId, j.proAccountId ?? null, j.domainId, j.check, j.status, JSON.stringify(j), j.updatedAt).run();
  }
  // Compare-and-set in ONE statement. Two racing claimers: exactly one sees changes = 1.
  async transition(from: JobStatus[], j: Job) {
    if (!from.length) return false;
    const r = await this.db.prepare(`UPDATE market_jobs SET status = ?, pro_account_id = ?, state_json = ?, updated_at = ? WHERE id = ? AND status IN (${from.map(() => "?").join(",")})`)
      .bind(j.status, j.proAccountId ?? null, JSON.stringify(j), j.updatedAt, j.id, ...from).run();
    return changes(r) === 1;
  }
  async getPro(id: string) { const r = await this.db.prepare("SELECT state_json FROM pro_profiles WHERE account_id = ?").bind(id).first<Row>(); return r ? (JSON.parse(r.state_json) as ProProfile) : undefined; }
  async putPro(p: ProProfile) { await this.db.prepare("INSERT INTO pro_profiles (account_id, state_json) VALUES (?,?) ON CONFLICT(account_id) DO UPDATE SET state_json = excluded.state_json").bind(p.accountId, JSON.stringify(p)).run(); }
  async allPros() { return (await this.rows("SELECT state_json FROM pro_profiles ORDER BY rowid")).map((r) => JSON.parse(r.state_json) as ProProfile); }
  private card = (r: Row): MarketCard => ({ id: r.id, kind: r.kind, jobId: r.job_id, reason: r.reason, createdAt: Number(r.created_at), resolved: !!r.resolved, outcome: r.outcome ?? undefined });
  async putCard(c: MarketCard) { await this.db.prepare("INSERT INTO market_cards (id, kind, job_id, reason, created_at, resolved, outcome) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET reason=excluded.reason, resolved=excluded.resolved, outcome=excluded.outcome").bind(c.id, c.kind, c.jobId, c.reason, c.createdAt, c.resolved ? 1 : 0, c.outcome ?? null).run(); }
  async getCard(id: string) { const r = await this.db.prepare("SELECT * FROM market_cards WHERE id = ?").bind(id).first<Row>(); return r ? this.card(r) : undefined; }
  async openCards() { return (await this.rows("SELECT * FROM market_cards WHERE resolved = 0 ORDER BY rowid")).map(this.card); }
}
