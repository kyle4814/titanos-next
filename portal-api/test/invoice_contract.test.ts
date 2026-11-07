import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MemoryStore, type Invoice, type Store } from "../src/store.ts";
import { D1PlanStore } from "../src/d1_plan_store.ts";
import { FakeD1 } from "./fake_d1.ts";
import { make, STORE_KINDS, T0 } from "./harness.ts";

// C2 invoices on D1 (f192). ONE contract, run over MemoryStore (the reference) and D1PlanStore (FakeD1: real SQLite, real migrations, FK on).
// SYNTHETIC labelled fixtures only (example.invalid). A "restart" is a NEW store object over the SAME FakeD1.
type Factory = () => { open: () => Store };
const memory: Factory = () => { const s = new MemoryStore(); return { open: () => s }; };
const d1: Factory = () => { const db = new FakeD1(); return { open: () => new D1PlanStore(db) }; };

async function seed(s: Store, accounts = ["acc_a", "acc_b"]) {
  for (const id of accounts) {
    await s.putAccount({ id, email: `${id}@example.invalid`, seat: "owner", createdAt: T0 });
    for (const p of ["1", "2"]) await s.putPurchase({ id: `pur_${id}_${p}`, accountId: id, productId: "ai_growth", checkoutId: `cs_${id}_${p}`, amountCents: 150000, deliverableIssued: false, refundedCents: 0, status: "paid" });
  }
}
const inv = (o: Partial<Invoice> & { id: string }): Invoice => ({ accountId: "acc_a", purchaseId: "pur_acc_a_1", number: "TT-000001", productId: "ai_growth", amountCents: 150000, issuedAt: T0, stripeEventId: "evt_1", ...o });
const throws = async (f: () => Promise<unknown>) => { try { await f(); return false; } catch { return true; } };

// Returns the list of broken invariants, named C1.. so a mutant can be pinned to the check that kills it.
export async function violations(fac: Factory): Promise<string[]> {
  const bad: string[] = [], { open } = fac(), s = open(); await seed(s);
  const want = (c: string, ok: boolean, m: string) => { if (!ok) bad.push(`${c} ${m}`); };
  // C1 issue then get: exact round trip, absent optionals stay absent, unknown id is undefined
  const a1 = inv({ id: "inv_1" });
  await s.putInvoice(a1);
  const got = await s.invoiceById("inv_1");
  want("C1", JSON.stringify(got) === JSON.stringify(a1) || (got !== undefined && JSON.stringify(Object.entries(got).sort()) === JSON.stringify(Object.entries(a1).sort())), `round trip differs: ${JSON.stringify(got)}`);
  want("C1", (await s.invoiceById("inv_nope")) === undefined, "unknown id must be undefined");
  want("C1", (await open().invoiceById("inv_1"))?.purchaseId === "pur_acc_a_1", "purchaseId must survive a restart");
  // C2 list by account: own rows only, issue order, empty for a stranger; the result is a copy
  await s.putInvoice(inv({ id: "inv_2", number: "TT-000002", purchaseId: "pur_acc_a_2", stripeEventId: "evt_2" }));
  await s.putInvoice(inv({ id: "inv_3", accountId: "acc_b", number: "TT-000003", purchaseId: "pur_acc_b_1", stripeEventId: "evt_3" }));
  const la = await open().invoicesFor("acc_a"), lb = await open().invoicesFor("acc_b");
  want("C2", la.map((i) => i.id).join() === "inv_1,inv_2", `acc_a list ${la.map((i) => i.id)}`);
  want("C2", lb.map((i) => i.id).join() === "inv_3", `acc_b list ${lb.map((i) => i.id)}`);
  want("C2", (await s.invoicesFor("acc_none")).length === 0, "stranger list must be empty");
  la[0].amountCents = 1; want("C2", (await s.invoiceById("inv_1"))?.amountCents === 150000, "list must return copies");
  // C3 upsert by id replaces the row and does not add one
  await s.putInvoice(inv({ id: "inv_1", amountCents: 99900 }));
  want("C3", (await s.invoiceById("inv_1"))?.amountCents === 99900 && (await s.invoicesFor("acc_a")).length === 2, "upsert by id must replace, not add");
  // C4 number is unique across accounts: a clash throws and writes nothing
  want("C4", await throws(() => s.putInvoice(inv({ id: "inv_dup_n", number: "TT-000002", purchaseId: "pur_acc_a_1", stripeEventId: "evt_9" }))), "duplicate number must throw");
  want("C4", (await s.invoiceById("inv_dup_n")) === undefined, "a refused invoice must not be stored");
  // C5 purchaseId uniqueness: one invoice per (purchase, Stripe event); another event or another purchase is fine
  want("C5", await throws(() => s.putInvoice(inv({ id: "inv_dup_p", number: "TT-000010" }))), "same purchase + same event under a new id must throw");
  want("C5", (await s.invoiceById("inv_dup_p")) === undefined, "the refused duplicate must not be stored");
  await s.putInvoice(inv({ id: "inv_cycle", number: "TT-000011", stripeEventId: "evt_cycle" }));   // same purchase, next billing cycle
  await s.putInvoice(inv({ id: "inv_other", number: "TT-000012", purchaseId: "pur_acc_a_2", stripeEventId: "evt_1" })); // same event id, other purchase
  want("C5", (await s.invoicesFor("acc_a")).length === 4, "a new cycle and another purchase must both be accepted");
  // C6 legacy rows without a purchase are not forced unique on the event
  await s.putInvoice(inv({ id: "inv_l1", number: "TT-000020", purchaseId: undefined, stripeEventId: "evt_legacy" }));
  await s.putInvoice(inv({ id: "inv_l2", number: "TT-000021", purchaseId: undefined, stripeEventId: "evt_legacy" }));
  want("C6", "purchaseId" in ((await s.invoiceById("inv_l1")) as object) === false, "an absent purchaseId must read back as an absent key");
  want("C6", (await s.invoicesFor("acc_a")).length === 6, "two legacy rows on one event must both be accepted");
  // C7 numbers: format, strictly increasing, gap-free, unique under 40 concurrent callers, and a restart continues the count
  const fresh = open();
  const first = await fresh.nextInvoiceNumber(), second = await open().nextInvoiceNumber();
  want("C7", /^TT-\d{6}$/.test(first), `number format ${first}`);
  want("C7", Number(second.slice(3)) === Number(first.slice(3)) + 1, `a restart must continue the count: ${first} then ${second}`);
  const many = await Promise.all(Array.from({ length: 40 }, () => open().nextInvoiceNumber()));
  const nums = many.map((x) => Number(x.slice(3))).sort((x, y) => x - y);
  want("C7", new Set(nums).size === 40, "concurrent numbers must be unique");
  want("C7", nums[39] - nums[0] === 39, `concurrent numbers must be gap-free: ${nums[0]}..${nums[39]}`);
  return bad;
}

