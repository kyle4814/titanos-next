// D1AgentStore (F58): the D1 adapter for the agent door's persistence: api_keys, agent_receipts, credit_ledger,
// credit_orders, agent_calls, plus the F17 idempotency reservation and the F19 per-key spend cap.
// Written against migrations 0001, 0003_agent_door, 0005 and 0023_agent_d1 (was 0006). NOT applied to any live D1 (GATE5).
//
// Rules this file keeps:
//  - Every check-then-write is ONE SQL statement (conditional INSERT...SELECT, INSERT...ON CONFLICT...WHERE RETURNING).
//    Never read-then-write across two awaits. D1 serialises writes per database, so a single statement cannot interleave.
//  - Every query is parameterised. Nothing is concatenated into SQL.
//  - Tenant: account_id is the tenant. Every query that can be scoped by it is (optional trailing accountId on lookups
//    whose callers know the tenant; always on balance, entries, debits, keys-for). Only the secret-hash lookup is tenant-free,
//    because the secret IS the credential that names the tenant.
//  - Upserts use ON CONFLICT DO UPDATE, never INSERT OR REPLACE. A key row can never change tenant or hash once written.
import type { D1Like, D1Statement } from "../env.ts";
import type { AgentReceipt, ApiKey, CreditEntry, CreditOrder } from "../store.ts";

type Row = Record<string, unknown>;
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));
const n = (v: unknown) => (v === undefined ? null : v);
const toKey = (r: Row): ApiKey => ({ id: String(r.id), accountId: String(r.account_id), hash: String(r.key_hash), scopes: String(r.scopes ?? "") === "" ? [] : String(r.scopes).split(","), createdAt: Number(r.created_at), revokedAt: num(r.revoked_at) });
const toEntry = (r: Row): CreditEntry & { keyId?: string } => ({ id: String(r.id), accountId: String(r.account_id), delta: Number(r.delta), reason: String(r.reason) as CreditEntry["reason"], ref: String(r.ref), at: Number(r.at), ...(r.key_id ? { keyId: String(r.key_id) } : {}) });
const toOrder = (r: Row): CreditOrder => ({ id: String(r.id), accountId: String(r.account_id), checkoutId: String(r.checkout_id), packId: String(r.pack_id), credits: Number(r.credits), paid: Number(r.paid) === 1 });
const toReceipt = (r: Row): AgentReceipt => ({ id: String(r.id), tool: String(r.tool), keyId: String(r.key_id), accountId: String(r.account_id), at: Number(r.at), inputSha: String(r.input_sha), outputSha: String(r.output_sha), credits: Number(r.credits), mode: String(r.mode) as AgentReceipt["mode"], sig: String(r.sig), ...(r.idem === null || r.idem === undefined ? {} : { idem: String(r.idem) }), ...(r.kid ? { kid: String(r.kid) } : {}) });

export interface KeySpend { day: number; total: number }
export type CappedDebit = { ok: true; balance: number; spent: KeySpend } | { ok: false; reason: "insufficient_credits" | "key_cap_daily" | "key_cap_total" | "key_not_in_tenant" | "duplicate_ref" };
export interface DebitInput { accountId: string; keyId: string; amount: number; ref: string; at: number; dayStart: number; capDaily: number; capTotal: number }

export class D1AgentStore {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  private q(sql: string, ...args: unknown[]): D1Statement { return this.db.prepare(sql).bind(...args); }
  private async one(sql: string, ...args: unknown[]): Promise<Row | undefined> { return (await this.q(sql, ...args).first<Row>()) ?? undefined; }
  private async many(sql: string, ...args: unknown[]): Promise<Row[]> { return (await this.q(sql, ...args).all<Row>()).results; }
  private async exec(sql: string, ...args: unknown[]): Promise<number> { const r = (await this.q(sql, ...args).run()) as { meta?: { changes?: number } } | undefined; return r?.meta?.changes ?? 0; }

