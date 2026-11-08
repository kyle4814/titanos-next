// Partner seat: book-of-clients view-model (plan chapter 6, chunk C8, f313). Pure: no network, no clock, no storage.
// Input is the GET /partner/book page (portal-api/src/enterprise/partner_book.ts BookPage). Output is what the component draws.
// Node 22 strips types, so keep to erasable TS syntax (no enums, no parameter properties).
export const SYNTHETIC_LABEL = "Example book with made-up clients (not real organisations)";
export const LOADING_TEXT = "Loading your book of clients.";
export const EMPTY_TEXT = "No clients in your book yet. When a client signs up through one of your portals or with your referral code, they appear here with their plan and the share you have earned.";
export const UNATTRIBUTED_TEXT = "Unattributed";
export const WITHHELD_TEXT = "Waiting for the client to share their estate";
export const UNAVAILABLE_TEXT = "The client book is not switched on for this account yet. Your commission ledger below is not affected. Email us and we will turn it on.";
export const FORBIDDEN_TEXT = "This login does not hold a partner seat that can read a client book.";
export const FAILED_TEXT = "The book could not be loaded. Nothing is shown rather than a partial list. Try again in a minute.";
export const LEDGER_NOTE_FALLBACK = "Share = commission less any clawbacks. These are EXAMPLE terms until the partner terms are signed off.";

export type Status = "active" | "pending" | "cancelled" | "refunded" | "closed" | "unknown";
const STATUS_TEXT: Record<Status, string> = { active: "Active", pending: "Pending first payment", cancelled: "Cancelled", refunded: "Refunded", closed: "Closed", unknown: "Not known yet" };
const STATUSES = Object.keys(STATUS_TEXT);

export type BookRowInput = { clientId?: unknown; kind?: unknown; label?: unknown; domain?: unknown; plan?: unknown; status?: unknown; shareCents?: unknown; heldCents?: unknown; lastRescanProofId?: unknown; identity?: unknown; estateConsent?: unknown };
export type BookPageInput = { partnerId?: unknown; rows?: unknown; totals?: unknown; nextCursor?: unknown; ledgerNote?: unknown };
export type BookViewRow = { key: string; client: string; domain: string; plan: string; status: string; statusCode: Status; share: string; shareCents: number; held: string; proof: string; unattributed: boolean; withheld: boolean };
export type BookTotalsView = { clients: number; accrued: string; accruedCents: number; held: string; paidOut: string; unsourced: string; unsourcedCents: number };
export type BookErrorCode = "NOT_A_PAGE" | "BAD_ROW" | "BAD_TOTALS";
export type BookView =
  | { ok: true; empty: boolean; emptyText: string; rows: BookViewRow[]; totals: BookTotalsView; reconciled: boolean; more: boolean; nextCursor: string | null; note: string }
  | { ok: false; code: BookErrorCode; message: string };
export type BookState =
  | { kind: "loading" }
  | { kind: "error"; code: "unavailable" | "forbidden" | "failed"; text: string }
  | { kind: "ready"; view: BookView };