for (const [name, fac] of [["memory", memory], ["d1", d1]] as const) {
  test(`[${name}] invoice contract C1..C7 holds`, async () => { const bad = await violations(fac); assert.deepEqual(bad, []); });
}

// ---- D1-only: what the schema adds ----
test("[d1] invoices.purchase_id is a foreign key: an invoice for a purchase that does not exist is refused", async () => {
  const db = new FakeD1(), s = new D1PlanStore(db); await seed(s);
  await assert.rejects(() => s.putInvoice(inv({ id: "inv_fk", purchaseId: "pur_missing" })), /FOREIGN KEY/i);
});
test("[d1] account deletion keeps the invoices (tax records), without the email", async () => {
  const db = new FakeD1(), s = new D1PlanStore(db); await seed(s); await s.putInvoice(inv({ id: "inv_keep" }));
  await s.anonymiseAccount("acc_a", T0 + 1);
  const r = await new D1PlanStore(db).invoicesFor("acc_a");
  assert.equal(r.length, 1); assert.equal((await new D1PlanStore(db).accountById("acc_a"))?.email.includes("example.invalid"), false);
});
test("migration 0005 is additive, nullable and NOT APPLIED; the number counter is the single-row table", () => {
  const dir = resolve(import.meta.dirname, "../migrations"), f = readdirSync(dir).find((x) => x.startsWith("0005_"))!;
  const sql = readFileSync(join(dir, f), "utf8");
  assert.equal(f, "0005_invoice_d1.sql"); assert.ok(/NOT applied/.test(sql));
  assert.ok(!/\b(DROP|DELETE|UPDATE)\b/i.test(sql.replace(/--.*$/gm, "")));
  assert.ok(/CREATE TABLE IF NOT EXISTS invoice_seq \(id INTEGER PRIMARY KEY CHECK \(id = 1\), n INTEGER NOT NULL\)/.test(sql), "same counter DDL as f13 0004_store_counters");
  // merge-order rule (f189 finding): web/f16 0003_enterprise already adds invoices.purchase_id; the merge strips this one standalone line (--strip)
  // f245 (merged line = obelisk-int + the C2 stack): the strip is applied, so exactly 0 ALTERs here and the nullable column comes from 0003_enterprise
  assert.equal(sql.split("\n").filter((l) => l.startsWith("ALTER TABLE invoices ADD COLUMN purchase_id")).length, 0, "the merged line carries no second ADD COLUMN purchase_id");
  const db = new FakeD1().db;
  assert.ok((db.prepare("PRAGMA table_info(invoices)").all() as any[]).some((c) => c.name === "purchase_id" && c.notnull === 0));
});

