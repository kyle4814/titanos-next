// C7 kill-test harness: N independent SYNTHETIC agent clients, each with its own key and its own client identity,
// run the full outside-agent path against the TITANOS agent door and print a JSON scorecard.
//   discover (agent card + llms.txt) -> MCP initialize + tools/list -> ONE tool call with an Idempotency-Key
//   -> verify the receipt signature offline -> replay the same key -> confirm the same receipt and no second charge.
//
// Default: in-process handler + MemoryStore + MockBilling + fake DNS (nothing leaves the process).
//   node --experimental-strip-types scripts/agents10.ts
// Live (NOT done here, GATE4/GATE2): needs a deployed Worker + D1 and 10 real test-mode keys. Refused unless
// AGENTS10_LIVE_OK=1, so a stray BASE_URL can never generate traffic by accident:
//   AGENTS10_LIVE_OK=1 BASE_URL=https://api.titanos.tech SITE_URL=https://titanos.tech AGENT_KEYS=tk_...,tk_... [RECEIPT_SECRET=...] node --experimental-strip-types scripts/agents10.ts
//
// "Offline" verification = the client recomputes the HMAC itself (no network call). Receipts are HMAC-SHA256, so the
// verifier needs the shared RECEIPT_SECRET; without it (a real outside agent) the harness falls back to the public
// POST /agent/receipts/verify and labels the scorecard verify_mode "online". It never reports online as offline.
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { hashOf, verifyReceipt } from "../src/agent/receipt.ts";
import type { AgentReceipt } from "../src/store.ts";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface AgentSpec { name: string; key: string }
export interface RunOpts {
  baseUrl: string;
  fetchImpl: Fetch;
  agents: AgentSpec[];
  llmsText?: string;                 // fetched from SITE_URL/llms.txt when absent and siteUrl is given
  siteUrl?: string;
  receiptSecret?: string;            // present = offline verify; absent = online verify (labelled)
  tool?: string;                     // default domain_check (the metered, receipted tool)
  args?: Record<string, string>;
  expectedCredits?: number;          // default 5 (domain_check)
  tamper?: (agentIndex: number, r: AgentReceipt) => AgentReceipt; // mutant hook: alter a receipt before verifying
}
export interface AgentResult {
  agent: string; ok: boolean; failure?: string; discovered: boolean; listed: boolean; called: boolean;
  receipt_verified: boolean; replay_idempotent: boolean; receipt_id?: string; ms: number[];
}
export interface Scorecard {
  agents: number; agents_ok: string; receipts_verified: string; replays_idempotent: string;
  verify_mode: "offline" | "online"; p95_ms: number; calls: number; failures: { agent: string; reason: string }[];
  tool: string; target: string; synthetic: true;
}

const ID = (n: string) => `agent-${n}`;
export const p95 = (xs: number[]): number => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]; };

