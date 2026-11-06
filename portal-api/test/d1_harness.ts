// PORTAL_STORE=d1 points the existing suites at the D1 adapters: real SQLite (node:sqlite) with EVERY migration applied and foreign
// keys ON. The test views below read the same database synchronously so assertions written against MemoryStore's maps still run.
import { FakeD1 } from "./owner_fake_d1.ts";
import { D1Store } from "../src/d1/store.ts";
import { D1MarketStore } from "../src/market/d1store.ts";
import { D1EntStore } from "../src/enterprise/d1store.ts";
import { newSealKey } from "../src/enterprise/seal.ts";

export const USE_D1 = process.env.PORTAL_STORE === "d1";
export const SEAL_RING = { current: "k1", keys: { k1: newSealKey() } };
const rows = (d: FakeD1, sql: string) => d.db.prepare(sql).all() as Record<string, any>[];
const mapBy = <T>(xs: T[], key: (x: T) => string) => { const m = new Map<string, T>(); for (const x of xs) m.set(key(x), x); return m; };

export class D1TestStore extends D1Store {
  fake: FakeD1;
  constructor(fake: FakeD1) { super(fake); this.fake = fake; }
  get accounts() { return mapBy(rows(this.fake, "SELECT * FROM accounts ORDER BY rowid").map((r) => this.acct(r)!), (x) => x.id); }
  get loginTokens() { return mapBy(rows(this.fake, "SELECT * FROM login_tokens ORDER BY rowid"), (r) => r.hash as string); }
  get sessions() { return mapBy(rows(this.fake, "SELECT * FROM sessions ORDER BY rowid"), (r) => r.hash as string); }
  get domains() { return mapBy(rows(this.fake, "SELECT * FROM domains ORDER BY rowid").map(this.dom), (x) => x.id); }
  get purchases() { return mapBy(rows(this.fake, "SELECT * FROM purchases ORDER BY rowid").map(this.pur), (x) => x.id); }
  get subs() { return mapBy(rows(this.fake, "SELECT * FROM subscriptions ORDER BY rowid").map(this.sub), (x) => x.id); }
  get invoices() { return mapBy(rows(this.fake, "SELECT * FROM invoices ORDER BY rowid").map(this.inv), (x) => x.id); }
  get cards() { return mapBy(rows(this.fake, "SELECT * FROM review_cards ORDER BY rowid").map(this.card), (x) => x.id); }
  get refundCases() { return mapBy(rows(this.fake, "SELECT * FROM refund_cases ORDER BY rowid").map(this.rc), (x) => x.id); }
  get keys() { return mapBy(rows(this.fake, "SELECT * FROM api_keys ORDER BY rowid").map(this.key), (x) => x.id); }
  get receipts() { return mapBy(rows(this.fake, "SELECT * FROM agent_receipts ORDER BY rowid").map(this.rcp), (x) => x.id); }
  get creditOrders() { return mapBy(rows(this.fake, "SELECT * FROM credit_orders ORDER BY rowid").map((r) => ({ id: r.id as string, accountId: r.account_id as string, checkoutId: r.checkout_id as string, packId: r.pack_id as string, credits: Number(r.credits), paid: !!r.paid })), (x) => x.id); }
  get ledger() { return rows(this.fake, "SELECT * FROM credit_ledger ORDER BY rowid"); }
  get callLog() { return rows(this.fake, "SELECT * FROM agent_calls ORDER BY rowid"); }
}
export class D1TestEntStore extends D1EntStore {
  fake: FakeD1;
  constructor(fake: FakeD1) { super(fake, SEAL_RING); this.fake = fake; }
  get tenants() { return mapBy(rows(this.fake, "SELECT * FROM tenants ORDER BY rowid").map(this.tenant), (x) => x.id); }
  get states() { return mapBy(rows(this.fake, "SELECT * FROM sso_states ORDER BY rowid"), (r) => r.hash as string); }
  get assets() { return mapBy(rows(this.fake, "SELECT * FROM tenant_assets ORDER BY rowid").map(this.asset), (x) => x.id); }
}
export const newDb = () => new FakeD1(true);
export { D1MarketStore };
