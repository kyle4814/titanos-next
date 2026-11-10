// f211 scripted profile of MemoryStore lookups at 1k / 10k / 50k rows. SYNTHETIC data only.
// Run: node --experimental-strip-types bench/profile.ts [label]   Output: JSON lines + a table. Each op is timed for >= MS_PER_CELL ms.
import { MemoryStore } from "../src/store.ts";

const SIZES = [1000, 10000, 50000], MS_PER_CELL = Number(process.env.MS_PER_CELL ?? 150), PER_ACCOUNT = 10;

async function seed(n: number) {
  const s = new MemoryStore(), accts = Math.max(1, Math.floor(n / PER_ACCOUNT));
  for (let a = 0; a < accts; a++) await s.putAccount({ id: `a${a}`, email: `u${a}@example.invalid`, seat: "owner", createdAt: 1 });
  for (let i = 0; i < n; i++) {
    const acc = `a${i % accts}`;
    await s.putPurchase({ id: `p${i}`, accountId: acc, productId: "x", checkoutId: `cs_${i}`, paymentIntent: `pi_${i}`, amountCents: 100, deliverableIssued: false, refundedCents: 0, status: i % 3 === 0 ? "pending" : "paid", paidAt: i, createdAt: i });
    await s.putSubscription({ id: `s${i}`, accountId: acc, purchaseId: `p${i}`, productId: "x", startedAt: 1 });
    await s.putInvoice({ id: `i${i}`, accountId: acc, purchaseId: `p${i}`, number: `N${i}`, productId: "x", amountCents: 100, issuedAt: i, stripeEventId: `ev_${i}` });
    await s.putKey({ id: `k${i}`, accountId: acc, hash: `h${i}`, scopes: ["r"], createdAt: 1 });
    await s.putDomain({ id: `d${i}`, accountId: acc, domain: `d${i}.example.invalid`, token: "t", verifiedAt: 5 });
    await s.putRefundCase({ id: `r${i}`, purchaseId: `p${i}` } as any);
  }
  return { s, accts };
}
async function rate(f: (i: number) => Promise<unknown>) {
  let ops = 0; const t0 = performance.now();
  while (performance.now() - t0 < MS_PER_CELL) { await f(ops); ops++; }
  return ops / ((performance.now() - t0) / 1000);
}
const rows: Record<string, Record<number, number>> = {};
for (const n of SIZES) {
  const { s, accts } = await seed(n);
  const ops: Record<string, (i: number) => Promise<unknown>> = {
    purchasesFor: (i) => s.purchasesFor(`a${i % accts}`),
    purchaseByCheckout: (i) => s.purchaseByCheckout(`cs_${(i * 7919) % n}`),
    purchaseByPaymentIntent: (i) => s.purchaseByPaymentIntent(`pi_${(i * 7919) % n}`),
    accountByEmail: (i) => s.accountByEmail(`u${i % accts}@example.invalid`),
    subscriptionsFor: (i) => s.subscriptionsFor(`a${i % accts}`),
    invoicesFor: (i) => s.invoicesFor(`a${i % accts}`),
    purchaseInvoiced: (i) => s.purchaseInvoiced(`p${(i * 7919) % n}`),
    putInvoice_new: (i) => s.putInvoice({ id: `ix${n}_${i}`, accountId: "a0", purchaseId: `px${n}_${i}`, number: `NX${n}_${i}`, productId: "x", amountCents: 1, issuedAt: 1, stripeEventId: "e" }),
    keyById: (i) => s.keyById(`k${(i * 7919) % n}`),
    keysFor: (i) => s.keysFor(`a${i % accts}`),
    domainsFor: (i) => s.domainsFor(`a${i % accts}`),
    verifiedOwnerOf: (i) => s.verifiedOwnerOf(`d${(i * 7919) % n}.example.invalid`),
    refundCasesFor: (i) => s.refundCasesFor(`p${(i * 7919) % n}`),
    paidPurchasesBefore: () => s.paidPurchasesBefore(n / 2),
  };
  for (const [name, f] of Object.entries(ops)) { (rows[name] ??= {})[n] = Math.round(await rate(f)); }
}
const label = process.argv[2] ?? "run";
console.log(JSON.stringify({ label, date: new Date().toISOString(), node: process.version, msPerCell: MS_PER_CELL, perAccount: PER_ACCOUNT, rows }));
console.log("op".padEnd(26) + SIZES.map((n) => String(n).padStart(12)).join("") + "   1k->50k");
for (const [k, v] of Object.entries(rows)) console.log(k.padEnd(26) + SIZES.map((n) => String(v[n]).padStart(12)).join("") + `   x${(v[1000] / v[50000]).toFixed(1)} slower`);
