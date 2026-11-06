import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { FakeD1, setFakeD1Rand } from "./fake_d1.ts";
import { T0 } from "./harness.ts";

// f209: the invoice number is assigned INSIDE the guarded insert, so a loser of the (purchase) or (purchase, event) race consumes no number (gap-free even under a race).
// ONE contract (A1..A7) over MemoryStore and D1PlanStore (FakeD1: real SQLite, real migrations), run on the real source AND on source copies carrying one mutation each.
// SYNTHETIC ids only. PENDING LIVE: FakeD1 is node:sqlite in one process; cross-isolate behaviour on real D1 is not proven here.
const SRC = resolve(import.meta.dirname, "../src");
type Mods = { store: any; d1: any; svc: any };
async function load(edits: [string, string, string][] = []): Promise<Mods> {
  const dir = mkdtempSync(join(tmpdir(), "f209-")); if (!dir.startsWith(tmpdir())) throw new Error("bad tmp");
  try {
    for (const f of readdirSync(SRC)) if (f.endsWith(".ts")) writeFileSync(join(dir, f), readFileSync(join(SRC, f), "utf8"));
    for (const [file, from, to] of edits) {
      const t = readFileSync(join(dir, file), "utf8"); assert.equal(t.split(from).length - 1, 1, `mutation anchor must match exactly once: ${from}`);
      writeFileSync(join(dir, file), t.replace(from, to));
    }
    const imp = (f: string) => import(pathToFileURL(join(dir, f)).href + "?" + Math.random());
    return { store: await imp("store.ts"), d1: await imp("d1_plan_store.ts"), svc: await imp("service.ts") };
  } finally { setTimeout(() => rmSync(dir, { recursive: true, force: true }), 50); }
}

type Kind = "memory" | "d1";
function world(m: Mods, kind: Kind) {
  const db = new FakeD1(), shared = new m.store.MemoryStore();
  const open = (): any => (kind === "d1" ? new m.d1.D1PlanStore(db) : shared);
  return { open, db };
}
async function seed(s: any, n: number) {
  if (!(await s.accountById("acc1"))) await s.putAccount({ id: "acc1", email: "x@example.test", seat: "pro", createdAt: T0 });
  await s.putPurchase({ id: `pur${n}`, accountId: "acc1", productId: "compliance_pack", checkoutId: `cs_${n}`, amountCents: 599700, deliverableIssued: false, refundedCents: 0, status: "paid", paidAt: T0 });
}
const draft = (id: string, n: number, ev: string) => ({ id, accountId: "acc1", purchaseId: `pur${n}`, productId: "compliance_pack", amountCents: 599700, issuedAt: T0, stripeEventId: ev });
const seqOf = (x: string) => Number(x.slice(3));
const rng = (seed: number) => { let a = seed; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; };

