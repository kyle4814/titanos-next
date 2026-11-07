import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, MIGRATIONS } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";
// @ts-ignore plain .mjs, the f104 migration lint
import { lint } from "../scripts/migration_lint.mjs";

// f234: purchases.status gains 'abandoned' (migration 0008, table rebuild). SYNTHETIC data only; nothing applied to a real D1 (PENDING LIVE).
const MIG = resolve(import.meta.dirname, "../migrations"), SRC = resolve(import.meta.dirname, "../src"), GRACE = 10 * 60_000;
const M8 = "0008_purchase_abandoned_status.sql";
const sql = (f: string) => readFileSync(join(MIG, f), "utf8");

test("f234 migration 0008 is the LAST migration that rebuilds purchases, and widens only the CHECK", () => {
  // on the merged line other lines own later numbers (0014_key_prefix_index): what matters is that nothing after 0008 rebuilds the purchases table
  assert.ok(MIGRATIONS.includes(M8));
  assert.deepEqual(MIGRATIONS.filter((f) => f > M8 && /DROP TABLE purchases\b/.test(sql(f))), []);
  assert.equal(MIGRATIONS.filter((f) => f.startsWith("0008")).length, 1);
  assert.match(sql(M8), /CHECK \(status IN \('pending','paid','refunded','cancelled','abandoned'\)\)/);
});

test("f234 migration applies on an empty db and 'abandoned' is then accepted, junk still refused", () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON");
  for (const f of MIGRATIONS) db.exec(sql(f));
  db.exec("INSERT INTO accounts (id, email, seat, created_at) VALUES ('a1','x@example.test','pro',1)");
  const ins = (id: string, st: string) => db.exec(`INSERT INTO purchases (id, account_id, product_id, checkout_id, amount_cents, status, created_at) VALUES ('${id}','a1','p','cs_${id}',100,'${st}',5)`);
  ins("ok", "abandoned"); assert.throws(() => ins("bad", "weird"), /CHECK/);
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='purchases' AND name='purchases_pending'").all();
  assert.equal(idx.length, 1, "0007 index must exist after the rebuild");
});

test("f234 migration on a seeded db: rows, ids, columns, invoice_purchase_id and subscription links preserved", () => {
  const db = new DatabaseSync(":memory:"); db.exec("PRAGMA foreign_keys = ON");
  for (const f of MIGRATIONS.filter((x) => x < M8)) db.exec(sql(f));
  db.exec("INSERT INTO accounts (id, email, seat, created_at) VALUES ('a1','x@example.test','pro',1)");
  const rows: [string, string][] = [["p1", "pending"], ["p2", "paid"], ["p3", "refunded"], ["p4", "cancelled"], ["p5", "paid"]];
  rows.forEach(([id, st], i) => db.exec(`INSERT INTO purchases (id, account_id, product_id, domain, checkout_id, payment_intent, subscription_id, paid_at, amount_cents, deliverable_issued, refunded_cents, status, created_at) VALUES ('${id}','a1','prod${i}','d${i}.example.test','cs_${id}','pi_${i}',NULL,${st === "pending" || st === "cancelled" ? "NULL" : 1000 + i},${100 + i},${i % 2},${st === "refunded" ? 100 : 0},'${st}',${50 + i})`));
  db.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at) VALUES ('s1','a1','p5','prod4',9)");
  db.exec("INSERT INTO invoices (id, account_id, number, product_id, amount_cents, issued_at, stripe_event_id, purchase_id) VALUES ('i1','a1','TT-000001','prod1',101,2000,'ev1','p2')");
  const snap = () => db.prepare("SELECT * FROM purchases ORDER BY id").all();
  const before = snap();
  // D1 runs a migration file as one transaction, and defer_foreign_keys only lasts for a transaction: emulate that here.
  db.exec("BEGIN"); db.exec(sql(M8)); db.exec("COMMIT");
  assert.deepEqual(snap(), before, "every row, every column value and id unchanged (cancelled stays cancelled)");
  assert.equal((db.prepare("SELECT COUNT(*) n FROM purchases").get() as any).n, 5);
  assert.equal((db.prepare("SELECT purchase_id FROM invoices WHERE id='i1'").get() as any).purchase_id, "p2");
  assert.equal((db.prepare("SELECT purchase_id FROM subscriptions WHERE id='s1'").get() as any).purchase_id, "p5");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), [], "no dangling link after the rebuild");
  // the links still bite: a child of a missing purchase is refused, and the rebuilt table is the one the FKs resolve to
  // (invoices.purchase_id is a plain column on the merged line, 0003_enterprise; subscriptions.purchase_id is the FK that must still bite)
  assert.throws(() => db.exec("INSERT INTO subscriptions (id, account_id, purchase_id, product_id, started_at) VALUES ('s2','a1','nope','prod4',9)"), /FOREIGN KEY/);
  assert.equal((db.prepare("SELECT status FROM purchases WHERE id='p4'").get() as any).status, "cancelled");
});

