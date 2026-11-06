import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runAgents10, provisionInProcess, p95 } from "../scripts/agents10.ts";

const SCRIPT = fileURLToPath(new URL("../scripts/agents10.ts", import.meta.url));
const go = async (p: Awaited<ReturnType<typeof provisionInProcess>>, extra: Record<string, unknown> = {}) =>
  runAgents10({ baseUrl: p.baseUrl, fetchImpl: p.fetchImpl, agents: p.agents, llmsText: p.llmsText, receiptSecret: p.receiptSecret, ...extra });

test("agents10: 10 independent synthetic agents, own key and account each, all reach a verified receipt and an idempotent replay", async () => {
  const p = await provisionInProcess(10);
  assert.equal(new Set(p.agents.map((a) => a.key)).size, 10);
  assert.equal(new Set(p.accounts).size, 10, "ten separate accounts");
  const { scorecard: s, results } = await go(p);
  assert.deepEqual(s.failures, []);
  assert.equal(s.agents_ok, "10/10"); assert.equal(s.receipts_verified, "10/10"); assert.equal(s.replays_idempotent, "10/10");
  assert.equal(s.verify_mode, "offline"); assert.ok(s.p95_ms > 0 && s.calls === 90 && s.synthetic === true);
  assert.equal(new Set(results.map((r) => r.receipt_id)).size, 10, "ten distinct receipts");
  // one charge per agent in the ledger: 10 x 5 credits debited, nothing else (replays added no debit)
  for (const id of p.accounts) assert.equal(await p.h.store.creditBalance(id), 2000 - 5, "exactly one 5-credit charge per agent");
});

test("agents10: online fallback (no secret held) still 10/10 and is labelled online, never offline", async () => {
  const p = await provisionInProcess(10);
  const { scorecard: s } = await go(p, { receiptSecret: undefined });
  assert.equal(s.agents_ok, "10/10"); assert.equal(s.verify_mode, "online");
});

test("mutant: a tampered receipt fails verification (credits, input hash, signature, tool) and the agent is not counted ok", async () => {
  const tampers: Record<string, (r: any) => any> = {
    credits: (r) => ({ ...r, credits: 0 }),
    inputSha: (r) => ({ ...r, inputSha: "0".repeat(64) }),
    sig: (r) => ({ ...r, sig: r.sig.replace(/.$/, r.sig.endsWith("0") ? "1" : "0") }),
    tool: (r) => ({ ...r, tool: "catalogue_list" }),
    account: (r) => ({ ...r, accountId: "acc_other" }),
  };
  for (const [name, t] of Object.entries(tampers)) {
    const p = await provisionInProcess(10);
    const { scorecard: s, results } = await go(p, { tamper: (i: number, r: any) => (i === 3 ? t(r) : r) });
    assert.equal(s.agents_ok, "9/10", `tamper ${name}`);
    assert.equal(results[3].ok, false); assert.equal(results[3].receipt_verified, false);
    assert.equal(s.failures.length, 1); assert.equal(s.failures[0].agent, "04");
  }
  // same mutants over the online path (server-side verify)
  const p = await provisionInProcess(10);
  const { scorecard: s } = await go(p, { receiptSecret: undefined, tamper: (i: number, r: any) => (i === 0 ? { ...r, credits: 0 } : r) });
  assert.equal(s.agents_ok, "9/10");
});

test("mutant: a wrong verifier secret fails every agent (the offline check is real, not a rubber stamp)", async () => {
  const p = await provisionInProcess(10);
  const { scorecard: s } = await go(p, { receiptSecret: "not-the-secret" });
  assert.equal(s.agents_ok, "0/10"); assert.equal(s.receipts_verified, "0/10");
});