export async function violations(m: Mods, kind: Kind): Promise<string[]> {
  const bad: string[] = [], want = (c: string, ok: boolean, msg: string) => { if (!ok) bad.push(`${c} ${msg}`); };
  let cur = "";
  try {

  // A1 first invoice, 40 concurrent racers on ONE purchase with DIFFERENT event ids (a delivery and a reconciler): exactly one wins, the next number is contiguous
  cur = "A1";
  for (const seedN of [1, 2, 3]) {
    setFakeD1Rand(rng(seedN));
    try {
      const { open } = world(m, kind); await seed(open(), 1);
      const rs = await Promise.all(Array.from({ length: 40 }, (_, k) => open().issueInvoiceNumbered(draft(`inv_a1_${k}`, 1, `evt_a1_${k}`), "purchase").then((v: any) => v, (e: Error) => "THREW " + e.message)));
      const wins = rs.filter((r: any) => r && typeof r === "object");
      want("A1", wins.length === 1 && rs.every((r: any) => r === undefined || typeof r === "object"), `seed ${seedN}: want exactly 1 winner and 39 clean losers, got ${wins.length} winners, ${rs.filter((r: any) => typeof r === "string").length} threw`);
      want("A1", (await open().invoicesFor("acc1")).length === 1, `seed ${seedN}: want exactly 1 invoice stored`);
      want("A1", wins[0]?.number === "TT-000001", `seed ${seedN}: the winner must carry TT-000001, got ${wins[0]?.number}`);
      want("A1", (await open().nextInvoiceNumber()) === "TT-000002", `seed ${seedN}: the next number must be TT-000002 (losers consumed none)`);
    } finally { setFakeD1Rand(undefined); }
  }

  // A2 through the SERVICE: 40 concurrent issueInvoiceOnce calls (the pre-check can pass for many), one invoice, no gap
  cur = "A2";
  { setFakeD1Rand(rng(7));
    try {
      const { open } = world(m, kind); const base = open(); await seed(base, 2);
      const pur = await base.purchaseById("pur2");
      const rs = await Promise.all(Array.from({ length: 40 }, (_, k) => m.svc.issueInvoiceOnce({ store: open(), now: () => T0 }, pur, 599700, `evt_a2_${k}`)));
      want("A2", rs.filter(Boolean).length === 1, `want exactly 1 true from issueInvoiceOnce, got ${rs.filter(Boolean).length}`);
      want("A2", (await base.invoicesFor("acc1")).length === 1 && (await open().nextInvoiceNumber()) === "TT-000002", "A2 one invoice and the next number TT-000002");
    } finally { setFakeD1Rand(undefined); } }

  // A3 renewals: 10 distinct events x 4 duplicate deliveries each, all concurrent, on one purchase: exactly 10 invoices numbered TT-000001..TT-000010 and the next is TT-000011
  cur = "A3";
  { setFakeD1Rand(rng(11));
    try {
      const { open } = world(m, kind); await seed(open(), 3);
      const calls: Promise<any>[] = [];
      for (let e = 0; e < 10; e++) for (let k = 0; k < 4; k++) calls.push(open().issueInvoiceNumbered(draft(`inv_a3_${e}_${k}`, 3, `evt_a3_${e}`), "purchase_event").then((v: any) => v, (x: Error) => "THREW " + x.message));
      const rs = await Promise.all(calls);
      const inv = await open().invoicesFor("acc1");
      want("A3", rs.filter((r: any) => typeof r === "object").length === 10 && inv.length === 10, `want 10 invoices from 40 deliveries, got ${inv.length}`);
      const nums = inv.map((i: any) => seqOf(i.number)).sort((a: number, b: number) => a - b);
      want("A3", nums.join() === [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].join(), `numbers must be exactly 1..10, got ${nums.join()}`);
      want("A3", (await open().nextInvoiceNumber()) === "TT-000011", "A3 the next number must be TT-000011");
    } finally { setFakeD1Rand(undefined); } }

  // A4 format and restart unchanged (f192 C7 contract): TT-nnnnnn, a fresh store object over the same durable state continues the count; the same event on a NEW id is refused
  cur = "A4";
  { const { open } = world(m, kind); await seed(open(), 4); await seed(open(), 5);
    const a = await open().issueInvoiceNumbered(draft("inv_a4_1", 4, "evt_a4"), "purchase_event");
    const b = await open().issueInvoiceNumbered(draft("inv_a4_2", 5, "evt_a4"), "purchase_event"); // same event id, OTHER purchase: allowed
    want("A4", /^TT-\d{6}$/.test(a?.number ?? "") && a.number === "TT-000001" && b?.number === "TT-000002", `want TT-000001 then TT-000002, got ${a?.number} ${b?.number}`);
    const again = await open().issueInvoiceNumbered(draft("inv_a4_3", 4, "evt_a4"), "purchase_event");
    want("A4", again === undefined && (await open().nextInvoiceNumber()) === "TT-000003", "A4 a duplicate (purchase, event) returns undefined and the counter stays at 2");
  }

  // A5 the two ways to number meet: nextInvoiceNumber (f192) and issueInvoiceNumbered draw from ONE counter, no repeat, no gap
  cur = "A5";
  { const { open } = world(m, kind); await seed(open(), 6);
    const x = await open().nextInvoiceNumber(); const y = await open().issueInvoiceNumbered(draft("inv_a5", 6, "evt_a5"), "purchase");
    want("A5", x === "TT-000001" && y?.number === "TT-000002", `one counter: want TT-000001 then TT-000002, got ${x} ${y?.number}`); }

  // A6 (D1) a write the schema refuses (purchase does not exist: FOREIGN KEY) rolls back with the batch: the counter did not move
  cur = "A6";
  if (kind === "d1") { const { open } = world(m, kind); await seed(open(), 7);
    let threw = false; try { await open().issueInvoiceNumbered(draft("inv_a6", 999, "evt_a6"), "purchase"); } catch { threw = true; }
    want("A6", threw, "A6 an invoice for a missing purchase must be refused");
    want("A6", (await open().nextInvoiceNumber()) === "TT-000001", "A6 a refused write must not consume a number"); }

  // A7 an absent-purchase-guard lookalike: a different purchase is never blocked by another purchase's invoice
  cur = "A7";
  { const { open } = world(m, kind); await seed(open(), 8); await seed(open(), 9);
    const a = await open().issueInvoiceNumbered(draft("inv_a7_1", 8, "evt_a7"), "purchase"); const b = await open().issueInvoiceNumbered(draft("inv_a7_2", 9, "evt_a7b"), "purchase");
    want("A7", a?.number === "TT-000001" && b?.number === "TT-000002", `two purchases each get one invoice, got ${a?.number} ${b?.number}`); }
  } catch (e) { bad.push(`${cur} THREW ${(e as Error).message}`); } // an unexpected throw is a violation of the check that was running
  return bad;
}

for (const kind of ["memory", "d1"] as const) {
  test(`[${kind}] atomic invoice number contract A1..A7 holds on the real source`, async () => { assert.deepEqual(await violations(await load(), kind), []); });
}