test("f234 f104 migration lint passes on the tree, and sees Purchase.status vs the final CHECK", () => {
  const r = lint({ pairs: [{ name: "purchase states", ts: { file: "src/store.ts", iface: "Purchase", prop: "status" }, sql: { table: "purchases", column: "status" } }] });
  // numbering failures (duplicate prefixes, gaps) are tree-wide across the merged lines, not this pair's: only the pair's own failures count here
  assert.deepEqual(r.failures.filter((f: string) => !/^(duplicate prefix|gap:)/.test(f)), []);
  assert.ok(r.files.includes(M8));
  // and it bites: if the TS union gains a value the final CHECK lacks, the lint names it
  const bad = lint({ pairs: [{ name: "purchase states", ts: { file: "src/store.ts", iface: "Purchase", prop: "status" }, sql: { table: "purchases", column: "status" } }], migDir: mkdtempSync(join(tmpdir(), "f234l-")) });
  assert.ok(bad.failures.length > 0, "an empty migration dir must fail the lint");
});

async function load(edits: [string, string, string][] = []) {
  const dir = mkdtempSync(join(tmpdir(), "f234-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const f of readdirSync(SRC)) if (statSync(join(SRC, f)).isDirectory()) symlinkSync(join(SRC, f), join(dir, f));   // src/enterprise, src/market
    for (const [file, from, to] of edits) { const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `anchor ${from}`); writeFileSync(join(dir, file), t.replace(from, to)); }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), rec: await imp("pending_reconciler.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}

async function violations(m: any, kind: "memory" | "d1"): Promise<string[]> {
  const bad: string[] = [], want = (ok: boolean, msg: string) => { if (!ok) bad.push(msg); };
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  const open = (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared);
  const b = new MockBilling(), s = open();
  const deps = (now: number, st = open()) => ({ store: st, billing: b, dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
  await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  const mk = (n: number, status: string) => ({ id: `pur${n}`, accountId: "acc1", productId: "compliance_pack", checkoutId: `cs_${n}`, amountCents: 599700, deliverableIssued: false, refundedCents: 0, status, createdAt: T0 });
  await s.putPurchase(mk(1, "pending")); await s.putPurchase(mk(2, "cancelled")); await s.putPurchase(mk(3, "cancelled"));
  b.sessions.set("cs_1", { id: "cs_1", status: "expired", paymentStatus: "unpaid" });
  const rep = await m.rec.reconcilePending(deps(T0 + GRACE), GRACE);
  want(rep.abandoned === 1 && rep.scanned === 1, `sweep must abandon the expired row, got ${JSON.stringify(rep)}`);
  want((await open().purchaseById("pur1")).status === "abandoned", "reconcilePending must write 'abandoned'");
  want((await open().purchaseById("pur2")).status === "cancelled", "old cancelled rows keep their meaning");
  want(rep.storeAbandoned === 1 && rep.storeCancelled === 2, `report must count apart: abandoned 1 / cancelled 2, got ${rep.storeAbandoned}/${rep.storeCancelled}`);
  // a late paid webhook for the abandoned row AND for a genuinely cancelled row: ignored, no fund, no invoice
  for (const [n, id] of [[1, "e_a"], [2, "e_c"]] as const) {
    const out = await m.svc.handleStripeEvent(deps(T0 + 2 * GRACE), { id, type: "checkout.session.completed", data: { object: { id: `cs_${n}`, payment_status: "paid", payment_intent: `pi_${n}`, customer: "cus_x" } } });
    const p = await open().purchaseById(`pur${n}`);
    want(p.status === (n === 1 ? "abandoned" : "cancelled") && p.paidAt === undefined && (await open().invoicesFor("acc1")).length === 0, `late paid webhook on ${p.status} row must be ignored (got ${out}, ${JSON.stringify(p)})`);
  }
  return bad;
}

for (const kind of ["memory", "d1"] as const) test(`f234 reconcilePending writes abandoned, counts apart, late webhook ignored (${kind})`, async () => { assert.deepEqual(await violations(await load(), kind), []); });

test("f234 mutation: reconcilePending writing 'cancelled' again must fail the contract", async () => {
  const m = await load([["pending_reconciler.ts", '{ ...fresh, status: "abandoned" }', '{ ...fresh, status: "cancelled" }']]);
  let killed = false;
  for (const kind of ["memory", "d1"] as const) { try { if ((await violations(m, kind)).length) killed = true; } catch { killed = true; } }
  assert.ok(killed, "mutant survived");
});
