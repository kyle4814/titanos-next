// D1OwnerStore (F15): the OwnerStore over D1, table owner_state (migration 0003_owner_seat + 0005_owner_d1).
// Rules: account_id is a BOUND ARGUMENT in every account-scoped statement; no INSERT OR REPLACE (upserts are
// ON CONFLICT ... DO UPDATE ... WHERE account_id matches, so a put can never overwrite another account's row);
// domain claim and monitor-subscription writes are idempotent; the due query rides idx_owner_state_due2.
import type { D1Like } from "../env.ts";
import type { DomainState, OwnerStore } from "./engine.ts";

export class OwnerStoreError extends Error {}
// The account-scoped surface. The base OwnerStore (get/put/all by domain) stays for the engine and the cron.
export interface ScopedOwnerStore extends OwnerStore {
  getFor(accountId: string, domainId: string): Promise<DomainState | undefined>;
  allFor(accountId: string): Promise<DomainState[]>;
  due(now: number, limit: number): Promise<DomainState[]>;
  claimDomain(s: DomainState): Promise<"created" | "exists" | "conflict">;
  setMonitorSub(accountId: string, domainId: string, active: boolean, now: number, intervalMs?: number): Promise<"changed" | "unchanged" | "missing">;
  anonymise(accountId: string): Promise<number>;
}
type Batchable = D1Like & { batch?: (s: unknown[]) => Promise<unknown> };
const changes = (r: unknown) => Number((r as { meta?: { changes?: number } })?.meta?.changes ?? 0);
const nextAt = (s: DomainState) => (s.monitor.active && s.monitor.nextScanAt !== undefined ? s.monitor.nextScanAt : null);

export class D1OwnerStore implements ScopedOwnerStore {
  db: Batchable; clock: () => number;
  constructor(db: D1Like, clock: () => number = Date.now) { this.db = db as Batchable; this.clock = clock; }
  private parse(row: { state_json: string } | null | undefined): DomainState | undefined { return row ? (JSON.parse(row.state_json) as DomainState) : undefined; }

  // Unscoped by design: the engine and the scheduled handler address a row by its domain id after the service has
  // already proven ownership (service.ts mine()). Every user-facing read should prefer getFor/allFor.
  async get(domainId: string) { return this.parse(await this.db.prepare("SELECT state_json FROM owner_state WHERE domain_id = ?").bind(domainId).first<{ state_json: string }>()); }
  async all() { return (await this.db.prepare("SELECT state_json FROM owner_state ORDER BY domain_id").all<{ state_json: string }>()).results.map((r) => JSON.parse(r.state_json) as DomainState); }
  async getFor(accountId: string, domainId: string) { return this.parse(await this.db.prepare("SELECT state_json FROM owner_state WHERE account_id = ? AND domain_id = ?").bind(accountId, domainId).first<{ state_json: string }>()); }
  async allFor(accountId: string) { return (await this.db.prepare("SELECT state_json FROM owner_state WHERE account_id = ? ORDER BY domain_id").bind(accountId).all<{ state_json: string }>()).results.map((r) => JSON.parse(r.state_json) as DomainState); }

  // Upsert. The DO UPDATE only fires when the stored row belongs to the same account; otherwise 0 rows change and we refuse.
  async put(s: DomainState) {
    const r = await this.db.prepare(
      "INSERT INTO owner_state (domain_id, account_id, state_json, next_scan_at, updated_at) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(domain_id) DO UPDATE SET state_json = excluded.state_json, next_scan_at = excluded.next_scan_at, updated_at = excluded.updated_at " +
      "WHERE owner_state.account_id = excluded.account_id").bind(s.domainId, s.accountId, JSON.stringify(s), nextAt(s), this.clock()).run();
    if (changes(r) !== 1) throw new OwnerStoreError("owner_state_account_mismatch");
  }

  // Due selection: monitor on (column non-NULL), due now, longest overdue first, bounded. Index range scan.
  async due(now: number, limit: number) {
    const lim = Math.max(0, Math.floor(limit));
    return (await this.db.prepare("SELECT state_json FROM owner_state WHERE next_scan_at IS NOT NULL AND next_scan_at <= ? ORDER BY next_scan_at, domain_id LIMIT ?").bind(now, lim).all<{ state_json: string }>()).results.map((r) => JSON.parse(r.state_json) as DomainState);
  }

  // Idempotent claim: a second claim of the same (account, domain id) changes nothing; another account's claim is refused.
  async claimDomain(s: DomainState) {
    const r = await this.db.prepare("INSERT INTO owner_state (domain_id, account_id, state_json, next_scan_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(domain_id) DO NOTHING")
      .bind(s.domainId, s.accountId, JSON.stringify(s), nextAt(s), this.clock()).run();
    if (changes(r) === 1) return "created";
    return (await this.getFor(s.accountId, s.domainId)) ? "exists" : "conflict";
  }

  // Idempotent monitor switch. Only a real flip writes; repeating it (a replayed webhook) does not push next_scan_at back.
  async setMonitorSub(accountId: string, domainId: string, active: boolean, now: number, intervalMs?: number) {
    const cur = await this.getFor(accountId, domainId);
    if (!cur) return "missing";
    if (cur.monitor.active === active) return "unchanged";
    const m = { active, intervalMs: intervalMs ?? cur.monitor.intervalMs, nextScanAt: active ? now : undefined };
    // Compare-and-set on the stored flag so two racing flips cannot both claim "changed".
    const r = await this.db.prepare(
      "UPDATE owner_state SET state_json = json_set(state_json, '$.monitor', json(?)), next_scan_at = ?, updated_at = ? " +
      "WHERE account_id = ? AND domain_id = ? AND (json_extract(state_json, '$.monitor.active') = 1) = ?")
      .bind(JSON.stringify(m), active ? now : null, this.clock(), accountId, domainId, active ? 0 : 1).run();
    return changes(r) === 1 ? "changed" : "unchanged";
  }

  // Erasure: every owner row for the account goes (findings, fixes and events name the domain). Returns rows removed.
  async anonymise(accountId: string) { return changes(await this.db.prepare("DELETE FROM owner_state WHERE account_id = ?").bind(accountId).run()); }
}