  // ---- api keys. The hash is written once at creation and never updated; tenant and hash are immutable on conflict.
  async putKey(k: ApiKey) {
    await this.exec(
      "INSERT INTO api_keys (id, account_id, key_hash, scopes, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET scopes = excluded.scopes, revoked_at = excluded.revoked_at WHERE api_keys.account_id = excluded.account_id",
      k.id, k.accountId, k.hash, k.scopes.join(","), k.createdAt, n(k.revokedAt));
  }
  async keysFor(accountId: string) { return (await this.many("SELECT * FROM api_keys WHERE account_id = ? ORDER BY rowid", accountId)).map(toKey); }
  async keyById(id: string, accountId?: string) { const r = accountId === undefined ? await this.one("SELECT * FROM api_keys WHERE id = ?", id) : await this.one("SELECT * FROM api_keys WHERE id = ? AND account_id = ?", id, accountId); return r && toKey(r); }
  async keyByHash(hash: string) { const r = await this.one("SELECT * FROM api_keys WHERE key_hash = ?", hash); return r && toKey(r); }
  // F48 lookup by key-id prefix. 8 chars uses the substr(id,1,8) index (migration 0005); a shorter prefix is a range scan on the primary key.
  async keysByPrefix(prefix: string, accountId?: string) {
    const scope = accountId === undefined ? "" : " AND account_id = ?";
    const tail = accountId === undefined ? [] : [accountId];
    const rows = prefix.length === 8
      ? await this.many(`SELECT * FROM api_keys WHERE substr(id, 1, 8) = ?${scope} ORDER BY rowid`, prefix, ...tail)
      : await this.many(`SELECT * FROM api_keys WHERE id >= ? AND id < ?${scope} ORDER BY rowid`, prefix, prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1), ...tail);
    return rows.map(toKey);
  }
  async revokeKeysFor(accountId: string, at: number) { await this.exec("UPDATE api_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE account_id = ?", at, accountId); }
  async setKeyCaps(accountId: string, keyId: string, capDaily: number | null, capTotal: number | null) { return (await this.exec("UPDATE api_keys SET cap_daily = ?, cap_total = ? WHERE id = ? AND account_id = ?", capDaily, capTotal, keyId, accountId)) === 1; }
  async keyCaps(accountId: string, keyId: string) { const r = await this.one("SELECT cap_daily, cap_total FROM api_keys WHERE id = ? AND account_id = ?", keyId, accountId); return r ? { capDaily: num(r.cap_daily), capTotal: num(r.cap_total) } : undefined; }

  // ---- receipts. A receipt is immutable once written (ON CONFLICT DO NOTHING).
  async putReceipt(r: AgentReceipt) {
    await this.exec("INSERT INTO agent_receipts (id, tool, key_id, account_id, at, input_sha, output_sha, credits, mode, sig, idem, kid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
      r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode, r.sig, n(r.idem), n(r.kid));
  }
  async receiptById(id: string, accountId?: string) { const r = accountId === undefined ? await this.one("SELECT * FROM agent_receipts WHERE id = ?", id) : await this.one("SELECT * FROM agent_receipts WHERE id = ? AND account_id = ?", id, accountId); return r && toReceipt(r); }
  async receiptByIdem(keyId: string, idem: string, accountId?: string) { const r = accountId === undefined ? await this.one("SELECT * FROM agent_receipts WHERE key_id = ? AND idem = ?", keyId, idem) : await this.one("SELECT * FROM agent_receipts WHERE key_id = ? AND idem = ? AND account_id = ?", keyId, idem, accountId); return r && toReceipt(r); }
  // F48 recent calls for a key, newest first (uses agent_receipts_key_at from migration 0005). rowid breaks ties so equal timestamps stay newest-written first.
  async receiptsForKey(keyId: string, limit: number, accountId?: string) {
    const lim = Math.max(0, Math.min(1000, Math.floor(limit)));
    const rows = accountId === undefined
      ? await this.many("SELECT * FROM agent_receipts WHERE key_id = ? ORDER BY at DESC, rowid DESC LIMIT ?", keyId, lim)
      : await this.many("SELECT * FROM agent_receipts WHERE key_id = ? AND account_id = ? ORDER BY at DESC, rowid DESC LIMIT ?", keyId, accountId, lim);
    return rows.map(toReceipt);
  }
  async callsSince(keyId: string, since: number) { const r = await this.one("SELECT COUNT(*) AS c FROM agent_calls WHERE key_id = ? AND at >= ?", keyId, since); return Number(r?.c ?? 0); }
  async noteCall(keyId: string, at: number) { await this.exec("INSERT INTO agent_calls (key_id, at) VALUES (?, ?)", keyId, at); }

  // ---- credit ledger (append-only; the migration's triggers refuse UPDATE and DELETE)
  async creditBalance(accountId: string) { const r = await this.one("SELECT COALESCE(SUM(delta), 0) AS bal FROM credit_ledger WHERE account_id = ?", accountId); return Number(r?.bal ?? 0); }
  async creditEntries(accountId: string) { return (await this.many("SELECT * FROM credit_ledger WHERE account_id = ? ORDER BY rowid", accountId)).map(toEntry); }
  // ATOMIC. One conditional INSERT: the row lands only if the balance after it is >= 0, and the balance comes back from the same
  // statement. No row back = refused (would go negative, or this (reason, ref) already exists, so a replay grants nothing).
  async creditApply(accountId: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number, keyId?: string) {
    const id = `ent_${crypto.randomUUID().replace(/-/g, "")}`;
    const r = await this.one(
      "INSERT INTO credit_ledger (id, account_id, key_id, delta, reason, ref, at) SELECT ?1, ?2, ?7, ?3, ?4, ?5, ?6 WHERE (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2) + ?3 >= 0 AND (?7 IS NULL OR EXISTS (SELECT 1 FROM api_keys WHERE id = ?7 AND account_id = ?2)) ON CONFLICT(reason, ref) DO NOTHING RETURNING (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2) AS bal",
      id, accountId, delta, reason, ref, at, n(keyId));
    return r ? Number(r.bal) : undefined;
  }
  // F19 spend cap. Balance, the per-key daily cap, the per-key total cap and the ledger write are ONE statement. A cap of N
  // allows spend up to and including N. Spend = -SUM(delta) over the key's own rows (reversals carrying the key give it back).
  // The key must belong to the tenant (EXISTS), so a debit can never be booked against another account's key.
  async creditDebitCapped(o: DebitInput): Promise<CappedDebit> {
    const id = `ent_${crypto.randomUUID().replace(/-/g, "")}`;
    const r = await this.one(
      `INSERT INTO credit_ledger (id, account_id, key_id, delta, reason, ref, at)
       SELECT ?1, ?2, ?3, -?4, 'debit', ?5, ?6
       WHERE EXISTS (SELECT 1 FROM api_keys WHERE id = ?3 AND account_id = ?2)
         AND (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2) - ?4 >= 0
         AND (SELECT COALESCE(-SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2 AND key_id = ?3 AND at >= ?7) + ?4 <= ?8
         AND (SELECT COALESCE(-SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2 AND key_id = ?3) + ?4 <= ?9
       ON CONFLICT(reason, ref) DO NOTHING
       RETURNING (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2) AS bal,
                 (SELECT COALESCE(-SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2 AND key_id = ?3 AND at >= ?7) AS day,
                 (SELECT COALESCE(-SUM(delta), 0) FROM credit_ledger WHERE account_id = ?2 AND key_id = ?3) AS total`,
      id, o.accountId, o.keyId, o.amount, o.ref, o.at, o.dayStart, o.capDaily, o.capTotal);
    if (r) return { ok: true, balance: Number(r.bal), spent: { day: Number(r.day), total: Number(r.total) } };
    // Refused: say why. Read-only diagnosis after the atomic decision; it can only explain, never change the outcome.
    if (!(await this.keyById(o.keyId, o.accountId))) return { ok: false, reason: "key_not_in_tenant" };
    if (await this.one("SELECT 1 AS x FROM credit_ledger WHERE reason = 'debit' AND ref = ?", o.ref)) return { ok: false, reason: "duplicate_ref" };
    const sp = await this.keySpend(o.keyId, o.dayStart, o.accountId);
    if (sp.day + o.amount > o.capDaily) return { ok: false, reason: "key_cap_daily" };
    if (sp.total + o.amount > o.capTotal) return { ok: false, reason: "key_cap_total" };
    return { ok: false, reason: "insufficient_credits" };
  }
  async keySpend(keyId: string, dayStart: number, accountId?: string): Promise<KeySpend> {
    const scope = accountId === undefined ? "" : " AND account_id = ?";
    const tail = accountId === undefined ? [] : [accountId];
    const r = await this.one(`SELECT COALESCE(-SUM(delta), 0) AS total, COALESCE(-SUM(CASE WHEN at >= ? THEN delta ELSE 0 END), 0) AS day FROM credit_ledger WHERE key_id = ?${scope}`, dayStart, keyId, ...tail);
    return { day: Number(r?.day ?? 0), total: Number(r?.total ?? 0) };
  }

  // ---- credit orders (top-up checkouts)
  async putCreditOrder(o: CreditOrder) {
    await this.exec("INSERT INTO credit_orders (id, account_id, checkout_id, pack_id, credits, paid) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET paid = excluded.paid WHERE credit_orders.account_id = excluded.account_id", o.id, o.accountId, o.checkoutId, o.packId, o.credits, o.paid ? 1 : 0);
  }
  async creditOrderByCheckout(checkoutId: string) { const r = await this.one("SELECT * FROM credit_orders WHERE checkout_id = ?", checkoutId); return r && toOrder(r); }

  // ---- F17 idempotency reservation: insert-first, ONE statement. The first caller for (key, idem) wins; a live claim is never
  // stolen; an expired claim is taken over and KEEPS its original rid (a crashed owner's debit is found, not repeated).
  async idemReserve(keyId: string, idem: string, rid: string, owner: string, now: number, ttlMs: number): Promise<{ won: boolean; rid: string }> {
    const r = await this.one(
      "INSERT INTO idem_reservations (key_id, idem, rid, owner, expires_at) VALUES (?1, ?2, ?3, ?4, ?5 + ?6) ON CONFLICT(key_id, idem) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE idem_reservations.expires_at <= ?5 RETURNING rid",
      keyId, idem, rid, owner, now, ttlMs);
    if (r) return { won: true, rid: String(r.rid) };
    const cur = await this.one("SELECT rid FROM idem_reservations WHERE key_id = ? AND idem = ?", keyId, idem);
    return { won: false, rid: cur ? String(cur.rid) : rid };
  }
  async idemRelease(keyId: string, idem: string, owner: string) { await this.exec("DELETE FROM idem_reservations WHERE key_id = ? AND idem = ? AND owner = ?", keyId, idem, owner); }
}
