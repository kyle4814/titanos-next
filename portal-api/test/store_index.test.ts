// f211: MemoryStore secondary indexes. Property test (random write/delete/update sequences, index == full scan after EVERY step, same order)
// plus mutation checks (an index update skipped on a delete/update path must be caught). SYNTHETIC data only.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { MemoryStore } from "../src/store.ts";

// small deterministic PRNG (mulberry32)
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

async function publicMatchesScan(s: MemoryStore) { // the PUBLIC methods, not only the internal check
  const v = <R>(m: Map<string, R>) => [...m.values()];
  for (const a of ["a0", "a1", "a2", "a3", "ghost"]) {
    assert.deepEqual(await s.purchasesFor(a), v(s.purchases).filter((p) => p.accountId === a), `purchasesFor ${a}`);
    assert.deepEqual(await s.subscriptionsFor(a), v(s.subs).filter((x) => x.accountId === a), `subscriptionsFor ${a}`);
    assert.deepEqual(await s.domainsFor(a), v(s.domains).filter((d) => d.accountId === a), `domainsFor ${a}`);
    assert.deepEqual(await s.keysFor(a), v(s.keys).filter((k) => k.accountId === a), `keysFor ${a}`);
    assert.deepEqual(await s.invoicesFor(a), v(s.invoices).filter((i) => i.accountId === a).map((i) => ({ ...i })), `invoicesFor ${a}`);
  }
  for (let n = 0; n < 6; n++) {
    assert.equal(await s.purchaseByCheckout(`cs${n}`), v(s.purchases).find((p) => p.checkoutId === `cs${n}`));
    assert.equal(await s.purchaseByPaymentIntent(`pi${n}`), v(s.purchases).find((p) => p.paymentIntent === `pi${n}`));
    assert.equal(await s.accountByEmail(`e${n}@x.invalid`), v(s.accounts).find((a) => a.email === `e${n}@x.invalid`));
    assert.equal(await s.verifiedOwnerOf(`d${n}.invalid`), v(s.domains).find((d) => d.domain === `d${n}.invalid` && d.verifiedAt));
    assert.equal(await s.purchaseInvoiced(`p${n}`), v(s.invoices).some((o) => o.purchaseId === `p${n}`));
    assert.deepEqual(await s.refundCasesFor(`p${n}`), v(s.refundCases).filter((r) => r.purchaseId === `p${n}`));
  }
}

async function randomRun(seed: number, steps: number) {
  const r = rng(seed), s = new MemoryStore(), pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const A = () => `a${Math.floor(r() * 4)}`, N = (k: number) => Math.floor(r() * k);
  let invSeq = 0;
  for (let step = 0; step < steps; step++) {
    const op = pick(["acct", "acct", "acctMutate", "sess", "delsess", "dom", "dom", "domVerify", "anon", "pur", "pur", "purMutate", "purMutate", "sub", "inv", "inv", "invOnce", "key", "keyRevoke", "refund"]);
    const label = `seed ${seed} step ${step} op ${op}`;
    if (op === "acct") await s.putAccount({ id: A(), email: `e${N(6)}@x.invalid`, seat: "o", createdAt: step });
    else if (op === "acctMutate") { const a = [...s.accounts.values()][0]; if (a) { a.email = `e${N(6)}@x.invalid`; await s.putAccount(a); } } // in place, then put (service.ts pattern)
    else if (op === "sess") await s.putSession({ hash: `h${N(8)}`, accountId: A(), expiresAt: 1e12 });
    else if (op === "delsess") await s.deleteSessionsFor(A());
    else if (op === "dom") await s.putDomain({ id: `d${N(8)}`, accountId: A(), domain: `d${N(6)}.invalid`, token: "t", verifiedAt: pick([undefined, 0, 5]) });
    else if (op === "domVerify") { const d = [...s.domains.values()][N(Math.max(1, s.domains.size))]; if (d) { d.verifiedAt = pick([undefined, 7]); await s.putDomain(d); } }
    else if (op === "anon") await s.anonymiseAccount(A(), step);
    else if (op === "pur") await s.putPurchase({ id: `p${N(8)}`, accountId: A(), productId: "x", checkoutId: `cs${N(6)}`, paymentIntent: pick([undefined, `pi${N(6)}`]), amountCents: 1, deliverableIssued: false, refundedCents: 0, status: "pending", createdAt: step });
    else if (op === "purMutate") { const p = [...s.purchases.values()][N(Math.max(1, s.purchases.size))]; if (p) { p.paymentIntent = pick([undefined, `pi${N(6)}`]); if (r() < 0.3) p.checkoutId = `cs${N(6)}`; if (r() < 0.2) p.accountId = A(); await s.putPurchase(p); } }
    else if (op === "sub") await s.putSubscription({ id: `s${N(8)}`, accountId: A(), purchaseId: `p${N(6)}`, productId: "x", startedAt: 1 });
    else if (op === "inv") { try { await s.putInvoice({ id: `i${N(8)}`, accountId: A(), purchaseId: pick([undefined, `p${N(6)}`]), number: `N${N(6)}`, productId: "x", amountCents: 1, issuedAt: 1, stripeEventId: `ev${N(3)}` }); } catch { /* uniqueness violation: nothing written */ } }
    else if (op === "invOnce") { try { await s.putInvoiceOnce({ id: `io${invSeq++}`, accountId: A(), purchaseId: `p${N(6)}`, number: `Z${invSeq}`, productId: "x", amountCents: 1, issuedAt: 1, stripeEventId: `ev${N(3)}` }); } catch { /* ok */ } }
    else if (op === "key") await s.putKey({ id: `k${N(8)}`, accountId: A(), hash: `kh${N(8)}`, scopes: [], createdAt: step });
    else if (op === "keyRevoke") { const k = [...s.keys.values()][0]; if (k) await s.putKey({ ...k, accountId: A() }); }
    else await s.putRefundCase({ id: `r${N(8)}`, purchaseId: `p${N(6)}` } as any);
    assert.deepEqual(s.checkIndexes(), [], label);
    if (step % 10 === 0) await publicMatchesScan(s);
  }
  await publicMatchesScan(s);
  return s;
}

