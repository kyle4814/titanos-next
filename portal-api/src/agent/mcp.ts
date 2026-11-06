// MCP over HTTP (JSON-RPC 2.0), POST /mcp. Auth: Authorization: Bearer tk_... (a scoped API key from POST /keys).
// Methods: initialize, ping, tools/list, tools/call. A key sees and can call only the tools its scopes allow.
import { HttpError, type Deps } from "../service.ts";
import type { Account, ApiKey } from "../store.ts";
import { sha256Hex, randomToken } from "../util.ts";
import { hashOf, newReceiptId, ringOf, signWithRing } from "./receipt.ts";
import { TOOLS, toolByName, publicTool, ToolError, type ToolDef } from "./tools.ts";

export const PROTOCOL_VERSION = "2025-03-26";
export const RATE_LIMIT_PER_MIN = 60;
export const IDEM_TTL_MS = 30_000; // a claim older than this (by d.now()) belongs to a crashed worker and may be taken over
export const idemTiming = { waitMs: 5_000, pollMs: 5 }; // how long a loser waits for the winner's receipt (real time) before answering idempotency_in_progress
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const ring = ringOf(d);
  if (!ring) return err(id, -32603, "receipts_unavailable"); // fail closed: no signing secret, no calls
  const bad = validate(t, argsIn);
  if (bad) return err(id, -32602, bad);
  const args = (argsIn ?? {}) as Record<string, any>;
  const idem = hdr.idem && /^[\w.-]{1,64}$/.test(hdr.idem) ? hdr.idem : undefined;
  // RESERVE FIRST (F17). Insert-first on (key, Idempotency-Key): exactly one concurrent caller wins and may debit; the rest wait for
  // the winner's receipt and replay it. A claim that expires (crashed owner) is taken over and keeps its rid, so a debit the dead
  // owner already made is recognised below instead of repeated. A failed or refused call releases the claim so the key can be retried.
  let rid = newReceiptId(), owner: string | undefined;
  const release = async () => { if (owner && idem) await d.store.idemRelease(auth.key.id, idem, owner); owner = undefined; };
  let recovered = false;
  if (idem) {
    const deadline = Date.now() + idemTiming.waitMs;
    for (;;) {
      const prev = await d.store.receiptByIdem(auth.key.id, idem);
      // F-C7: the same key with a different tool or different arguments is a client bug, never a replay of the first receipt.
      if (prev && (prev.tool !== t.name || prev.inputSha !== (await hashOf(args)))) throw new HttpError(422, "idempotency_key_reuse");
      if (prev) return toolText(id, { replayed: true, receipt: prev });
      const mine = randomToken("own", 12);
      const r = await d.store.idemReserve(auth.key.id, idem, rid, mine, d.now(), IDEM_TTL_MS);
      if (r.won) {
        owner = mine; recovered = r.rid !== rid; rid = r.rid;
        const done = await d.store.receiptByIdem(auth.key.id, idem); // the previous owner may have finished between our check and our claim
        if (done) { await release(); if (done.tool !== t.name || done.inputSha !== (await hashOf(args))) throw new HttpError(422, "idempotency_key_reuse"); return toolText(id, { replayed: true, receipt: done }); }
        break;
      }
      if (Date.now() >= deadline) return toolText(id, { error: "idempotency_in_progress", retryAfterMs: IDEM_TTL_MS }, true);
      await sleep(idemTiming.pollMs);
    }
  }
  { // an unexpected throw below deliberately keeps the claim: it expires, and the takeover finds any debit by rid
    const now = d.now();
    if ((await d.store.callsSince(auth.key.id, now - 60_000)) >= RATE_LIMIT_PER_MIN) { await release(); return toolText(id, { error: "rate_limited", perMinute: RATE_LIMIT_PER_MIN }, true); }
    await d.store.noteCall(auth.key.id, now);

    const byok = t.modelBacked && hdr.byok ? hdr.byok : undefined;
    const mode: "free" | "prepaid" | "byok" = t.credits === 0 ? "free" : byok ? "byok" : "prepaid";
    const charge = mode === "prepaid" ? t.credits : 0;
    // ledger ref for this call's debit. Normally rid. After a takeover, look for what the crashed owner left: a debit with no reversal
    // is ours to keep (do not debit again); a debit already reversed means that attempt was refunded, so charge under a fresh ref.
    let ref = rid, alreadyDebited = false;
    if (charge > 0 && recovered) {
      const es = await d.store.creditEntries(auth.account.id);
      for (let n = 0; ; n++) {
        ref = n ? `${rid}~${n}` : rid;
        const deb = es.some((e) => e.reason === "debit" && e.ref === ref), rev = es.some((e) => e.reason === "reversal" && e.ref === ref);
        if (deb && !rev) { alreadyDebited = true; break; }
        if (!deb) break;
      }
    }
    if (charge > 0 && !alreadyDebited) {
      const bal = await d.store.creditApply(auth.account.id, -charge, "debit", ref, now);
      if (bal === undefined) { await release(); return toolText(id, { error: "insufficient_credits", needed: charge, balance: await d.store.creditBalance(auth.account.id) }, true); }
    }
    let output: unknown;
    try {
      output = await t.run({ d, account: auth.account, args, byokKey: byok });
    } catch (e) {
      if (charge > 0) await d.store.creditApply(auth.account.id, charge, "reversal", ref, now); // a failed call costs nothing
      await release();
      if (e instanceof ToolError) return toolText(id, { error: e.code, charged: 0 }, true);
      return toolText(id, { error: "tool_failed", charged: 0 }, true);
    }
    const receipt = await signWithRing(ring, {
      id: rid, tool: t.name, keyId: auth.key.id, accountId: auth.account.id, at: now,
      inputSha: await hashOf(args), outputSha: await hashOf(output), credits: charge, mode, ...(idem ? { idem } : {}),
    });
    await d.store.putReceipt(receipt);
    return toolText(id, { result: output, receipt });
  }
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
