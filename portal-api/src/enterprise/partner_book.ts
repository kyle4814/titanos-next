// C8 chunk C8 / Partner seat (plan ch.6): the partner's BOOK OF CLIENTS read model.
// listPartnerBook(partnerId) returns ONLY the clients attributed to that partner, each with domain, plan, status, the share
// accrued so far (straight from the f88 share ledger) and the last re-scan proof id. Totals are the ledger sum, to the cent.
// ISOLATION BY CONSTRUCTION: every read takes the partner id (ledgerOf / childrenOf are partner-keyed; there is no
// "clientById"), the caller must be an analyst+ member of that partner tenant, and anything else is an EMPTY 403 (the same
// answer for a foreign partner, an unknown id and a non-partner tenant, so the route is no existence oracle).
// Facts that do not live in the share ledger (domain, plan, status, proof id) come through the BookFactsSource interface;
// MemoryBookFacts is the in-memory/test adapter. The production adapter (billing + re-scan proof store) is a WOULD-FLIP.
import type { EntStore } from "./store.ts";
import { ROLE_RANK, type LedgerEntry } from "./types.ts";
import { sha256Hex } from "../util.ts";

export type BookStatus = "active" | "pending" | "cancelled" | "refunded" | "closed" | "unknown";
export interface BookFacts { domain: string | null; plan: string | null; status: BookStatus; lastRescanProofId: string | null; estateConsent?: boolean }
// partnerId is passed so a production adapter can refuse a client that is not this partner's child (defence in depth: the book already filters).
// factsForAccount resolves a REFERRAL's identity (domain, plan, status, proof); it must itself refuse an account not referred to this partner.
export interface BookFactsSource { factsFor(clientTenantId: string, partnerId?: string): Promise<BookFacts | undefined>; factsForAccount?(accountId: string, partnerId: string): Promise<BookFacts | undefined> }
export class MemoryBookFacts implements BookFactsSource {
  facts = new Map<string, BookFacts>();
  set(clientTenantId: string, f: Partial<BookFacts>) { this.facts.set(clientTenantId, { domain: null, plan: null, status: "active", lastRescanProofId: null, ...f }); }
  byAccount = new Map<string, BookFacts>();
  setAccount(accountId: string, f: Partial<BookFacts>) { this.byAccount.set(accountId, { domain: null, plan: null, status: "active", lastRescanProofId: null, ...f }); }
  async factsFor(id: string) { return this.facts.get(id); }
  async factsForAccount(accountId: string) { return this.byAccount.get(accountId); }
}

export interface BookRow { clientId: string | null; kind: "tenant" | "referral"; label: string; domain: string | null; plan: string | null; status: BookStatus; shareCents: number; heldCents: number; lastRescanProofId: string | null; identity: "attributed" | "unattributed"; estateConsent: boolean | null }
export interface BookTotals { clients: number; accruedCents: number; commissionCents: number; clawbackCents: number; heldCents: number; unsourcedCents: number; paidOutCents: number }
export interface BookPage { partnerId: string; rows: BookRow[]; totals: BookTotals; nextCursor: string | null; ledgerNote: string }
export type BookResult = { status: 200; body: BookPage } | { status: 400; body: { error: "invalid_cursor" | "invalid_limit" } } | { status: 403; body: null };
export const FORBIDDEN: BookResult = { status: 403, body: null };
export const BOOK_MAX_LIMIT = 100, BOOK_DEFAULT_LIMIT = 50;

const PARTNER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
// The cursor is keyset-style (the last row key served) and BOUND to the partner: v1.<sha256(partnerId)[0..16]>.<b64u(rowKey)>.
// A cursor minted for partner A is refused for partner B (400), and even a hand-forged one can only position inside the
// caller's own already-scoped rows, so it cannot cross a tenant boundary.
export async function makeCursor(partnerId: string, rowKey: string): Promise<string> { return `v1.${(await sha256Hex(partnerId)).slice(0, 16)}.${b64u(rowKey)}`; }
async function readCursor(partnerId: string, cursor: string): Promise<string | undefined> {
  const m = /^v1\.([0-9a-f]{16})\.([A-Za-z0-9_-]{1,200})$/.exec(cursor);
  if (!m || m[1] !== (await sha256Hex(partnerId)).slice(0, 16)) return undefined;
  try { return unb64u(m[2]); } catch { return undefined; }
}

