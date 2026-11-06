// MCP over HTTP (JSON-RPC 2.0), POST /mcp. Auth: Authorization: Bearer tk_... (a scoped API key from POST /keys).
// Methods: initialize, ping, tools/list, tools/call. A key sees and can call only the tools its scopes allow.
import { HttpError, type Deps } from "../service.ts";
import type { Account, ApiKey } from "../store.ts";
import { sha256Hex } from "../util.ts";
import { hashOf, newReceiptId, signReceipt } from "./receipt.ts";
import { TOOLS, toolByName, publicTool, ToolError, type ToolDef } from "./tools.ts";

export const PROTOCOL_VERSION = "2025-03-26";
export const RATE_LIMIT_PER_MIN = 60;

export interface AuthedKey { key: ApiKey; account: Account }
export async function authenticateKey(d: Deps, bearer: string | null): Promise<AuthedKey | null> {
  const m = bearer?.match(/^Bearer (tk_[0-9a-f]{48})$/);
  if (!m) return null;
  const key = await d.store.keyByHash(await sha256Hex(m[1]));
  if (!key || key.revokedAt) return null;
  const account = await d.store.accountById(key.accountId);
  if (!account || account.deletedAt) return null;
  return { key, account };
}

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };
const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const toolText = (id: unknown, structured: Record<string, unknown>, isError = false) =>
  ok(id, { content: [{ type: "text", text: JSON.stringify(structured) }], structuredContent: structured, isError });

function validate(t: ToolDef, args: unknown): string | null {
  if (args === undefined || args === null) args = {};
  if (typeof args !== "object" || Array.isArray(args)) return "arguments_must_be_object";
  const a = args as Record<string, unknown>;
  for (const k of Object.keys(a)) if (!t.input.properties[k]) return `unknown_argument:${k}`;
  for (const r of t.input.required) if (typeof a[r] !== "string" || !(a[r] as string).length) return `missing_argument:${r}`;
  for (const [k, p] of Object.entries(t.input.properties)) {
    if (a[k] === undefined) continue;
    if (typeof a[k] !== "string" || (a[k] as string).length > p.maxLength) return `invalid_argument:${k}`;
    if (p.enum && !p.enum.includes(a[k] as string)) return `invalid_argument:${k}`;
  }
  return null;
}

export async function callTool(d: Deps, auth: AuthedKey, id: unknown, name: unknown, argsIn: unknown, hdr: { idem?: string | null; byok?: string | null }) {
  const t = typeof name === "string" ? toolByName(name) : undefined;
  if (!t) return err(id, -32602, "unknown_tool");
  if (!auth.key.scopes.includes(t.scope)) return toolText(id, { error: "scope_denied", needs: t.scope }, true);
  if (!d.receiptSecret) return err(id, -32603, "receipts_unavailable"); // fail closed: no signing secret, no calls
  const bad = validate(t, argsIn);
  if (bad) return err(id, -32602, bad);
  const args = (argsIn ?? {}) as Record<string, any>;
  const idem = hdr.idem && /^[\w.-]{1,64}$/.test(hdr.idem) ? hdr.idem : undefined;
  if (idem) { // a retry with the same Idempotency-Key returns the original receipt and charges nothing more
    const prev = await d.store.receiptByIdem(auth.key.id, idem);
    // F-C7: the same key with a different tool or different arguments is a client bug, never a replay of the first receipt.
    if (prev && (prev.tool !== t.name || prev.inputSha !== (await hashOf(args)))) throw new HttpError(422, "idempotency_key_reuse");
    if (prev) return toolText(id, { replayed: true, receipt: prev });
  }
  const now = d.now();
  if ((await d.store.callsSince(auth.key.id, now - 60_000)) >= RATE_LIMIT_PER_MIN) return toolText(id, { error: "rate_limited", perMinute: RATE_LIMIT_PER_MIN }, true);
  await d.store.noteCall(auth.key.id, now);

  const byok = t.modelBacked && hdr.byok ? hdr.byok : undefined;
  const mode: "free" | "prepaid" | "byok" = t.credits === 0 ? "free" : byok ? "byok" : "prepaid";
  const charge = mode === "prepaid" ? t.credits : 0;
  const rid = newReceiptId();
  if (charge > 0) {
    const bal = await d.store.creditApply(auth.account.id, -charge, "debit", rid, now);
    if (bal === undefined) return toolText(id, { error: "insufficient_credits", needed: charge, balance: await d.store.creditBalance(auth.account.id) }, true);
  }
  let output: unknown;
  try {
    output = await t.run({ d, account: auth.account, args, byokKey: byok });
  } catch (e) {
    if (charge > 0) await d.store.creditApply(auth.account.id, charge, "reversal", rid, now); // a failed call costs nothing
    if (e instanceof ToolError) return toolText(id, { error: e.code, charged: 0 }, true);
    return toolText(id, { error: "tool_failed", charged: 0 }, true);
  }
  const receipt = await signReceipt(d.receiptSecret, {
    id: rid, tool: t.name, keyId: auth.key.id, accountId: auth.account.id, at: now,
    inputSha: await hashOf(args), outputSha: await hashOf(output), credits: charge, mode, ...(idem ? { idem } : {}),
  });
  await d.store.putReceipt(receipt);
  return toolText(id, { result: output, receipt });
}

export async function handleMcp(d: Deps, auth: AuthedKey, msg: Rpc | Rpc[], hdr: { idem?: string | null; byok?: string | null }) {
  if (Array.isArray(msg)) return err(null, -32600, "batch_not_supported");
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(msg?.id, -32600, "invalid_request");
  const { id, method, params } = msg;
  if (method.startsWith("notifications/")) return null; // no reply to notifications
  switch (method) {
    case "initialize": return ok(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "titanos", version: "0.1.0" }, instructions: "TITANOS agent door. Passive, public-record checks only; every call returns a signed receipt." });
    case "ping": return ok(id, {});
    case "tools/list": return ok(id, { tools: TOOLS.filter((t) => auth.key.scopes.includes(t.scope)).map(({ name, title, description, scope, credits, modelBacked, input }) => ({ name, title, description, inputSchema: { type: "object", required: input.required, properties: input.properties, additionalProperties: false }, annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { scope, credits, modelBacked } })) });
    case "tools/call": return callTool(d, auth, id, params?.name, params?.arguments, hdr);
    default: return err(id, -32601, "method_not_found");
  }
}
export { publicTool };
