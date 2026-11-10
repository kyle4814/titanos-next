import { test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, setFakeD1Rand } from "./fake_d1.ts";
import { MockBilling } from "../src/stripe.ts";
import { fakeResolver } from "../src/dns.ts";
import { T0, SECRET } from "./harness.ts";
import { MiniflareD1 } from "./miniflare_d1.ts";
// f213: when CONTRACT_LIB=1 another suite imports load()/violations() from here (miniflare_race.test.ts); the FakeD1 tests below must not register again.
const test: typeof nodeTest = process.env.CONTRACT_LIB === "1" ? ((() => undefined) as unknown as typeof nodeTest) : nodeTest;

// f203: the reconciler for the claimed-but-unfinished window (paid purchase, no invoice). ONE contract (R1..R10) over MemoryStore and D1PlanStore (FakeD1: real SQLite, real
// migrations), run on the real source AND on source copies carrying one mutation each (the suite must fail on every mutant). SYNTHETIC ids only.
const SRC = resolve(import.meta.dirname, "../src");
const GRACE = 10 * 60_000;
type Mods = { store: any; d1: any; svc: any; rec: any };
export async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const root = mkdtempSync(join(tmpdir(), "f203-")); if (!root.startsWith(tmpdir())) throw new Error("bad tmp"); const dir = join(root, "portal-api", "src"); mkdirSync(dir, { recursive: true }); symlinkSync(resolve(SRC, "../../lib"), join(root, "lib")); // f245: src/ imports enterprise/, agent/, owner/ siblings and ../../lib
  try {
    cpSync(SRC, dir, { recursive: true });
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts"), rec: await imp("reconcile.ts") };
  } finally { setTimeout(() => rmSync(root, { recursive: true, force: true }), 50); }
}

