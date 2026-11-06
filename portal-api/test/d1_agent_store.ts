// Test wiring (F58): a Store whose AGENT-DOOR methods run on D1AgentStore over a fake D1 (real SQLite, real migrations),
// and whose other methods (login, sessions, domains, purchases) stay on MemoryStore, because F13's D1Store owns those and is unmerged.
// Reads of agent data come ONLY from D1, so every assertion that reads them exercises the D1 adapter.
// Writes are mirrored into the MemoryStore maps (only after D1 accepted them) so tests that peek at
// h.store.receipts / .keys / .ledger / .creditOrders / .callLog keep working unchanged.
// accounts rows are mirrored into D1 only because api_keys/credit_ledger/agent_receipts carry foreign keys to accounts(id).
import { MemoryStore, type Account, type AgentReceipt, type ApiKey, type CreditEntry, type CreditOrder } from "../src/store.ts";
import { D1AgentStore } from "../src/agent/d1agent.ts";
import { FakeD1 } from "./fake_d1.ts";

export class D1ShadowStore extends MemoryStore {
  d1 = new FakeD1();
  agent = new D1AgentStore(this.d1);
  async putAccount(a: Account) {
    await super.putAccount(a);
    this.d1.db.prepare("INSERT INTO accounts (id, email, seat, stripe_customer_id, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, seat = excluded.seat, stripe_customer_id = excluded.stripe_customer_id, deleted_at = excluded.deleted_at")
      .run(a.id, a.email, a.seat, a.stripeCustomerId ?? null, String(a.createdAt), a.deletedAt === undefined ? null : String(a.deletedAt));
  }
  async anonymiseAccount(id: string, at: number) { await super.anonymiseAccount(id, at); await this.agent.revokeKeysFor(id, at); await this.putAccount((await this.accountById(id))!); }
  // keys
  async putKey(k: ApiKey) { await this.agent.putKey(k); await super.putKey(k); }
  async keysFor(id: string) { return this.agent.keysFor(id); }
  async keyById(id: string, accountId?: string) { return this.agent.keyById(id, accountId); }
  async keyByHash(h: string) { return this.agent.keyByHash(h); }
  async keysByPrefix(p: string, accountId?: string) { return this.agent.keysByPrefix(p, accountId); }
  // credits
  async creditBalance(id: string) { return this.agent.creditBalance(id); }
  async creditEntries(id: string) { return this.agent.creditEntries(id); }
  async creditApply(id: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) {
    const r = await this.agent.creditApply(id, delta, reason, ref, at);
    if (r !== undefined) await super.creditApply(id, delta, reason, ref, at);
    return r;
  }
  async putCreditOrder(o: CreditOrder) { await this.agent.putCreditOrder(o); await super.putCreditOrder(o); }
  async creditOrderByCheckout(c: string) { return this.agent.creditOrderByCheckout(c); }
  // receipts and calls
  async putReceipt(r: AgentReceipt) { await this.agent.putReceipt(r); await super.putReceipt(r); }
  async receiptById(id: string, accountId?: string) { return this.agent.receiptById(id, accountId); }
  async receiptByIdem(k: string, i: string, accountId?: string) { return this.agent.receiptByIdem(k, i, accountId); }
  async receiptsForKey(k: string, limit: number, accountId?: string) { return this.agent.receiptsForKey(k, limit, accountId); }
  async idemReserve(k: string, i: string, rid: string, owner: string, now: number, ttl: number) { return this.agent.idemReserve(k, i, rid, owner, now, ttl); }
  async idemRelease(k: string, i: string, owner: string) { await this.agent.idemRelease(k, i, owner); }
  async callsSince(k: string, since: number) { return this.agent.callsSince(k, since); }
  async noteCall(k: string, at: number) { await this.agent.noteCall(k, at); await super.noteCall(k, at); }
}