test("property: after every random write/update/delete step each index equals a full scan (same order), 12 seeds x 400 steps", async () => {
  for (let seed = 1; seed <= 12; seed++) await randomRun(seed, 400);
});

test("order is first-insert order of the primary Map: a row that changes key keeps its slot", async () => {
  const s = new MemoryStore();
  for (const [id, acc] of [["p1", "a"], ["p2", "a"], ["p3", "b"]] as const) await s.putPurchase({ id, accountId: acc, productId: "x", checkoutId: id, amountCents: 1, deliverableIssued: false, refundedCents: 0, status: "paid" });
  const p3 = (await s.purchaseById("p3"))!; p3.accountId = "a"; await s.putPurchase(p3); // moves b -> a, was inserted AFTER p2
  assert.deepEqual((await s.purchasesFor("a")).map((p) => p.id), ["p1", "p2", "p3"]);
  const p1 = (await s.purchaseById("p1"))!; p1.accountId = "b"; await s.putPurchase(p1); p1.accountId = "a"; await s.putPurchase(p1); // out and back: slot by primary Map order, p1 first
  assert.deepEqual((await s.purchasesFor("a")).map((p) => p.id), ["p1", "p2", "p3"]);
  assert.deepEqual(s.checkIndexes(), []);
});

test("invoice uniqueness errors match the old scan (which rule fires first, self id exempt)", async () => {
  const s = new MemoryStore(), inv = (id: string, number: string, purchaseId: string | undefined, ev: string) => ({ id, accountId: "a", purchaseId, number, productId: "x", amountCents: 1, issuedAt: 1, stripeEventId: ev });
  await s.putInvoice(inv("i1", "N1", "p1", "e1")); await s.putInvoice(inv("i2", "N2", "p2", "e2"));
  await s.putInvoice(inv("i1", "N1", "p1", "e1")); // same id: upsert
  await assert.rejects(s.putInvoice(inv("i3", "N1", "p9", "e9")), /invoice number N1 already issued/);
  await assert.rejects(s.putInvoice(inv("i3", "N9", "p1", "e1")), /purchase p1 already invoiced for event e1/);
  await assert.rejects(s.putInvoice(inv("i3", "N2", "p1", "e1")), /purchase p1 already invoiced for event e1/); // i1 (event rule) precedes i2 (number rule) in Map order
  await assert.rejects(s.putInvoice(inv("i3", "N1", "p2", "e2")), /invoice number N1 already issued/);        // i1 (number) precedes i2 (event)
  await s.putInvoice(inv("i4", "N4", undefined, "e1")); await s.putInvoice(inv("i5", "N5", undefined, "e1")); // no purchase: event rule never applies
  assert.deepEqual(s.checkIndexes(), []);
});