export async function listPartnerBook(
  deps: { store: EntStore; facts: BookFactsSource },
  callerAccountId: string, partnerId: unknown, opts: { limit?: unknown; cursor?: unknown } = {},
): Promise<BookResult> {
  if (typeof partnerId !== "string" || !PARTNER_ID_RE.test(partnerId)) return FORBIDDEN;
  const { store, facts } = deps;
  const partner = await store.tenantById(partnerId);
  const mem = partner && !partner.deletedAt && partner.kind === "partner" ? await store.memberOf(partner.id, callerAccountId) : undefined;
  if (!partner || !mem || ROLE_RANK[mem.role] < ROLE_RANK.analyst) return FORBIDDEN;   // not the caller's partner seat: empty 403, zero rows read
  let limit = BOOK_DEFAULT_LIMIT;
  if (opts.limit !== undefined) {
    const n = typeof opts.limit === "number" ? opts.limit : typeof opts.limit === "string" && /^\d{1,4}$/.test(opts.limit) ? Number(opts.limit) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > BOOK_MAX_LIMIT) return { status: 400, body: { error: "invalid_limit" } };
    limit = n;
  }
  let after: string | undefined;
  if (opts.cursor !== undefined && opts.cursor !== null && opts.cursor !== "") {
    after = typeof opts.cursor === "string" ? await readCursor(partner.id, opts.cursor) : undefined;
    if (after === undefined) return { status: 400, body: { error: "invalid_cursor" } };
  }

  // 1) the partner's own ledger (partner-keyed) and the partner's own child tenants (parent-keyed): the ONLY two inputs
  const entries = (await store.ledgerOf(partner.id)).filter((x) => x.partnerId === partner.id);   // belt and braces: a mis-scoped adapter still cannot leak
  const children = (await store.childrenOf(partner.id)).filter((t) => t.parentId === partner.id && t.kind === "client");
  const bySource = new Map<string, LedgerEntry[]>();
  let paidOut = 0, commission = 0, clawback = 0, held = 0;
  for (const x of entries) {
    if (x.kind === "payout" || x.kind === "payout_reversal") { paidOut += x.amountCents; continue; }
    if (x.kind === "commission") commission += x.amountCents; else clawback += x.amountCents;
    if (x.held) held += x.amountCents;
    if (!x.sourceKey) continue;
    const l = bySource.get(x.sourceKey) ?? []; l.push(x); bySource.set(x.sourceKey, l);
  }

  // 2) rows: every live child tenant (attributed by parentId) plus any source the ledger holds for this partner (deleted
  // clients and referrals keep their historic share). A tenant with neither a parent link nor ledger lines never appears.
  const refHashes = new Map<string, string | null>();   // sha256(accountId)[0..10] -> accountId; null = ambiguous (two accounts share the hash)
  for (const r of (await store.referralsOfPartner(partner.id)).filter((x) => x.partnerId === partner.id)) {
    const h = (await sha256Hex(r.accountId)).slice(0, 10);
    refHashes.set(h, refHashes.has(h) ? null : r.accountId);
  }
  const keys = new Set<string>(bySource.keys());
  const tenantOf = new Map<string, (typeof children)[number]>();
  for (const c of children) { keys.add(`tenant:${c.id}`); tenantOf.set(`tenant:${c.id}`, c); }
  const rows: { key: string; row: BookRow }[] = [];
  for (const key of keys) {
    const lines = bySource.get(key) ?? [];
    const comm = lines.filter((x) => x.kind === "commission").reduce((n, x) => n + x.amountCents, 0);
    const claw = lines.filter((x) => x.kind === "clawback").reduce((n, x) => n + x.amountCents, 0);
    const heldC = lines.filter((x) => x.held).reduce((n, x) => n + x.amountCents, 0);
    let row: BookRow;
    if (key.startsWith("tenant:")) {
      const tid = key.slice(7);
      let t = tenantOf.get(key);
      if (!t) { const found = await store.tenantById(tid); t = found && found.parentId === partner.id && found.kind === "client" ? found : undefined; }   // a deleted client with history
      if (!t) continue;   // ledger line pointing at a tenant that is not this partner's child: never shown (and never counted in a row)
      const f = await facts.factsFor(t.id, partner.id);
      const fullyRefunded = comm > 0 && comm + claw <= 0;
      row = { clientId: t.id, kind: "tenant", label: t.name, domain: f?.domain ?? null, plan: f?.plan ?? null,
        status: t.deletedAt ? "closed" : fullyRefunded ? "refunded" : f?.status ?? "unknown", shareCents: comm + claw, heldCents: heldC, lastRescanProofId: f?.lastRescanProofId ?? null, identity: "attributed", estateConsent: f?.estateConsent ?? null };
    } else {
      // f313: referral identity by HASH LOOKUP through THIS partner's own referral rows (refHashes is built per call from referralsOfPartner(partner.id);
      // there is no global hash-to-account index). A hash with no row, or two rows (a collision), is "unattributed", never a guess.
      const acct = refHashes.get(key.slice(4)) ?? undefined;
      const f = acct && facts.factsForAccount ? await facts.factsForAccount(acct, partner.id) : undefined;
      const known = !!acct;   // attributed = this partner's own referral row owns the hash; the facts may still be thin (f undefined)
      row = { clientId: null, kind: "referral", label: known ? "Referral" : "Unattributed", domain: f?.domain ?? null, plan: f?.plan ?? null,
        status: comm > 0 && comm + claw <= 0 ? "refunded" : f?.status ?? "active", shareCents: comm + claw, heldCents: heldC, lastRescanProofId: f?.lastRescanProofId ?? null, identity: known ? "attributed" : "unattributed", estateConsent: null };
    }
    rows.push({ key, row });
  }
  rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  // rows whose source did not resolve to this partner's child are dropped above, so account for their ledger cents explicitly
  const shown = rows.reduce((n, r) => n + r.row.shareCents, 0);
  const totals: BookTotals = {
    clients: rows.length, accruedCents: commission + clawback, commissionCents: commission, clawbackCents: clawback, heldCents: held,
    unsourcedCents: commission + clawback - shown, paidOutCents: paidOut,   // unsourced = every accrued cent no row owns (0 in a healthy ledger); never hidden
  };
  const start = after === undefined ? 0 : rows.findIndex((r) => r.key > after!) === -1 ? rows.length : rows.findIndex((r) => r.key > after!);
  const page = rows.slice(start, start + limit);
  const more = start + limit < rows.length;
  return { status: 200, body: { partnerId: partner.id, rows: page.map((r) => r.row), totals, nextCursor: more ? await makeCursor(partner.id, page[page.length - 1].key) : null,
    ledgerNote: "Share = commission + clawbacks from the share ledger at the rate version on each line; EXAMPLE terms until the partner terms are signed off." } };
}
