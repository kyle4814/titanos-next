import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { gather, recompute, type Facts } from "../scripts/c7_ledger_verify.ts";
import { provisionInProcess, runAgents10 } from "../scripts/agents10.ts";

// f398: tests for the C7 independent verifier. SYNTHETIC in-process agents only.
const SCRIPT = fileURLToPath(new URL("../scripts/c7_ledger_verify.ts", import.meta.url));
const clone = (f: Facts): Facts => JSON.parse(JSON.stringify(f));

test("c7 verifier: real run, recompute from the ledger + receipt store agrees with the scorecard (10 accounts, one debit each)", async () => {
  const f = await gather(10);
  const r = recompute(f);
  assert.deepEqual(r.bad, []);
  assert.equal(r.ok_accounts, 10); assert.equal(r.paid_receipts, 10);
  assert.equal(f.scorecard.agents_ok, "10/10");
});

test("c7 verifier: CLI exits 0 with AGREE on the real in-process run", () => {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", SCRIPT], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /C7VERIFY AGREE 10\/10/);
});

test("mutants: each planted server-side corruption is caught (recompute reports it and the scorecard disagreement)", async () => {
  const f = await gather(10);
  const dropDebit = clone(f); dropDebit.ledger = dropDebit.ledger.filter((e, i, a) => !(e.reason === "debit" && e.accountId === f.accounts[2]));
  const doubleDebit = clone(f); { const d = doubleDebit.ledger.find((e) => e.reason === "debit" && e.accountId === f.accounts[4])!; doubleDebit.ledger.push({ ...d, ref: "rcpt_replay" }); }
  const badSig = clone(f); { const r = badSig.receipts.find((x) => x.mode === "prepaid")!; r.sig = r.sig.replace(/.$/, r.sig.endsWith("0") ? "1" : "0"); }
  const swapped = clone(f); { const r = swapped.receipts.find((x) => x.mode === "prepaid")!; r.accountId = f.accounts[9] === r.accountId ? f.accounts[0] : f.accounts[9]; }
  const cheap = clone(f); { const r = cheap.receipts.find((x) => x.mode === "prepaid")!; r.credits = 0; }
  const lostReceipt = clone(f); { const i = lostReceipt.receipts.findIndex((x) => x.mode === "prepaid"); lostReceipt.receipts.splice(i, 1); }
  const wrongSecret = clone(f); wrongSecret.secret = "not-the-secret";
  const topup = clone(f); { const t = topup.ledger.find((e) => e.reason === "topup")!; t.delta = 5000; }
  const sameAccount = clone(f); sameAccount.accounts[1] = sameAccount.accounts[0];
  const lie = clone(f); lie.scorecard.agents_ok = "10/10"; lie.receipts.filter((x) => x.mode === "prepaid").slice(0, 2).forEach((x) => { x.sig = "0".repeat(64); });
  const cases: [string, Facts][] = [["debit dropped", dropDebit], ["double debit", doubleDebit], ["receipt signature broken", badSig], ["receipt account swapped", swapped], ["receipt credits zeroed", cheap], ["paid receipt missing", lostReceipt], ["wrong secret", wrongSecret], ["topup inflated", topup], ["two agents share an account", sameAccount], ["scorecard says 10/10 while 2 server receipts fail", lie]];
  for (const [name, m] of cases) assert.ok(recompute(m).bad.length > 0, "undetected mutant: " + name);
  assert.ok(recompute(lie).bad.some((s) => /scorecard agents_ok 10\/10 disagrees/.test(s)), "the lying scorecard is named");
  assert.ok(recompute(clone(f)).bad.length === 0, "control: unmutated facts stay clean");
});

test("live mutant: a client-side tampered receipt makes the scorecard 9/10 while the server records say 10/10, and the verifier flags the divergence", async () => {
  const p = await provisionInProcess(10);
  const { scorecard } = await runAgents10({ baseUrl: p.baseUrl, fetchImpl: p.fetchImpl, agents: p.agents, llmsText: p.llmsText, receiptSecret: p.receiptSecret, tamper: (i, r) => (i === 3 ? { ...r, credits: 0 } : r) });
  assert.equal(scorecard.agents_ok, "9/10");
  const ledger: any[] = []; for (const a of p.accounts) ledger.push(...(await p.h.store.creditEntries(a)));
  const r = recompute({ accounts: p.accounts, ledger, receipts: [...p.h.store.receipts.values()] as any, secret: p.receiptSecret, scorecard });
  assert.ok(r.bad.some((s) => /scorecard agents_ok 9\/10 disagrees with recompute 10\/10/.test(s)), r.bad.join("; "));
});