test("mutant: an unscoped key is refused, gets no tool listing, no receipt and no charge; the other nine still pass", async () => {
  const noScan = ["catalogue:read", "credits:read", "account:read", "receipt:verify"];
  const p = await provisionInProcess(10, { scopesFor: (i) => (i === 6 ? noScan : ["catalogue:read", "scan:read", "credits:read", "account:read", "receipt:verify"]) });
  const { scorecard: s } = await go(p);
  assert.equal(s.agents_ok, "9/10"); assert.deepEqual(s.failures, [{ agent: "07", reason: "tool_not_listed_for_key" }]);
  // force the call anyway: the server must refuse it
  const res = await p.fetchImpl(p.baseUrl + "/mcp", { method: "POST", headers: { authorization: `Bearer ${p.agents[6].key}`, "idempotency-key": "force-1" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "domain_check", arguments: { domain: "bad.example.com.au" } } }) });
  const out = (await res.json()) as any;
  assert.equal(out.result.isError, true); assert.equal(out.result.structuredContent.error, "scope_denied");
  assert.equal(await p.h.store.creditBalance(p.accounts[6]), 2000, "refused call charged nothing");
  assert.ok(![...p.h.store.receipts.values()].some((r: any) => r.accountId === p.accounts[6] && r.tool === "domain_check"), "no receipt for the refused call");
});

test("mutant: a key with no credits is refused with insufficient_credits, not a free call", async () => {
  const p = await provisionInProcess(10, { packCredits: false });
  const { scorecard: s } = await go(p);
  assert.equal(s.agents_ok, "0/10"); assert.ok(s.failures.every((f) => f.reason === "insufficient_credits"));
});

test("isolation: one agent cannot replay another agent's Idempotency-Key to read their receipt", async () => {
  const p = await provisionInProcess(2);
  const call = (key: string) => p.fetchImpl(p.baseUrl + "/mcp", { method: "POST", headers: { authorization: `Bearer ${key}`, "idempotency-key": "shared-key-1" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "domain_check", arguments: { domain: "bad.example.com.au" } } }) }).then((r) => r.json()) as Promise<any>;
  const a = await call(p.agents[0].key), b = await call(p.agents[1].key);
  assert.equal(b.result.structuredContent.replayed, undefined, "B did not get a replay of A");
  assert.notEqual(b.result.structuredContent.receipt.id, a.result.structuredContent.receipt.id);
  assert.equal(b.result.structuredContent.receipt.accountId, p.accounts[1]);
});

test("agents10: discovery failures are caught (llms.txt without the agent door fails every agent)", async () => {
  const p = await provisionInProcess(3);
  const { scorecard: s } = await go(p, { llmsText: "# TITANOS\nnothing about agents here" });
  assert.equal(s.agents_ok, "0/3"); assert.ok(s.failures.every((f) => f.reason === "llms_txt_missing_agent_door"));
});

test("agents10: p95 is nearest-rank", () => { assert.equal(p95([]), 0); assert.equal(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 10); assert.equal(p95([5]), 5); });

test("agents10 CLI: in-process default prints a 10/10 scorecard; a BASE_URL without AGENTS10_LIVE_OK is refused before any request", () => {
  const ok = spawnSync(process.execPath, ["--experimental-strip-types", SCRIPT], { encoding: "utf8", env: { ...process.env, BASE_URL: "", NODE_NO_WARNINGS: "1" } });
  assert.equal(ok.status, 0); assert.equal(JSON.parse(ok.stdout).agents_ok, "10/10");
  const live = spawnSync(process.execPath, ["--experimental-strip-types", SCRIPT], { encoding: "utf8", env: { ...process.env, BASE_URL: "http://127.0.0.1:1", AGENTS10_LIVE_OK: "", NODE_NO_WARNINGS: "1" } });
  assert.equal(live.status, 2); assert.match(live.stderr, /refused/); assert.equal(live.stdout, "");
  const nokeys = spawnSync(process.execPath, ["--experimental-strip-types", SCRIPT], { encoding: "utf8", env: { ...process.env, BASE_URL: "http://127.0.0.1:1", AGENTS10_LIVE_OK: "1", AGENT_KEYS: "tk_a", NODE_NO_WARNINGS: "1" } });
  assert.equal(nokeys.status, 2); assert.match(nokeys.stderr, /AGENT_KEYS/);
});