test("account deletion: domains, sessions and keys are cleaned through the indexes", async () => {
  const s = new MemoryStore();
  await s.putAccount({ id: "a0", email: "e0@x.invalid", seat: "o", createdAt: 1 });
  await s.putDomain({ id: "d1", accountId: "a0", domain: "d1.invalid", token: "t", verifiedAt: 5 });
  await s.putSession({ hash: "h1", accountId: "a0", expiresAt: 1e12 });
  await s.putKey({ id: "k1", accountId: "a0", hash: "kh", scopes: [], createdAt: 1 });
  await s.anonymiseAccount("a0", 9);
  assert.equal(await s.verifiedOwnerOf("d1.invalid"), undefined); assert.deepEqual(await s.domainsFor("a0"), []);
  assert.equal(await s.sessionByHash("h1", 1), undefined);
  assert.equal(await s.accountByEmail("e0@x.invalid"), undefined); assert.equal((await s.accountByEmail("deleted+a0@deleted.invalid"))?.id, "a0");
  assert.equal((await s.keysFor("a0"))[0].revokedAt, 9);
  assert.deepEqual(s.checkIndexes(), []);
});

// ---- mutation: skip an index update on a delete / update path; the property test must catch it ----
if (!process.env.F211_MUT) {
  const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, "..");
  const MUT: [string, string, string][] = [
    ["M1 deleteSessionsFor leaves the session index entry", "this.sessions.delete(s.hash); this.ixSessAcct.remove(s.hash);", "this.sessions.delete(s.hash);"],
    ["M2 anonymise deletes domains but not from the account index", "this.domains.delete(d.id); this.ixDomAcct.remove(d.id);", "this.domains.delete(d.id);"],
    ["M3 anonymise deletes domains but not from the verified-domain index", "this.ixDomVerified.remove(d.id); }", "}"],
    ["M4 anonymise rewrites the email without re-indexing", "this.ixAccount({ ...a, email:", "this.accounts.set(id, { ...a, email:"],
    ["M5 putPurchase skips the payment-intent index", "this.ixPurPi.upsert(p.id, p); }", "}"],
    ["M6 putPurchase skips the checkout index", "this.ixPurCheckout.upsert(p.id, p); this.ixPurPi", "this.ixPurPi"],
    ["M7 a key change does not leave the old bucket", "if (ok !== undefined) this.leave(id, ok);\n    if (nk === undefined)", "if (nk === undefined)"],
    ["M8 remove() forgets the bucket entry", "if (ok !== undefined) this.leave(id, ok); this.keyOf.delete(id); this.seq.delete(id);", "this.keyOf.delete(id); this.seq.delete(id);"],
    ["M9 putDomain skips the verified-domain index", "this.ixDomVerified.upsert(d.id, d); }\n  private ixKey", "}\n  private ixKey"],
    ["M10 putInvoice skips the event index", "[this.ixInvAcct, this.ixInvPur, this.ixInvNumber, this.ixInvEvent]", "[this.ixInvAcct, this.ixInvPur, this.ixInvNumber]"],
    ["M11 an out-of-order insert is not re-sorted", "b.ids = new Set([...b.ids].sort((x, y) => this.seq.get(x)! - this.seq.get(y)!));", ""],
    ["M12 putKey skips the key index", "this.keys.set(k.id, k); this.ixKeyAcct.upsert(k.id, k); }", "this.keys.set(k.id, k); }"],
  ];
  for (const [id, from, to] of MUT) {
    test(`mutant ${id} is killed`, () => {
      const dir = mkdtempSync(join(tmpdir(), "f211mut-"));
      try {
        mkdirSync(join(dir, "test")); cpSync(join(ROOT, "src"), join(dir, "src"), { recursive: true });
        cpSync(fileURLToPath(import.meta.url), join(dir, "test", "store_index.test.ts"));
        const f = join(dir, "src", "store.ts"), t = readFileSync(f, "utf8");
        assert.equal(t.split(from).length - 1, 1, "mutation anchor must match exactly once: " + from.slice(0, 50));
        writeFileSync(f, t.replace(from, () => to));
        const r = spawnSync(process.execPath, ["--experimental-strip-types", "--test", "test/store_index.test.ts"], { cwd: dir, env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "NODE_TEST_CONTEXT")), F211_MUT: "1" }, encoding: "utf8", timeout: 120000 });
        assert.notEqual(r.status, 0, "SURVIVED: " + id);
        assert.doesNotMatch((r.stdout ?? "") + (r.stderr ?? ""), /ERR_MODULE_NOT_FOUND|SyntaxError/, "mutant did not even load");
      } finally { rmSync(dir, { recursive: true, force: true }); }
    });
  }
}
