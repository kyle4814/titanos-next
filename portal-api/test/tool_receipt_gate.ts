// C7 tool-receipt coverage gate (F90). Reads the LIVE catalogue (TOOLS) and, for every tool, proves by a real
// in-process call that: it declares a valid scope; a key holding that scope gets a result plus a receipt carrying
// an id, the input hash and the cost; a key missing exactly that scope is refused with NO receipt, NO ledger
// entry and no charge; and a test file exists that calls the tool and asserts a receipt. Synthetic data only,
// no network, no model (the model is the harness MockModel). The door is injected so mutants can wrap it.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { make, RECEIPT_SECRET } from "./harness.ts";
import { SCOPES, type ToolDef } from "../src/agent/tools.ts";
import { hashOf, verifyReceipt } from "../src/agent/receipt.ts";

export type CallOut = { http: number; body: any; receiptsStored: number; balanceBefore: number; balanceAfter: number; listed: any[] };
export interface Door { call(tool: ToolDef, args: unknown, scopes: string[]): Promise<CallOut> }

// Synthetic arguments per tool. A tool missing here is reported as a defect (no_fixture), never skipped.
export const ARGS: Record<string, unknown> = {
  catalogue_list: {}, price_quote: { product: "monitor_monthly" }, domain_check: { domain: "bad.example.com.au" },
  my_domains: {}, credits_balance: {}, explain_finding: { finding: "dmarc_missing" }, receipt_verify: "FROM_PRIOR_RECEIPT",
};

export function realDoor(): Door {
  return {
    async call(tool, args, scopes) {
      const h = make();
      h.dns.zone["bad.example.com.au"] = ["v=spf1 +all"];
      const s = await h.login("gate@example.com.au");
      const k = await h.j(await h.req("POST", "/keys", { token: s.session, body: { scopes } }));
      if (tool.credits > 0) { // fund the account the way a customer would, through the mock checkout and signed webhook
        await h.req("POST", "/agent/credits/topup", { token: s.session, body: { pack: "credits_2000" } });
        const order = [...h.store.creditOrders.values()].at(-1)!;
        await h.webhook("checkout.session.completed", { id: order.checkoutId, payment_status: "paid" });
      }
      let n = 0;
      const rpc = async (method: string, params?: unknown) => (await h.req("POST", "/mcp", { token: k.key, body: { jsonrpc: "2.0", id: ++n, method, params } })).json() as Promise<any>;
      let a = args as any;
      if (a === "FROM_PRIOR_RECEIPT") { // receipt_verify needs a receipt this key was really given
        const first = await rpc("tools/call", { name: "catalogue_list", arguments: {} });
        a = { receipt_id: first.result.structuredContent.receipt.id };
      }
      const balanceBefore = await h.store.creditBalance(s.account.id), storedBefore = h.store.receipts.size;
      const body = await rpc("tools/call", { name: tool.name, arguments: a });
      const listed = (await rpc("tools/list")).result.tools;
      return { http: 200, body: { ...body, _args: a }, receiptsStored: h.store.receipts.size - storedBefore, balanceBefore, balanceAfter: await h.store.creditBalance(s.account.id), listed };
    },
  };
}

export interface Row { tool: string; scope: string; credits: number; receiptTestFiles: string[]; pass: boolean; fails: string[] }
const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
export function receiptTestFiles(name: string, dir = TEST_DIR): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".test.ts") && f !== "tool_receipt_coverage.test.ts").filter((f) => {
    const src = readFileSync(dir + f, "utf8");
    return new RegExp(`\\b${name}\\b`).test(src) && /receipt/i.test(src) && /assert/.test(src);
  });
}

export async function audit(tools: readonly ToolDef[], door: Door, testDir = TEST_DIR): Promise<Row[]> {
  const rows: Row[] = [];
  for (const t of tools) {
    const fails: string[] = [];
    const row: Row = { tool: t.name, scope: String(t.scope), credits: t.credits, receiptTestFiles: receiptTestFiles(t.name, testDir), pass: false, fails };
    if (!(SCOPES as readonly string[]).includes(t.scope)) fails.push(`scope_not_declared:${String(t.scope)}`);
    if (!row.receiptTestFiles.length) fails.push("no_receipt_test_file");
    if (!(t.name in ARGS)) fails.push("no_fixture");
    if (fails.length === 0 || (t.name in ARGS && (SCOPES as readonly string[]).includes(t.scope))) {
      if (t.name in ARGS) {
        // allowed call: key holds every scope
        const ok = await door.call(t, ARGS[t.name], [...SCOPES]);
        const sc = ok.body?.result?.structuredContent, rc = sc?.receipt;
        if (ok.body?.result?.isError !== false || !sc) fails.push(`allowed_call_failed:${JSON.stringify(ok.body).slice(0, 80)}`);
        else if (!rc) fails.push("no_receipt_on_allowed_call");
        else {
          if (!/^rcpt_[0-9a-f]{24}$/.test(String(rc.id))) fails.push("receipt_id_malformed");
          if (rc.tool !== t.name) fails.push("receipt_tool_mismatch");
          if (rc.inputSha !== await hashOf(ok.body._args)) fails.push("receipt_input_hash_wrong");
          if (rc.credits !== t.credits) fails.push("receipt_cost_wrong");
          if (typeof rc.mode !== "string" || !rc.sig) fails.push("receipt_mode_or_sig_missing");
          if (!(await verifyReceipt(RECEIPT_SECRET, rc))) fails.push("receipt_signature_invalid");
          if (ok.receiptsStored !== 1) fails.push(`receipts_stored:${ok.receiptsStored}`);
          if (ok.balanceBefore - ok.balanceAfter !== t.credits) fails.push("debit_not_equal_cost");
        }
        const listedMeta = ok.listed.find((x: any) => x.name === t.name)?._meta;
        if (!listedMeta || listedMeta.scope !== t.scope || listedMeta.credits !== t.credits) fails.push("tools_list_scope_or_cost_missing");
        // refused call: key holds every scope EXCEPT this tool's
        const denied = await door.call(t, ARGS[t.name], SCOPES.filter((s) => s !== t.scope));
        const dsc = denied.body?.result?.structuredContent;
        if (denied.body?.result?.isError !== true || dsc?.error !== "scope_denied" || dsc?.needs !== t.scope) fails.push(`refusal_wrong:${JSON.stringify(dsc ?? denied.body).slice(0, 80)}`);
        if (JSON.stringify({ ...denied.body, _args: undefined }).includes("rcpt_") || dsc?.receipt !== undefined) fails.push("receipt_on_refused_call");
        if (denied.receiptsStored !== 0) fails.push("refused_call_stored_receipt");
        if (denied.balanceAfter !== denied.balanceBefore) fails.push("refused_call_charged");
        if (denied.listed.some((x: any) => x.name === t.name)) fails.push("tool_listed_to_key_without_scope");
      }
    }
    row.pass = fails.length === 0;
    rows.push(row);
  }
  return rows;
}

export function formatMatrix(rows: Row[]): string {
  const pad = (s: string, n: number) => s.padEnd(n);
  const lines = [pad("tool", 18) + pad("scope", 18) + pad("cost", 6) + pad("receipt test file", 32) + "pass"];
  for (const r of rows) lines.push(pad(r.tool, 18) + pad(r.scope, 18) + pad(String(r.credits), 6) + pad(r.receiptTestFiles.join(",") || "NONE", 32) + (r.pass ? "PASS" : "FAIL " + r.fails.join(";")));
  return lines.join("\n");
}