export const audCents = (c: number): string => {
  const neg = c < 0, a = Math.abs(c), d = Math.floor(a / 100), cents = String(a % 100).padStart(2, "0");
  return `${neg ? "-" : ""}AU$${String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
};
const err = (code: BookErrorCode, message: string): BookView => ({ ok: false, code, message });
const isCents = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const text = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

export function buildBookView(input: unknown): BookView {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return err("NOT_A_PAGE", "The book came back in a shape we could not read. Nothing was shown.");
  const p = input as BookPageInput;
  if (!Array.isArray(p.rows)) return err("NOT_A_PAGE", "The book must be a list of clients. Nothing was shown.");
  const t = p.totals as Record<string, unknown> | null | undefined;
  if (!t || typeof t !== "object" || !["clients", "accruedCents", "heldCents", "unsourcedCents", "paidOutCents"].every((k) => isCents(t[k]))) return err("BAD_TOTALS", "The book totals could not be read. Nothing was shown.");
  const rows: BookViewRow[] = [];
  for (let i = 0; i < p.rows.length; i++) {
    const r = p.rows[i] as BookRowInput | null;
    const bad = (why: string) => err("BAD_ROW", `Row ${i + 1} could not be read: ${why}. Nothing was shown.`);
    if (r === null || typeof r !== "object" || Array.isArray(r)) return bad("it is not a client record");
    if (!isCents(r.shareCents) || !isCents(r.heldCents)) return bad("the share is not a whole number of cents");
    if (typeof r.status !== "string" || !STATUSES.includes(r.status)) return bad("the status is not recognised");
    for (const k of ["domain", "plan", "lastRescanProofId", "label", "clientId"] as const) if (r[k] !== null && r[k] !== undefined && typeof r[k] !== "string") return bad(`${k} is not text`);
    const unattributed = r.identity === "unattributed";
    const withheld = r.estateConsent === false;
    const label = unattributed ? UNATTRIBUTED_TEXT : text(r.label, "Client");
    const st = r.status as Status;
    rows.push({
      key: typeof r.clientId === "string" ? r.clientId : `ref:${i}`, client: label,
      domain: unattributed ? UNATTRIBUTED_TEXT.toLowerCase() : withheld ? WITHHELD_TEXT : text(r.domain, "Not known yet"),
      plan: text(r.plan, "Not known yet"), status: STATUS_TEXT[st], statusCode: st,
      share: audCents(r.shareCents), shareCents: r.shareCents, held: audCents(r.heldCents),
      proof: withheld ? WITHHELD_TEXT : text(r.lastRescanProofId, "No re-scan proof yet"), unattributed, withheld,
    });
  }
  const totals: BookTotalsView = { clients: t.clients as number, accruedCents: t.accruedCents as number, accrued: audCents(t.accruedCents as number), held: audCents(t.heldCents as number), paidOut: audCents(t.paidOutCents as number), unsourcedCents: t.unsourcedCents as number, unsourced: audCents(t.unsourcedCents as number) };
  const more = typeof p.nextCursor === "string" && p.nextCursor.length > 0;
  // On the last page the rows are the whole book, so they must add up to the ledger total to the cent (unsourced cents are the only allowed gap, and are shown).
  const rowSum = rows.reduce((n, r) => n + r.shareCents, 0);
  const reconciled = more ? true : rowSum + totals.unsourcedCents === totals.accruedCents;
  return { ok: true, empty: rows.length === 0, emptyText: EMPTY_TEXT, rows, totals, reconciled, more, nextCursor: more ? (p.nextCursor as string) : null, note: text(p.ledgerNote, LEDGER_NOTE_FALLBACK) };
}

/** Map a failed request to a state. 503 and 403 are NEVER shown as an empty book. */
export function bookStateFromError(e: unknown): BookState {
  const status = e && typeof e === "object" && typeof (e as { status?: unknown }).status === "number" ? (e as { status: number }).status : 0;
  if (status === 503) return { kind: "error", code: "unavailable", text: UNAVAILABLE_TEXT };
  if (status === 403 || status === 401) return { kind: "error", code: "forbidden", text: FORBIDDEN_TEXT };
  return { kind: "error", code: "failed", text: FAILED_TEXT };
}
export function bookStateFromPage(page: unknown): BookState {
  const view = buildBookView(page);
  return view.ok ? { kind: "ready", view } : { kind: "error", code: "failed", text: view.message };
}

// Synthetic example (clearly labelled in the UI). Totals equal the row sum to the cent.
export const SAMPLE_PAGE: BookPageInput = {
  partnerId: "ten_example", nextCursor: null, ledgerNote: LEDGER_NOTE_FALLBACK,
  rows: [
    { clientId: "cli_1", kind: "tenant", label: "Example Plumbing Pty Ltd", domain: "plumbing.example.invalid", plan: "ai_growth", status: "active", shareCents: 45_001, heldCents: 0, lastRescanProofId: "scan_example_1", identity: "attributed", estateConsent: true },
    { clientId: "cli_2", kind: "tenant", label: "Example Dental Group", domain: null, plan: "ai_ops", status: "pending", shareCents: 30_003, heldCents: 30_003, lastRescanProofId: null, identity: "attributed", estateConsent: false },
    { clientId: null, kind: "referral", label: "Referral", domain: "bakery.example.invalid", plan: "ai_growth", status: "active", shareCents: 20_007, heldCents: 0, lastRescanProofId: "scan_example_3", identity: "attributed", estateConsent: null },
    { clientId: null, kind: "referral", label: "Unattributed", domain: null, plan: null, status: "active", shareCents: 11, heldCents: 0, lastRescanProofId: null, identity: "unattributed", estateConsent: null },
  ],
  totals: { clients: 4, accruedCents: 95_022, commissionCents: 95_022, clawbackCents: 0, heldCents: 30_003, unsourcedCents: 0, paidOutCents: 0 },
};
