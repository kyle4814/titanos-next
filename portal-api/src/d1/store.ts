// D1Store: the portal Store over Cloudflare D1 (migrations 0001, 0002_portal_billing, 0003_agent_door, 0003_enterprise,
// 0003_refund_cases, 0006_d1_wire). NOT DEPLOYED. Rules: every value is a BOUND argument; every account-scoped read carries the
// account id; the three races (credit balance, webhook idempotency, invoice numbers) are ONE statement each, never read-then-write.
// 0001 declared created_at/deleted_at/verified_at/revoked_at as TEXT: SQLite stores the bound integer as text, so reads go through num().
import type { D1Like } from "../env.ts";
import type { Account, AgentReceipt, ApiKey, CreditEntry, CreditOrder, DomainRow, Invoice, LoginToken, Purchase, RefundCase, ReviewCard, Session, Store, Subscription } from "../store.ts";

export type Batchable = D1Like & { batch?: (s: unknown[]) => Promise<unknown> };
const num = (v: unknown): number | undefined => (v === null || v === undefined || v === "" ? undefined : Number(v));
const changes = (r: unknown) => Number((r as { meta?: { changes?: number } })?.meta?.changes ?? 0);
type Row = Record<string, any>;

export class D1Store implements Store {
  db: Batchable;
  constructor(db: D1Like) { this.db = db as Batchable; }
  private one(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).first<Row>(); }
  private many(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).all<Row>().then((r) => r.results); }
  private run(sql: string, ...a: unknown[]) { return this.db.prepare(sql).bind(...a).run(); }
  // Several statements, all or nothing when the binding offers batch (D1 and the local stand-in both do).
  private async tx(stmts: [string, unknown[]][]) {
    const ps = stmts.map(([s, a]) => this.db.prepare(s).bind(...a));
    if (this.db.batch) await this.db.batch(ps); else for (const p of ps) await p.run();
  }

  // ---- accounts, login, sessions
  acct = (r: Row | null): Account | undefined => r ? { id: r.id, email: r.email, seat: r.seat, stripeCustomerId: r.stripe_customer_id ?? undefined, createdAt: num(r.created_at)!, deletedAt: num(r.deleted_at) } : undefined;
  async accountByEmail(e: string) { return this.acct(await this.one("SELECT * FROM accounts WHERE email = ?", e)); }
  async accountById(id: string) { return this.acct(await this.one("SELECT * FROM accounts WHERE id = ?", id)); }
  async putAccount(a: Account) {
    await this.run("INSERT INTO accounts (id, email, seat, stripe_customer_id, created_at, deleted_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, seat=excluded.seat, stripe_customer_id=excluded.stripe_customer_id, deleted_at=excluded.deleted_at",
      a.id, a.email, a.seat, a.stripeCustomerId ?? null, a.createdAt, a.deletedAt ?? null);
  }
  async putLoginToken(t: LoginToken) { await this.run("INSERT INTO login_tokens (hash, email, expires_at, used) VALUES (?,?,?,?) ON CONFLICT(hash) DO UPDATE SET email=excluded.email, expires_at=excluded.expires_at, used=excluded.used", t.hash, t.email, t.expiresAt, t.used ? 1 : 0); }
  // Single-use: the flip to used=1 is the claim. Two racing callers: exactly one sees changes = 1.
  async consumeLoginToken(hash: string, now: number): Promise<LoginToken | undefined> {
    const r = await this.run("UPDATE login_tokens SET used = 1 WHERE hash = ? AND used = 0 AND expires_at >= ?", hash, now);
    if (changes(r) !== 1) return undefined;
    const row = await this.one("SELECT * FROM login_tokens WHERE hash = ?", hash);
    return row ? { hash: row.hash, email: row.email, expiresAt: Number(row.expires_at), used: true } : undefined;
  }
  async loginRequestsSince(email: string, since: number) { return Number((await this.one("SELECT COUNT(*) AS n FROM login_requests WHERE email = ? AND at >= ?", email, since))?.n ?? 0); }
  async noteLoginRequest(email: string, at: number) { await this.run("INSERT INTO login_requests (email, at) VALUES (?,?)", email, at); }
  async putSession(s: Session) { await this.run("INSERT INTO sessions (hash, account_id, expires_at) VALUES (?,?,?) ON CONFLICT(hash) DO UPDATE SET expires_at=excluded.expires_at WHERE sessions.account_id = excluded.account_id", s.hash, s.accountId, s.expiresAt); }
  async sessionByHash(hash: string, now: number) { const r = await this.one("SELECT * FROM sessions WHERE hash = ? AND expires_at > ?", hash, now); return r ? { hash: r.hash, accountId: r.account_id, expiresAt: Number(r.expires_at) } : undefined; }
  async deleteSessionsFor(id: string) { await this.run("DELETE FROM sessions WHERE account_id = ?", id); }

  // ---- domains
  dom = (r: Row): DomainRow => ({ id: r.id, accountId: r.account_id, domain: r.domain, token: r.verify_token, verifiedAt: num(r.verified_at) });
  async domainsFor(id: string) { return (await this.many("SELECT * FROM domains WHERE account_id = ? ORDER BY rowid", id)).map(this.dom); }
  async domainById(id: string) { const r = await this.one("SELECT * FROM domains WHERE id = ?", id); return r ? this.dom(r) : undefined; }
  async verifiedOwnerOf(domain: string) { const r = await this.one("SELECT * FROM domains WHERE domain = ? AND verified_at IS NOT NULL ORDER BY rowid LIMIT 1", domain); return r ? this.dom(r) : undefined; }
  async putDomain(d: DomainRow) { await this.run("INSERT INTO domains (id, account_id, domain, verify_token, verified_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET verify_token=excluded.verify_token, verified_at=excluded.verified_at WHERE domains.account_id = excluded.account_id", d.id, d.accountId, d.domain, d.token, d.verifiedAt ?? null); }

  // ---- purchases, subscriptions, invoices
  pur = (r: Row): Purchase => ({ id: r.id, accountId: r.account_id, productId: r.product_id, domain: r.domain ?? undefined, checkoutId: r.checkout_id, paymentIntent: r.payment_intent ?? undefined, subscriptionId: r.subscription_id ?? undefined, paidAt: num(r.paid_at), amountCents: Number(r.amount_cents), deliverableIssued: !!r.deliverable_issued, refundedCents: Number(r.refunded_cents), status: r.status });
  async putPurchase(p: Purchase) {
    await this.run("INSERT INTO purchases (id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET domain=excluded.domain, payment_intent=excluded.payment_intent, subscription_id=excluded.subscription_id, paid_at=excluded.paid_at, amount_cents=excluded.amount_cents, deliverable_issued=excluded.deliverable_issued, refunded_cents=excluded.refunded_cents, status=excluded.status WHERE purchases.account_id = excluded.account_id",
      p.id, p.accountId, p.productId, p.domain ?? null, p.checkoutId, p.paymentIntent ?? null, p.subscriptionId ?? null, p.paidAt ?? null, p.amountCents, p.deliverableIssued ? 1 : 0, p.refundedCents, p.status);
  }
  async purchaseById(id: string) { const r = await this.one("SELECT * FROM purchases WHERE id = ?", id); return r ? this.pur(r) : undefined; }
  async purchaseByCheckout(c: string) { const r = await this.one("SELECT * FROM purchases WHERE checkout_id = ?", c); return r ? this.pur(r) : undefined; }
  async purchasesFor(id: string) { return (await this.many("SELECT * FROM purchases WHERE account_id = ? ORDER BY rowid", id)).map(this.pur); }
  sub = (r: Row): Subscription => ({ id: r.id, accountId: r.account_id, purchaseId: r.purchase_id, productId: r.product_id, startedAt: Number(r.started_at), cancelAt: num(r.cancel_at), cancelledAt: num(r.cancelled_at) });
  async putSubscription(s: Subscription) { await this.run("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at, cancel_at, cancelled_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET cancel_at=excluded.cancel_at, cancelled_at=excluded.cancelled_at WHERE subscriptions.account_id = excluded.account_id", s.id, s.accountId, s.purchaseId, s.productId, s.startedAt, s.cancelAt ?? null, s.cancelledAt ?? null); }
  async subscriptionById(id: string) { const r = await this.one("SELECT * FROM subscriptions WHERE id = ?", id); return r ? this.sub(r) : undefined; }
  async subscriptionsFor(id: string) { return (await this.many("SELECT * FROM subscriptions WHERE account_id = ? ORDER BY rowid", id)).map(this.sub); }
  inv = (r: Row): Invoice => ({ id: r.id, accountId: r.account_id, purchaseId: r.purchase_id ?? undefined, number: r.number, productId: r.product_id, amountCents: Number(r.amount_cents), issuedAt: Number(r.issued_at), stripeEventId: r.stripe_event_id });
  async putInvoice(i: Invoice) { await this.run("INSERT INTO invoices (id, account_id, number, product_id, amount_cents, issued_at, stripe_event_id, purchase_id) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", i.id, i.accountId, i.number, i.productId, i.amountCents, i.issuedAt, i.stripeEventId, i.purchaseId ?? null); }
  async invoicesFor(id: string) { return (await this.many("SELECT * FROM invoices WHERE account_id = ? ORDER BY rowid", id)).map(this.inv); }
  async invoiceById(id: string) { const r = await this.one("SELECT * FROM invoices WHERE id = ?", id); return r ? this.inv(r) : undefined; }
  // Gapless-enough, race-proof: one upsert-with-RETURNING on a counter row.
  async nextInvoiceNumber() {
    const r = await this.one("INSERT INTO counter_buckets (name, bucket, n) VALUES ('invoice_seq', 0, 1) ON CONFLICT(name, bucket) DO UPDATE SET n = n + 1 RETURNING n");
    return `TT-${String(Number(r!.n)).padStart(6, "0")}`;
  }
  // Webhook idempotency: the PRIMARY KEY is the claim. true the first time only.
  async claimEvent(id: string) { return changes(await this.run("INSERT INTO stripe_events (id, at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING", id, Date.now())) === 1; }

  // ---- review cards and refund cases
  card = (r: Row): ReviewCard => ({ id: r.id, accountId: r.account_id, purchaseId: r.purchase_id, kind: r.kind, reason: r.reason, createdAt: Number(r.created_at), resolved: !!r.resolved });
  async putCard(c: ReviewCard) { await this.run("INSERT INTO review_cards (id, account_id, purchase_id, kind, reason, created_at, resolved) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET reason=excluded.reason, resolved=excluded.resolved", c.id, c.accountId, c.purchaseId, c.kind, c.reason, c.createdAt, c.resolved ? 1 : 0); }
  async cardById(id: string) { const r = await this.one("SELECT * FROM review_cards WHERE id = ?", id); return r ? this.card(r) : undefined; }
  async allCards() { return (await this.many("SELECT * FROM review_cards ORDER BY rowid")).map(this.card); }
  async openCards() { return (await this.many("SELECT * FROM review_cards WHERE resolved = 0 ORDER BY rowid")).map(this.card); }
  rc = (r: Row): RefundCase => ({ id: r.id, accountId: r.account_id, purchaseId: r.purchase_id, productName: r.product_name, amountCents: Number(r.amount_cents), reason: r.reason, inPolicy: !!r.in_policy, status: r.status, createdAt: Number(r.created_at), decidedAt: num(r.decided_at) });
  async putRefundCase(c: RefundCase) { await this.run("INSERT INTO refund_cases (id, account_id, purchase_id, product_name, amount_cents, reason, in_policy, status, created_at, decided_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, decided_at=excluded.decided_at, reason=excluded.reason", c.id, c.accountId, c.purchaseId, c.productName, c.amountCents, c.reason, c.inPolicy ? 1 : 0, c.status, c.createdAt, c.decidedAt ?? null); }
  async refundCaseById(id: string) { const r = await this.one("SELECT * FROM refund_cases WHERE id = ?", id); return r ? this.rc(r) : undefined; }
  async refundCasesFor(purchaseId: string) { return (await this.many("SELECT * FROM refund_cases WHERE purchase_id = ? ORDER BY rowid", purchaseId)).map(this.rc); }

  // ---- API keys (hash only)
  key = (r: Row): ApiKey => ({ id: r.id, accountId: r.account_id, hash: r.key_hash, scopes: r.scopes ? String(r.scopes).split(",") : [], createdAt: num(r.created_at)!, revokedAt: num(r.revoked_at) });
  async putKey(k: ApiKey) { await this.run("INSERT INTO api_keys (id, account_id, key_hash, scopes, created_at, revoked_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revoked_at=excluded.revoked_at WHERE api_keys.account_id = excluded.account_id", k.id, k.accountId, k.hash, k.scopes.join(","), k.createdAt, k.revokedAt ?? null); }
  async keyByHash(h: string) { const r = await this.one("SELECT * FROM api_keys WHERE key_hash = ?", h); return r ? this.key(r) : undefined; }
  async keysFor(id: string) { return (await this.many("SELECT * FROM api_keys WHERE account_id = ? ORDER BY rowid", id)).map(this.key); }
  async keyById(id: string) { const r = await this.one("SELECT * FROM api_keys WHERE id = ?", id); return r ? this.key(r) : undefined; }

  // ---- agent door: credits, receipts, call log
  async creditBalance(id: string) { return Number((await this.one("SELECT COALESCE(SUM(delta), 0) AS b FROM credit_ledger WHERE account_id = ?", id))?.b ?? 0); }
  // ONE statement: the insert only happens while balance + delta >= 0. UNIQUE (reason, ref) makes a replayed top-up or reversal a no-op.
  async creditApply(accountId: string, delta: number, reason: CreditEntry["reason"], ref: string, at: number) {
    const id = `ent_${crypto.randomUUID()}`;
    const r = await this.run("INSERT INTO credit_ledger (id, account_id, delta, reason, ref, at) SELECT ?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE account_id = ?) + ? >= 0 ON CONFLICT DO NOTHING",
      id, accountId, delta, reason, ref, at, accountId, delta);
    const bal = await this.creditBalance(accountId);
    if (changes(r) === 1) return bal;
    return bal + delta < 0 ? undefined : bal;   // 0 changes and enough funds = a replay of the same (reason, ref): report the balance, move nothing
  }
  async creditEntries(id: string): Promise<CreditEntry[]> { return (await this.many("SELECT * FROM credit_ledger WHERE account_id = ? ORDER BY rowid", id)).map((r) => ({ id: r.id, accountId: r.account_id, delta: Number(r.delta), reason: r.reason, ref: r.ref, at: Number(r.at) })); }
  async putCreditOrder(o: CreditOrder) { await this.run("INSERT INTO credit_orders (id, account_id, checkout_id, pack_id, credits, paid) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET paid=excluded.paid WHERE credit_orders.account_id = excluded.account_id", o.id, o.accountId, o.checkoutId, o.packId, o.credits, o.paid ? 1 : 0); }
  async creditOrderByCheckout(c: string): Promise<CreditOrder | undefined> { const r = await this.one("SELECT * FROM credit_orders WHERE checkout_id = ?", c); return r ? { id: r.id, accountId: r.account_id, checkoutId: r.checkout_id, packId: r.pack_id, credits: Number(r.credits), paid: !!r.paid } : undefined; }
  rcp = (r: Row): AgentReceipt => ({ id: r.id, tool: r.tool, keyId: r.key_id, accountId: r.account_id, at: Number(r.at), inputSha: r.input_sha, outputSha: r.output_sha, credits: Number(r.credits), mode: r.mode, sig: r.sig, ...(r.idem != null ? { idem: r.idem } : {}) });
  async putReceipt(r: AgentReceipt) { await this.run("INSERT INTO agent_receipts (id, tool, key_id, account_id, at, input_sha, output_sha, credits, mode, sig, idem) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING", r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode, r.sig, r.idem ?? null); }
  async receiptById(id: string) { const r = await this.one("SELECT * FROM agent_receipts WHERE id = ?", id); return r ? this.rcp(r) : undefined; }
  async receiptByIdem(keyId: string, idem: string) { const r = await this.one("SELECT * FROM agent_receipts WHERE key_id = ? AND idem = ?", keyId, idem); return r ? this.rcp(r) : undefined; }
  async callsSince(k: string, since: number) { return Number((await this.one("SELECT COUNT(*) AS n FROM agent_calls WHERE key_id = ? AND at >= ?", k, since))?.n ?? 0); }
  async noteCall(k: string, at: number) { await this.run("INSERT INTO agent_calls (key_id, at) VALUES (?,?)", k, at); }

  // ---- account deletion: PII goes, financial records stay (tax law), tied to an opaque id only.
  async anonymiseAccount(id: string, at: number) {
    await this.tx([
      ["UPDATE accounts SET email = ?, stripe_customer_id = NULL, deleted_at = ? WHERE id = ?", [`deleted+${id}@deleted.invalid`, at, id]],
      ["DELETE FROM owner_state WHERE account_id = ?", [id]],
      // a domain a settled market job still points at cannot be dropped (FK): it is blanked instead
      ["DELETE FROM domains WHERE account_id = ? AND NOT EXISTS (SELECT 1 FROM market_jobs WHERE market_jobs.domain_id = domains.id)", [id]],
      ["UPDATE domains SET domain = 'deleted-' || id || '.invalid', verify_token = '', verified_at = NULL WHERE account_id = ?", [id]],
      ["UPDATE api_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE account_id = ?", [at, id]],
      ["DELETE FROM sessions WHERE account_id = ?", [id]],
    ]);
  }
}