// ---- mutation: each mutant must be killed by its named check, on the adapter it lives in ----
const MEM_HEAD = "async issueInvoiceNumbered(d: InvoiceDraft, guard: InvoiceGuard) {\n";
const MUT: { id: string; kind: Kind; inv: string; edits: [string, string, string][] }[] = [
  // the old order: the number is taken BEFORE the guard, so a loser burns one (memory form)
  { id: "N1 memory: number taken before the guard (the f203 limit returns)", kind: "memory", inv: "A1", edits: [
    ["store.ts", MEM_HEAD, MEM_HEAD + "    const taken = ++this.inv;\n"],
    ["store.ts", "number: `TT-${String(this.inv + 1).padStart(6, \"0\")}` };", "number: `TT-${String(taken).padStart(6, \"0\")}` };"],
    ["store.ts", "this.writeInvoice(inv); this.inv += 1; return inv;", "this.writeInvoice(inv); return inv;"]] },
  // the old order (d1 form): the counter bump is no longer conditioned on the guard
  { id: "N2 d1: counter bump not conditioned on the guard (loser burns a number)", kind: "d1", inv: "A1", edits: [
    ["d1_plan_store.ts", "SELECT 1, 1 WHERE ${g} ON CONFLICT", "SELECT 1, 1 WHERE (${g} OR 1) ON CONFLICT"]] },
  { id: "N3 d1: insert guard removed", kind: "d1", inv: "A1", edits: [
    ["d1_plan_store.ts", "FROM invoice_seq WHERE id = 1)), ?, ?, ?, ? WHERE ${g}", "FROM invoice_seq WHERE id = 1)), ?, ?, ?, ? WHERE (${g} OR 1)"]] },
  { id: "N4 memory: guard removed", kind: "memory", inv: "A1", edits: [
    ["store.ts", "if ([...this.invoices.values()].some((o) => o.purchaseId === d.purchaseId && (guard === \"purchase\" || o.stripeEventId === d.stripeEventId))) return undefined;", ""]] },
  { id: "N5 memory: purchase guard also keys on the event", kind: "memory", inv: "A1", edits: [
    ["store.ts", "(guard === \"purchase\" || o.stripeEventId === d.stripeEventId)", "(o.stripeEventId === d.stripeEventId)"]] },
  { id: "N6 d1: purchase guard also keys on the event", kind: "d1", inv: "A1", edits: [
    ["d1_plan_store.ts", "const g = guard === \"purchase\" ? \"NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id = ?)\" :", "const g = guard === \"purchase\" ? \"NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id = ? AND stripe_event_id = ?)\" :"],
    ["d1_plan_store.ts", "const ga = guard === \"purchase\" ? [d.purchaseId] :", "const ga = guard === \"purchase\" ? [d.purchaseId, d.stripeEventId] :"]] },
  { id: "N7 d1: renewal guard ignores the event (second cycle blocked)", kind: "d1", inv: "A3", edits: [
    ["d1_plan_store.ts", "\"NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id = ? AND stripe_event_id = ?)\";", "\"NOT EXISTS (SELECT 1 FROM invoices WHERE purchase_id = ?)\";"],
    ["d1_plan_store.ts", "[d.purchaseId, d.stripeEventId];", "[d.purchaseId];"]] },
  { id: "N8 memory: renewal guard ignores the event", kind: "memory", inv: "A3", edits: [
    ["store.ts", "(guard === \"purchase\" || o.stripeEventId === d.stripeEventId)", "true"]] },
  { id: "N9 d1: numbering format changed", kind: "d1", inv: "A4", edits: [["d1_plan_store.ts", "'TT-' || printf('%06d',", "'TT-' || printf('%05d',"]] },
  { id: "N10 d1: separate counter (not invoice_seq)", kind: "d1", inv: "A5", edits: [
    ["d1_plan_store.ts", "SELECT 1, 1 WHERE ${g} ON CONFLICT(id) DO UPDATE SET n = n + 1", "SELECT 1, 1 WHERE (${g} AND 0) ON CONFLICT(id) DO UPDATE SET n = n + 1"],
    ["d1_plan_store.ts", "(SELECT n FROM invoice_seq WHERE id = 1)), ?, ?, ?, ? WHERE", "(SELECT COALESCE(MAX(CAST(substr(number, 4) AS INTEGER)), 0) + 1 FROM invoices)), ?, ?, ?, ? WHERE"]] },
];
test(`mutation: ${MUT.length} of ${MUT.length} mutants are killed by their named check`, async () => {
  let killed = 0; const lines: string[] = [];
  for (const mu of MUT) {
    let bad: string[]; try { bad = await violations(await load(mu.edits), mu.kind); } catch (e) { bad = ["THROW " + String(e).slice(0, 100)]; }
    const hit = bad.some((b) => b.startsWith(mu.inv + " "));
    lines.push(`${mu.id}: ${hit ? "KILLED by " + mu.inv : "SURVIVED " + JSON.stringify(bad.slice(0, 3))}`); if (hit) killed++;
  }
  console.log("INVNUM_MUTANTS " + killed + "/" + MUT.length + "\n" + lines.join("\n"));
  assert.equal(killed, MUT.length, lines.join("\n"));
});