export async function runAgent(o: RunOpts, i: number): Promise<AgentResult> {
  const a = o.agents[i], tool = o.tool ?? "domain_check", args = o.args ?? { domain: "bad.example.com.au" }, cost = o.expectedCredits ?? 5;
  const r: AgentResult = { agent: a.name, ok: false, discovered: false, listed: false, called: false, receipt_verified: false, replay_idempotent: false, ms: [] };
  // each client has its own identity: its own key, user-agent and client id header (no shared state between agents)
  const idHeaders = { "user-agent": `${ID(a.name)}/1.0 (synthetic harness)`, "x-client-id": ID(a.name) };
  const timed = async (url: string, init: RequestInit) => { const t = performance.now(); const res = await o.fetchImpl(url, init); r.ms.push(performance.now() - t); return res; };
  let rpcId = 0;
  const rpc = async (method: string, params?: unknown, extra: Record<string, string> = {}) => {
    const res = await timed(`${o.baseUrl}/mcp`, { method: "POST", headers: { ...idHeaders, authorization: `Bearer ${a.key}`, "content-type": "application/json", ...extra }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }) });
    return { status: res.status, body: res.status === 202 ? null : ((await res.json()) as any) };
  };
  const fail = (why: string) => { r.failure = why; return r; };
  try {
    // 1. discovery: agent card + llms.txt
    const cardRes = await timed(`${o.baseUrl}/.well-known/agent.json`, { headers: idHeaders });
    const card = (await cardRes.json()) as any;
    const mcp = card?.protocols?.find((p: any) => p.type === "mcp");
    if (cardRes.status !== 200 || !mcp?.url?.endsWith("/mcp") || !card.tools?.some((t: any) => t.name === tool)) return fail("agent_card_invalid");
    if (!o.llmsText || !/agent\.json/.test(o.llmsText) || !/\/mcp/.test(o.llmsText)) return fail("llms_txt_missing_agent_door");
    r.discovered = true;
    // 2. MCP: initialize, initialized notification, tools/list must include the tool for this key's scopes
    const init = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: ID(a.name), version: "1.0" } });
    if (init.status !== 200 || !init.body?.result?.capabilities?.tools) return fail(`initialize_${init.status}`);
    const note = await rpc("notifications/initialized");
    if (note.status !== 202) return fail("initialized_not_202");
    const list = await rpc("tools/list");
    if (!list.body?.result?.tools?.some((t: any) => t.name === tool)) return fail("tool_not_listed_for_key");
    r.listed = true;
    // 3. balance, one call with an Idempotency-Key, receipt
    const bal = async () => (await rpc("tools/call", { name: "credits_balance", arguments: {} })).body?.result?.structuredContent?.result?.balance as number | undefined;
    const before = await bal();
    const idem = `${ID(a.name)}-job-1`;
    const first = await rpc("tools/call", { name: tool, arguments: args }, { "idempotency-key": idem });
    const sc1 = first.body?.result?.structuredContent;
    if (first.body?.result?.isError || !sc1?.receipt) return fail(sc1?.error ?? first.body?.error?.message ?? "call_failed");
    r.called = true;
    let receipt = sc1.receipt as AgentReceipt;
    r.receipt_id = receipt.id;
    // 4. verify the receipt signature (offline when we hold the secret) and check it binds THIS call's input
    if (o.tamper) receipt = o.tamper(i, receipt);
    const sigOk = o.receiptSecret ? await verifyReceipt(o.receiptSecret, receipt)
      : ((await (await timed(`${o.baseUrl}/agent/receipts/verify`, { method: "POST", headers: idHeaders, body: JSON.stringify({ receipt }) })).json()) as any).valid === true;
    const bound = receipt.tool === tool && receipt.inputSha === (await hashOf(args)) && receipt.credits === cost && receipt.mode === "prepaid" && receipt.sig === sc1.receipt.sig;
    r.receipt_verified = sigOk && bound;
    if (!sigOk) return fail("receipt_signature_invalid");
    if (!bound) return fail("receipt_fields_mismatch");
    // 5. replay the same Idempotency-Key: same receipt, replayed flag, and the balance moved exactly once
    const afterFirst = await bal();
    const again = await rpc("tools/call", { name: tool, arguments: args }, { "idempotency-key": idem });
    const sc2 = again.body?.result?.structuredContent;
    const afterReplay = await bal();
    const oneCharge = before !== undefined && afterFirst === before - cost && afterReplay === afterFirst;
    r.replay_idempotent = sc2?.replayed === true && sc2.receipt?.id === receipt.id && sc2.receipt?.sig === sc1.receipt.sig && oneCharge;
    if (!r.replay_idempotent) return fail(oneCharge ? "replay_not_same_receipt" : "double_charge_or_balance_unreadable");
    r.ok = r.discovered && r.listed && r.called && r.receipt_verified && r.replay_idempotent;
    return r;
  } catch (e) { return fail(`exception:${(e as Error).message}`); }
}

