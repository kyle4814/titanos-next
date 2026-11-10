// C8 f59: D1 adapter for the payout half of EntStore. NOT wired to any binding (nothing builds it from env yet).
// Payout methods hit D1; tenant and ledger reads the payout passes need are delegated to `rest` (the other D1 adapters, or
// the in-memory store in tests). Every payout write is one statement; transitionPayout is ONE compare-and-set UPDATE so two
// ticks (or a tick and an operator) cannot both claim a row. Needs migrations/0004.
import type { EntStore } from "./store.ts";
import type { LedgerEntry, Payout } from "./types.ts";

// The slice of Cloudflare D1 this adapter uses (a real D1Database satisfies it structurally).
export interface D1Stmt { bind(...v: unknown[]): D1Stmt; run(): Promise<{ meta: { changes?: number } }>; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export interface D1Like { prepare(sql: string): D1Stmt }

const COLS = { id: "id", partnerId: "partner_id", amountCents: "amount_cents", status: "status", createdAt: "created_at", providerRef: "provider_ref", reason: "reason", sendingAt: "sending_at", attempts: "attempts", heldAt: "held_at", releasedAt: "released_at", tickAt: "tick_at", refundedAt: "refunded_at", operatorNote: "operator_note" } as const;
type Key = keyof typeof COLS;
const KEYS = Object.keys(COLS) as Key[];
// A transition patch may only touch lifecycle fields: never id, partner, amount or created_at (a patch must not move money between partners).
const PATCHABLE: Key[] = ["providerRef", "reason", "sendingAt", "attempts", "heldAt", "releasedAt", "tickAt", "refundedAt", "operatorNote"];

function fromRow(r: Record<string, unknown>): Payout {
  const p: Record<string, unknown> = {};
  for (const k of KEYS) { const v = r[COLS[k]]; if (v !== null && v !== undefined) p[k] = v; }
  return p as unknown as Payout;
}

export class D1EntStore {
  db: D1Like; rest: EntStore;
  constructor(db: D1Like, rest: EntStore) { this.db = db; this.rest = rest; }

  // delegated (tenant and ledger reads, ledger reversal writes)
  tenantById(id: string) { return this.rest.tenantById(id); }
  addLedger(e: LedgerEntry) { return this.rest.addLedger(e); }
  ledgerOf(p: string) { return this.rest.ledgerOf(p); }

  async reservePayout(): Promise<never> { throw new Error("d1_reserve_payout_not_implemented"); } // needs the ledger in D1 too: separate chunk

  async putPayout(p: Payout): Promise<void> {
    const cols = KEYS.map((k) => COLS[k]);
    const set = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
    await this.db.prepare(`INSERT INTO payouts (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) ON CONFLICT(id) DO UPDATE SET ${set}`)
      .bind(...KEYS.map((k) => (p as unknown as Record<string, unknown>)[k] ?? null)).run();
  }

  // ONE UPDATE ... WHERE id = ? AND status = ? : the database decides the winner; 0 rows changed = lost the race / wrong state.
  async transitionPayout(id: string, from: Payout["status"], to: Payout["status"], patch?: Partial<Payout>): Promise<Payout | undefined> {
    const sets = ["status = ?"], vals: unknown[] = [to];
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (k === "status") continue; // the target status is `to`, as in the in-memory store the last write would be the patch, but callers never pass it
      if (!(PATCHABLE as string[]).includes(k)) throw new Error(`d1_patch_unknown_column:${k}`);
      sets.push(`${COLS[k as Key]} = ?`); vals.push(v ?? null);
    }
    const r = await this.db.prepare(`UPDATE payouts SET ${sets.join(", ")} WHERE id = ? AND status = ?`).bind(...vals, id, from).run();
    if (!r.meta.changes) return undefined;
    return this.payoutById(id);
  }

  async payoutById(id: string) { const r = await this.db.prepare("SELECT * FROM payouts WHERE id = ?").bind(id).first(); return r ? fromRow(r) : undefined; }
  async payoutsOf(partnerId: string) { return (await this.db.prepare("SELECT * FROM payouts WHERE partner_id = ? ORDER BY rowid").bind(partnerId).all()).results.map(fromRow); }
  async payoutsByStatus(status: Payout["status"], partnerId?: string) {
    const q = partnerId === undefined ? this.db.prepare("SELECT * FROM payouts WHERE status = ? ORDER BY rowid").bind(status) : this.db.prepare("SELECT * FROM payouts WHERE status = ? AND partner_id = ? ORDER BY rowid").bind(status, partnerId);
    return (await q.all()).results.map(fromRow);
  }
}