type Kind = "memory" | "d1" | "mf";
// A "process" = a fresh store object over the same durable state (memory: the one shared object; there is no other process).
function world(m: Mods, kind: Kind) {
  const db: any = kind === "mf" ? new MiniflareD1() : new FakeD1(), shared = new m.store.MemoryStore();
  const open = (): any => (kind === "d1" || kind === "mf" ? new m.d1.D1PlanStore(db) : shared);
  return { open, db };
}
const deps = (m: Mods, store: any, now = T0) => ({ store, billing: new MockBilling(), dns: fakeResolver({}), mailer: new m.svc.MockMailer(), now: () => now, siteOrigin: "https://titanos.tech", webhookSecret: SECRET });
const evFor = (n: number, cs: string) => ({ id: `evt_${n}`, type: "checkout.session.completed", data: { object: { id: cs, payment_status: "paid", payment_intent: `pi_${n}`, customer: `cus_${n}` } } });
async function seedPending(s: any, n: number, product = "compliance_pack") {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ id: `pur${n}`, accountId: "acc1", productId: product, checkoutId: `cs_${n}`, amountCents: PRODUCT_CENTS[product], deliverableIssued: false, refundedCents: 0, status: "pending" });
}
const PRODUCT_CENTS: Record<string, number> = { compliance_pack: 599700, ai_growth: 150000 };
async function seedPaid(s: any, n: number, paidAt: number, status: "paid" | "refunded" = "paid") {
  await seedPending(s, n); const p = await s.purchaseById(`pur${n}`); await s.putPurchase({ ...p, status, paidAt, paymentIntent: `pi_${n}` });
}
// store proxy: throw once, or pause, around a named method
function spy(s: any, h: { throwOnce?: string; before?: Record<string, () => Promise<void>>; after?: Record<string, () => Promise<void>> }) {
  let fired = false;
  return new Proxy(s, { get(t, k: string) {
    const v = t[k]; if (typeof v !== "function") return v;
    return async (...a: unknown[]) => {
      if (h.throwOnce === k && !fired) { fired = true; throw new Error("isolate killed at " + k); }
      await h.before?.[k]?.(); const r = await v.apply(t, a); await h.after?.[k]?.(); return r;
    };
  } });
}
// A gate that never opens (a mutant that skips the paused call) fails after 2 s instead of hanging the suite.
const gate = () => { let go!: () => void; const p = new Promise<void>((r) => (go = r)); const t = setTimeout(() => go(), 2000); return { p: p.then(() => { clearTimeout(t); }), go: () => { clearTimeout(t); go(); } }; };
const invCount = async (s: any) => (await s.invoicesFor("acc1")).length;

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  const { reconcile } = m.rec;

  // R1 empty store
  { const { open } = world(m, kind); const r = await reconcile(open(), T0, GRACE);
    want("R1", r.scanned === 0 && r.repaired === 0 && r.skipped === 0 && r.errors.length === 0, `empty store must report zeros, got ${JSON.stringify(r)}`); }

  // R2 crash-after-claim at each step of markPaid: reconcilable ones are repaired exactly once; early ones are pinned as unrepairable
  // f236: markPaid claims pending -> paid FIRST (casPurchase), so a crash there leaves the row pending (unrepairable, pinned) and a crash at the later takeFacts (f238: markPaid no longer writes the purchase again after its claim) leaves a PAID row with no invoice (repairable).
  const steps: [string, boolean][] = [["casPurchase", false], ["takeFacts", true], ["putAccount", true], ["nextInvoiceNumber", true], ["putInvoiceOnce", true]];
  let n = 100;
  for (const [step, repairable] of steps) {
    n++; const { open } = world(m, kind), base = open(); await seedPending(base, n);
    const crashing = spy(base, { throwOnce: step });
    let died = false; try { await m.svc.handleStripeEvent(deps(m, crashing), evFor(n, `cs_${n}`)); } catch { died = true; }
    want("R2", died, `${step}: the handler must have died (test setup)`);
    want("R2", (await open().claimEvent(`evt_${n}`)) === false, `${step}: the event must be claimed (at-most-once)`);
    want("R2", (await invCount(base)) === 0, `${step}: no invoice yet`);
    const pur = await open().purchaseById(`pur${n}`);
    const r = await reconcile(open(), (pur.paidAt ?? T0) + GRACE, GRACE);
    if (repairable) {
      want("R2", pur.status === "paid" && r.scanned === 1 && r.repaired === 1 && r.skipped === 0, `${step}: want scanned 1 repaired 1, got ${JSON.stringify(r)}`);
      const inv = await open().invoicesFor("acc1");
      want("R2", inv.length === 1 && inv[0].purchaseId === `pur${n}` && inv[0].amountCents === 599700 && inv[0].stripeEventId === `reconcile:pur${n}`, `${step}: one correct invoice, got ${JSON.stringify(inv)}`);
      const r2 = await reconcile(open(), (pur.paidAt ?? T0) + GRACE, GRACE);
      want("R2", r2.scanned === 0 && r2.repaired === 0 && (await invCount(base)) === 1, `${step}: a second run must be a no-op, got ${JSON.stringify(r2)}`);
    } else if (kind === "d1") { // memory hands out the live purchase object, so a mutation made before the crash leaks into the store; only D1 can show the pending row
      want("R2", pur.status === "pending" && r.scanned === 0 && r.repaired === 0 && (await invCount(base)) === 0, `${step}: a purchase that never flipped to paid is not reconcilable (pinned limit), got ${JSON.stringify(r)}`);
    }
  }

  // R3 two concurrent reconcilers over three crashed purchases: exactly one invoice each, repaired sums to 3
  for (let seed = 1; seed <= 20; seed++) {
    let a = seed; setFakeD1Rand(() => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; });
    try {
      const { open } = world(m, kind), s0 = open(); for (const k of [1, 2, 3]) await seedPaid(s0, k, T0);
      const rs = await Promise.all([reconcile(open(), T0 + GRACE, GRACE), reconcile(open(), T0 + GRACE, GRACE), reconcile(open(), T0 + GRACE, GRACE)]);
      const inv = await open().invoicesFor("acc1");
      want("R3", inv.length === 3 && new Set(inv.map((i: any) => i.purchaseId)).size === 3, `seed ${seed}: want exactly 3 invoices, one per purchase, got ${inv.length}`);
      want("R3", new Set(inv.map((i: any) => i.number)).size === inv.length, `seed ${seed}: invoice numbers must be unique`);
      want("R3", rs.reduce((x: number, r: any) => x + r.repaired, 0) === 3, `seed ${seed}: repaired must sum to 3, got ${rs.map((r: any) => r.repaired)}`);
    } finally { setFakeD1Rand(undefined); }
  }

  // R4 a reconcile racing a late delivery whose handler is still in flight, paused at each point of the invoice path: one invoice only
  for (const [pause, when] of [["purchaseInvoiced", "after"], ["nextInvoiceNumber", "before"], ["putInvoiceOnce", "before"]] as const) {
    n++; const { open } = world(m, kind), base = open(); await seedPending(base, n);
    const g = gate(), reached = gate();
    const slow = spy(base, { [when]: { [pause]: async () => { reached.go(); await g.p; } } });
    const delivery = m.svc.handleStripeEvent(deps(m, slow), evFor(n, `cs_${n}`));
    await reached.p;
    const r = await reconcile(open(), T0 + 30 * 60_000, GRACE);
    want("R4", r.repaired === 1, `pause ${pause}: the reconciler should have repaired the in-flight purchase, got ${JSON.stringify(r)}`);
    g.go(); const out = await delivery.catch((e: Error) => "THREW " + e.message);
    want("R4", out === "handled", `pause ${pause}: the late delivery must finish "handled", got ${out}`);
    want("R4", (await invCount(base)) === 1, `pause ${pause}: want ONE invoice, got ${await invCount(base)}`);
  }

  // R5 the pre-check: a reconciler that listed a purchase and then lost it to another reconciler skips WITHOUT burning an invoice number
  { n++; const { open } = world(m, kind), base = open(); await seedPaid(base, n, T0);
    const listed = gate(), g = gate();
    const slowR = spy(open(), { after: { paidPurchasesBefore: async () => { listed.go(); await g.p; } } });
    const r1 = reconcile(slowR, T0 + GRACE, GRACE);
    await listed.p;
    const r2 = await reconcile(open(), T0 + GRACE, GRACE);
    g.go(); const rr1 = await r1;
    want("R5", r2.repaired === 1 && rr1.repaired === 0 && rr1.skipped === 1 && rr1.scanned === 1, `want the loser to skip, got ${JSON.stringify([r2, rr1])}`);
    want("R5", (await invCount(base)) === 1, "R5 want one invoice");
    want("R5", (await open().nextInvoiceNumber()) === "TT-000002", "R5 the skipping reconciler must not burn an invoice number");
  }

  // R6 grace window: younger than graceMs is left alone, exactly graceMs old is eligible
  { n++; const { open } = world(m, kind), base = open(); await seedPaid(base, n, T0);
    const young = await reconcile(open(), T0 + GRACE - 1, GRACE);
    want("R6", young.scanned === 0 && young.repaired === 0 && (await invCount(base)) === 0, `inside grace must be untouched, got ${JSON.stringify(young)}`);
    const old = await reconcile(open(), T0 + GRACE, GRACE);
    want("R6", old.scanned === 1 && old.repaired === 1 && (await invCount(base)) === 1, `at graceMs must repair, got ${JSON.stringify(old)}`);
  }

  // R7 only paid/refunded purchases with a paidAt are candidates; pending and cancelled never are; a refunded one still owes its invoice
  { n++; const { open } = world(m, kind), base = open(); await seedPending(base, n);
    n++; await seedPaid(base, n, T0, "refunded");
    n++; await seedPending(base, n); const c = await base.purchaseById(`pur${n}`); await base.putPurchase({ ...c, status: "cancelled", paidAt: T0 });
    const r = await reconcile(open(), T0 + GRACE, GRACE);
    want("R7", r.scanned === 1 && r.repaired === 1, `only the refunded-with-paidAt purchase is a candidate, got ${JSON.stringify(r)}`);
  }

  // R8 an already-invoiced purchase is never touched (the guard): listing excludes it and the invoice count stays 1
  { n++; const { open } = world(m, kind), base = open(); await seedPaid(base, n, T0);
    await m.svc.issueInvoiceOnce({ store: base, now: () => T0 }, await base.purchaseById(`pur${n}`), 599700, `evt_${n}`);
    const r = await reconcile(open(), T0 + GRACE, GRACE);
    want("R8", r.scanned === 0 && r.repaired === 0 && (await invCount(base)) === 1, `an invoiced purchase must not be scanned, got ${JSON.stringify(r)}`);
    want("R8", (await open().paidPurchasesBefore(T0 + GRACE)).length === 0, "R8 listing must exclude invoiced purchases");
    want("R8", (await m.svc.issueInvoiceOnce({ store: base, now: () => T0 }, await base.purchaseById(`pur${n}`), 599700, "evt_again")) === false && (await invCount(base)) === 1, "R8 issueInvoiceOnce on an invoiced purchase must be false");
  }

  // R9 one failing purchase does not stop the rest (reported, not swallowed)
  { n++; const { open } = world(m, kind), base = open(); await seedPaid(base, n, T0);
    n++; await seedPending(base, n, "compliance_pack"); const q = await base.purchaseById(`pur${n}`); await base.putPurchase({ ...q, productId: "ghost_product", status: "paid", paidAt: T0 + 1 });
    n++; await seedPaid(base, n, T0 + 2); // the first store write of the run throws once (a D1 hiccup); the unknown product is skipped; the third purchase must still be repaired
    const r = await reconcile(spy(open(), { throwOnce: "putInvoiceOnce" }), T0 + GRACE + 5, GRACE).catch((e: Error) => ({ scanned: -1, repaired: -1, skipped: -1, errors: [] as string[], threw: e.message }));
    want("R9", r.scanned === 3 && r.repaired === 1 && r.skipped === 2 && r.errors.length === 2, `want 1 repaired 2 skipped with both errors reported, got ${JSON.stringify(r)}`);
  }

  // R10 a replayed delivery after the repair stays "duplicate" and adds no invoice
  { n++; const { open } = world(m, kind), base = open(); await seedPending(base, n);
    try { await m.svc.handleStripeEvent(deps(m, spy(base, { throwOnce: "putInvoiceOnce" })), evFor(n, `cs_${n}`)); } catch { /* the crash */ }
    await reconcile(open(), T0 + GRACE, GRACE);
    want("R10", (await m.svc.handleStripeEvent(deps(m, open()), evFor(n, `cs_${n}`))) === "duplicate" && (await invCount(base)) === 1, "R10 the Stripe retry stays duplicate, one invoice");
  }
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] reconciler contract R1..R10 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// ---- mutation: each mutant must be killed by its named check, on the adapter it lives in ----
const MUT: { id: string; kind: Kind; inv: string; edits: [string, string, string][] }[] = [
  { id: "M1 service pre-check removed (the already-invoiced check)", kind: "memory", inv: "R5", edits: [["service.ts", "if (await d.store.purchaseInvoiced(pur.id)) return false;", ""]] },
  { id: "M2 memory atomic guard removed", kind: "memory", inv: "R4", edits: [["store.ts", "if ([...this.invoices.values()].some((o) => o.purchaseId === i.purchaseId)) return false;", ""]] },
  { id: "M3 d1 atomic guard removed", kind: "d1", inv: "R4", edits: [["d1_plan_store.ts", "WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id = ?)\",", "WHERE ? IS NOT NULL\","]] },
  { id: "M4 memory listing ignores existing invoices", kind: "memory", inv: "R8", edits: [["store.ts", "&& ![...this.invoices.values()].some((o) => o.purchaseId === p.id)).sort(", ").sort("]] },
  { id: "M5 d1 listing ignores existing invoices", kind: "d1", inv: "R8", edits: [["d1_plan_store.ts", "AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.purchase_id = p.id) ORDER", "ORDER"]] },
  { id: "M6 grace ignored", kind: "memory", inv: "R6", edits: [["reconcile.ts", "store.paidPurchasesBefore(now - grace)", "store.paidPurchasesBefore(now)"]] },
  { id: "M7 grace boundary exclusive", kind: "memory", inv: "R6", edits: [["store.ts", "p.paidAt <= cutoff", "p.paidAt < cutoff"]] },
  { id: "M8 pending purchases listed", kind: "memory", inv: "R7", edits: [["store.ts", "(p.status === \"paid\" || p.status === \"refunded\")", "true"]] },
  { id: "M9 reconciler stops at the first failure", kind: "memory", inv: "R9", edits: [["reconcile.ts", "rep.skipped++; rep.errors.push(`${p.id}: ${String((e as Error)?.message ?? e)}`); }", "throw e; }"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants are killed by their named check`, async () => {
  let killed = 0; const lines: string[] = [];
  for (const mu of MUT) {
    let bad: string[]; try { bad = await violations(await load(mu.edits), mu.kind); } catch (e) { bad = ["THROW " + String(e).slice(0, 100)]; }
    const hit = bad.some((b) => b.startsWith(mu.inv + " "));
    lines.push(`${mu.id}: ${hit ? "KILLED by " + mu.inv : "SURVIVED " + JSON.stringify(bad.slice(0, 3))}`); if (hit) killed++;
  }
  console.log("RECON_MUTANTS " + killed + "/" + MUT.length + "\n" + lines.join("\n"));
  assert.equal(killed, MUT.length, lines.join("\n"));
});