export async function runAgents10(o: RunOpts): Promise<{ scorecard: Scorecard; results: AgentResult[] }> {
  let llmsText = o.llmsText;
  if (llmsText === undefined && o.siteUrl) llmsText = await (await o.fetchImpl(`${o.siteUrl}/llms.txt`)).text();
  const run = { ...o, llmsText };
  const results = await Promise.all(o.agents.map((_, i) => runAgent(run, i))); // independent, concurrent
  const n = o.agents.length, x = (f: (r: AgentResult) => boolean) => `${results.filter(f).length}/${n}`;
  return {
    results,
    scorecard: {
      agents: n, agents_ok: x((r) => r.ok), receipts_verified: x((r) => r.receipt_verified), replays_idempotent: x((r) => r.replay_idempotent),
      verify_mode: o.receiptSecret ? "offline" : "online", p95_ms: Math.round(p95(results.flatMap((r) => r.ms)) * 100) / 100,
      calls: results.reduce((s, r) => s + r.ms.length, 0), failures: results.filter((r) => !r.ok).map((r) => ({ agent: r.agent, reason: r.failure ?? "unknown" })),
      tool: o.tool ?? "domain_check", target: o.baseUrl, synthetic: true,
    },
  };
}

// ---- in-process provisioning: ten fresh accounts, ten scoped keys, credits topped up through the MOCK billing ----
export const LLMS_SOURCE = fileURLToPath(new URL("../../app/llms.txt/route.ts", import.meta.url));
export async function provisionInProcess(n = 10, opts: { scopesFor?: (i: number) => string[]; packCredits?: boolean } = {}) {
  const { make, RECEIPT_SECRET } = await import("../test/harness.ts"); // test fixtures only, never imported in live mode
  const { handle } = await import("../src/index.ts");
  const h = make();
  h.dns.zone["bad.example.com.au"] = ["v=spf1 +all"];
  const agents: AgentSpec[] = [], accounts: string[] = [];
  for (let i = 0; i < n; i++) {
    const email = `agent${i + 1}@synthetic.example.com.au`;
    const s = await h.login(email);
    const scopes = opts.scopesFor?.(i) ?? ["catalogue:read", "scan:read", "credits:read", "account:read", "receipt:verify"];
    const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes } }));
    if (opts.packCredits !== false) {
      await h.req("POST", "/agent/credits/topup", { token: s.session, body: { pack: "credits_2000" } });
      const order = [...h.store.creditOrders.values()].at(-1)!;
      await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" });
    }
    agents.push({ name: String(i + 1).padStart(2, "0"), key: k.key }); accounts.push(s.account.id);
  }
  const fetchImpl: Fetch = (url, init) => handle(new Request(url, init), { TITANOS_SITE_ORIGIN: "https://titanos.tech" }, h.deps);
  // llms.txt is a static site route (needs the Next alias to import), so read its committed source text for the agent-door lines
  const llmsText = readFileSync(LLMS_SOURCE, "utf8");
  return { h, agents, accounts, fetchImpl, llmsText, receiptSecret: RECEIPT_SECRET, baseUrl: "https://api.test" };
}

async function main() {
  const base = process.env.BASE_URL;
  if (base) {
    if (process.env.AGENTS10_LIVE_OK !== "1") { console.error("refused: BASE_URL set without AGENTS10_LIVE_OK=1 (live traffic is a gated action, GATE4/GATE2)"); process.exit(2); }
    const keys = (process.env.AGENT_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (keys.length < 10) { console.error("refused: AGENT_KEYS needs 10 comma-separated tk_ keys, one per agent"); process.exit(2); }
    const { scorecard } = await runAgents10({ baseUrl: base.replace(/\/$/, ""), fetchImpl: (u, i) => fetch(u, i), agents: keys.map((key, i) => ({ name: String(i + 1).padStart(2, "0"), key })), siteUrl: process.env.SITE_URL, receiptSecret: process.env.RECEIPT_SECRET || undefined });
    console.log(JSON.stringify(scorecard, null, 2)); process.exit(scorecard.agents_ok === `${keys.length}/${keys.length}` ? 0 : 1);
  }
  const p = await provisionInProcess(10);
  const { scorecard } = await runAgents10({ baseUrl: p.baseUrl, fetchImpl: p.fetchImpl, agents: p.agents, llmsText: p.llmsText, receiptSecret: p.receiptSecret });
  console.log(JSON.stringify(scorecard, null, 2));
  process.exit(scorecard.agents_ok === "10/10" ? 0 : 1);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
