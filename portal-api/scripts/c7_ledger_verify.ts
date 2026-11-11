// C7 INDEPENDENT VERIFIER (f398). SYNTHETIC in-process agents only (MemoryStore + MockBilling + fake DNS); nothing leaves the process.
// The primary C7 proof is agents10.test.ts / agent.test.ts / keycap.test.ts; the scorecard (scripts/agents10.ts) is the harness's own
// summary of what the clients SAW. This script distrusts that summary: it drives the same 10 agents, then recomputes the outcome from the
// SERVER-SIDE records only (credit ledger + receipt store), with its own node:crypto HMAC and its own canonical string
// (no verifyReceipt / hmacSha256Hex / canonical import), and fails on ANY disagreement with the scorecard.
//   per agent account: ledger = one topup of +2000 and exactly ONE debit of -5 (replay added none); balance 1995;
//   the debit ref names a paid receipt of that same account and key; that receipt's HMAC verifies; credits == 5; mode prepaid.
//   globally: 10 distinct paid receipts, 10 distinct accounts, 10 distinct keys, no receipt without a debit (no free paid call).
// exit 0 all agree; 1 disagreement; 2 unusable.   node --experimental-strip-types scripts/c7_ledger_verify.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";

export interface Ent { accountId: string; keyId?: string; delta: number; reason: string; ref: string }
export interface Rcpt { id: string; tool: string; keyId: string; accountId: string; at: number; inputSha: string; outputSha: string; credits: number; mode: string; kid?: string; sig: string }
export interface Facts { accounts: string[]; ledger: Ent[]; receipts: Rcpt[]; secret: string; scorecard: { agents: number; agents_ok: string; receipts_verified: string; replays_idempotent: string } }
const COST = 5, TOPUP = 2000;
const ownCanonical = (r: Rcpt) => [r.id, r.tool, r.keyId, r.accountId, r.at, r.inputSha, r.outputSha, r.credits, r.mode, ...(r.kid ? [r.kid] : [])].join("|");
const ownSigOk = (secret: string, r: Rcpt) => {
  const want = createHmac("sha256", secret).update(ownCanonical(r)).digest("hex");
  return typeof r.sig === "string" && r.sig.length === want.length && timingSafeEqual(Buffer.from(r.sig), Buffer.from(want));
};

// Pure over plain records, so tests can corrupt them.
export function recompute(f: Facts): { ok_accounts: number; paid_receipts: number; bad: string[] } {
  const bad: string[] = [];
  let okAcc = 0;
  const paid = f.receipts.filter((r) => r.mode === "prepaid" || r.credits > 0);
  for (const acc of f.accounts) {
    const ent = f.ledger.filter((e) => e.accountId === acc);
    const debits = ent.filter((e) => e.reason === "debit"), tops = ent.filter((e) => e.reason === "topup");
    const bal = ent.reduce((n, e) => n + e.delta, 0);
    const mine = paid.filter((r) => r.accountId === acc);
    const before = bad.length;
    if (tops.length !== 1 || tops[0].delta !== TOPUP) bad.push(`${acc}: topup rows ${tops.length}`);
    if (debits.length !== 1) bad.push(`${acc}: ${debits.length} debits (replay/double charge?)`);
    else {
      if (debits[0].delta !== -COST) bad.push(`${acc}: debit ${debits[0].delta}`);
      const r = mine.find((x) => x.id === debits[0].ref);
      if (!r) bad.push(`${acc}: debit ref names no paid receipt of this account`);
      else {
        if (r.keyId !== debits[0].keyId) bad.push(`${acc}: receipt key != debit key`);
        if (r.credits !== COST || r.mode !== "prepaid") bad.push(`${acc}: receipt credits ${r.credits} mode ${r.mode}`);
        if (!ownSigOk(f.secret, r)) bad.push(`${acc}: receipt signature fails own HMAC`);
      }
    }
    if (mine.length !== 1) bad.push(`${acc}: ${mine.length} paid receipts`);
    if (bal !== TOPUP - COST) bad.push(`${acc}: balance ${bal}`);
    if (bad.length === before) okAcc++;
  }
  if (new Set(f.accounts).size !== f.accounts.length) bad.push("duplicate accounts");
  if (new Set(paid.map((r) => r.id)).size !== paid.length) bad.push("duplicate paid receipt ids");
  if (new Set(paid.map((r) => r.keyId)).size !== f.accounts.length) bad.push(`distinct keys ${new Set(paid.map((r) => r.keyId)).size} != ${f.accounts.length}`);
  const orphan = paid.filter((r) => !f.ledger.some((e) => e.reason === "debit" && e.ref === r.id));
  if (orphan.length) bad.push(`${orphan.length} paid receipts with no debit (free paid call)`);
  const n = f.accounts.length, s = f.scorecard;
  if (s.agents !== n) bad.push(`scorecard agents ${s.agents} != ${n}`);
  for (const k of ["agents_ok", "receipts_verified", "replays_idempotent"] as const)
    if (s[k] !== `${okAcc}/${n}`) bad.push(`scorecard ${k} ${s[k]} disagrees with recompute ${okAcc}/${n}`);
  return { ok_accounts: okAcc, paid_receipts: paid.length, bad };
}

export async function gather(n = 10): Promise<Facts> {
  const { provisionInProcess, runAgents10 } = await import("./agents10.ts");
  const p = await provisionInProcess(n);
  const { scorecard } = await runAgents10({ baseUrl: p.baseUrl, fetchImpl: p.fetchImpl, agents: p.agents, llmsText: p.llmsText, receiptSecret: p.receiptSecret });
  const ledger: Ent[] = [];
  for (const a of p.accounts) ledger.push(...((await p.h.store.creditEntries(a)) as Ent[]));
  return { accounts: p.accounts, ledger, receipts: [...p.h.store.receipts.values()] as Rcpt[], secret: p.receiptSecret, scorecard };
}

async function main() {
  try {
    const f = await gather(10);
    const r = recompute(f);
    console.log(JSON.stringify({ label: "SYNTHETIC in-process agents", agents: f.accounts.length, scorecard: f.scorecard, recompute: r }));
    console.log(r.bad.length ? "C7VERIFY DISAGREE " + r.bad.slice(0, 5).join("; ") : `C7VERIFY AGREE ${r.ok_accounts}/${f.accounts.length} accounts: one 5-credit debit each, ${r.paid_receipts} paid receipts, own HMAC verified, scorecard matches`);
    process.exit(r.bad.length ? 1 : 0);
  } catch (e) { console.error("C7VERIFY UNUSABLE " + (e as Error).message); process.exit(2); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