// ---- the service writes through whichever store it is given ----
for (const kind of STORE_KINDS) {
  test(`[${kind}] the webhook flow issues one invoice per payment event, stamped with its purchase, and replay adds none`, async () => {
    const h = make(kind), u = await h.login("inv@example.invalid"), acc = u.account.id as string;
    await h.req("POST", "/checkout", { token: u.session, body: { product: "ai_growth" } });
    const { purchase } = await h.pay("ai_growth");
    const list = await h.store.invoicesFor(acc);
    assert.equal(list.length, 1); assert.equal(list[0].purchaseId, purchase.id); assert.match(list[0].number, /^TT-\d{6}$/);
    // the same paid signal again under a fresh event id, then a billing-cycle invoice.paid: replay adds none, the cycle adds exactly one
    await h.webhook("checkout.session.completed", { id: purchase.checkoutId, payment_status: "paid", subscription: `sub_${purchase.id}` });
    assert.equal((await h.store.invoicesFor(acc)).length, 1, "a second paid signal must not invoice again");
    await h.webhook("invoice.paid", { subscription: `sub_${purchase.id}`, billing_reason: "subscription_cycle", amount_paid: 150000 }, { id: "evt_cycle_1" });
    const after = await h.store.invoicesFor(acc);
    assert.equal(after.length, 2); assert.equal(after[1].purchaseId, purchase.id); assert.equal(after[1].stripeEventId, "evt_cycle_1");
    assert.notEqual(after[0].number, after[1].number);
    const body = await (await h.req("GET", `/invoices/${list[0].id}`, { token: u.session })).text();
    assert.ok(body.includes(list[0].number));
    assert.equal((await h.j(await h.req("GET", "/invoices", { token: u.session }))).invoices.length, 2);
  });
}

// ---- mutation: each adapter mutant must be killed by its named check ----
const SRC = resolve(import.meta.dirname, "../src");
const MUT: { id: string; inv: string; from: string; to: string }[] = [
  { id: "I1 write drops purchase_id", inv: "C1", from: "i.accountId, n(i.purchaseId), i.number,", to: "i.accountId, null, i.number," },
  { id: "I2 read drops purchase_id", inv: "C1", from: "purchaseId: str(r.purchase_id), number:", to: "number:" },
  { id: "I3 list ignores the account", inv: "C2", from: "SELECT * FROM invoices WHERE account_id = ? ORDER BY rowid\", id)", to: "SELECT * FROM invoices WHERE ? IS NOT NULL ORDER BY rowid\", id)" },
  { id: "I4 list in reverse order", inv: "C2", from: "WHERE account_id = ? ORDER BY rowid\", id)).map(toInvoice)", to: "WHERE account_id = ? ORDER BY rowid DESC\", id)).map(toInvoice)" },
  { id: "I5 upsert keeps the old amount", inv: "C3", from: "product_id = excluded.product_id, amount_cents = excluded.amount_cents, issued_at", to: "product_id = excluded.product_id, issued_at" },
  { id: "I6 insert or ignore swallows a clash", inv: "C4", from: "INSERT INTO invoices (id,", to: "INSERT OR IGNORE INTO invoices (id," },
  { id: "I7 counter not durable (reads max+1 from nothing)", inv: "C7", from: "ON CONFLICT(id) DO UPDATE SET n = n + 1 RETURNING n", to: "ON CONFLICT(id) DO UPDATE SET n = 1 RETURNING n" },
  { id: "I8 absent purchaseId read as empty string", inv: "C6", from: "purchaseId: str(r.purchase_id), number:", to: "purchaseId: String(r.purchase_id ?? \"\"), number:" },
];
test(`mutation: ${MUT.length} of ${MUT.length} adapter mutants are killed by their named check`, async () => {
  const text = readFileSync(join(SRC, "d1_plan_store.ts"), "utf8");
  for (const mu of MUT) {
    assert.equal(text.split(mu.from).length - 1, 1, `anchor must match exactly once: ${mu.id}`);
    const dir = mkdtempSync(join(tmpdir(), "invd1_mut_"));
    try {
      cpSync(SRC, join(dir, "src"), { recursive: true });
      writeFileSync(join(dir, "src", "d1_plan_store.ts"), text.replace(mu.from, mu.to));
      const { D1PlanStore: M } = await import(pathToFileURL(join(dir, "src", "d1_plan_store.ts")).href);
      const bad = await violations(() => { const db = new FakeD1(); return { open: () => new M(db) as Store }; });
      assert.ok(bad.length > 0, "SURVIVED: " + mu.id);
      assert.ok(bad.some((b) => b.startsWith(mu.inv)), `killed, but not by ${mu.inv}: ${bad.slice(0, 3).join(" | ")}`);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});
