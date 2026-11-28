// Abuse tracing (F48): an operator holding only a key prefix finds key -> account -> recent calls.
// The prefix is the first 8 chars of the key ID, which is a public handle. The secret token (tk_...) and its stored
// hash are never read into the output, never logged. Constant-time comparison on the secret path (authenticateKey) is untouched.
import { HttpError, type Deps } from "../service.ts";
import { timingSafeEqual } from "../util.ts";

export const PREFIX_LEN = 8, MIN_PREFIX = 6, RECENT_CALLS = 10, MAX_MATCHES = 25;
export const isOperator = (d: Deps, header: string | null) => !!d.operatorSecret && !!header && timingSafeEqual(header, d.operatorSecret); // unset secret = nobody
export interface TraceHit { keyPrefix: string; keyId: string; accountId: string; seat?: string; accountDeleted: boolean; scopes: string[]; createdAt: number; revokedAt?: number; recentCalls: { receiptId: string; tool: string; at: number; credits: number; mode: string }[] }

export async function traceKeyPrefix(d: Deps, raw: string, o: { accountId?: string } = {}): Promise<{ prefix: string; matches: number; ambiguous: boolean; hits: TraceHit[] }> {
  const prefix = String(raw).trim().slice(0, PREFIX_LEN);
  if (prefix.length < MIN_PREFIX || !/^[a-z0-9_]+$/.test(prefix)) throw new HttpError(400, "bad_prefix"); // short or odd prefixes would enumerate every key
  let keys = await d.store.keysByPrefix(prefix, o.accountId);
  if (o.accountId) keys = keys.filter((k) => k.accountId === o.accountId); // account-scoped lookup never reveals another tenant's key
  keys = keys.sort((a, b) => a.createdAt - b.createdAt).slice(0, MAX_MATCHES);
  const hits: TraceHit[] = [];
  for (const k of keys) {
    const acct = await d.store.accountById(k.accountId);
    const calls = await d.store.receiptsForKey(k.id, RECENT_CALLS, k.accountId);
    hits.push({ keyPrefix: k.id.slice(0, PREFIX_LEN), keyId: k.id, accountId: k.accountId, seat: acct?.seat, accountDeleted: !!acct?.deletedAt, scopes: [...k.scopes], createdAt: k.createdAt, revokedAt: k.revokedAt,
      recentCalls: calls.map((r) => ({ receiptId: r.id, tool: r.tool, at: r.at, credits: r.credits, mode: r.mode })) });
  }
  d.log?.(`keytrace prefix=${prefix} matches=${hits.length}`); // the audit line carries the prefix and a count, nothing else
  return { prefix, matches: hits.length, ambiguous: hits.length > 1, hits };
}
