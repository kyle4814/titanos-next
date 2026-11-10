import type { Invoice } from "../store.ts";
import type { EntStore } from "./store.ts";
import { availableCents } from "./store.ts";
import type { LedgerEntry, Party, RateTable, Tenant } from "./types.ts";
import { detectSelfDeal, type SelfDealOptions } from "./selfdeal.ts";
import { randomToken, sha256Hex } from "../util.ts";

const DAY = 86_400_000;
// EXAMPLE terms until the partner terms are signed off (plan: 30% recurring; tiers 40% and 50% are PLANNED; the rate is
// a versioned PARAM). Tiers are empty by default; the table is injected, never hard-wired into the maths.
export const RATE_V1: RateTable = { version: "v1-2026-11-06-EXAMPLE", baseBps: 3000, tiers: [] };
export const HOLD_DAYS = 30;                 // EXAMPLE: the 14-day refund window plus a buffer
export const MIN_PAYOUT_CENTS = 5_000;       // EXAMPLE: AU$50
export const APPROVAL_ABOVE_CENTS = 100_000; // EXAMPLE: AU$1,000, a payout above this waits for Kyle's tap (GATE1)
const ACTIVE_WINDOW_MS = 60 * DAY;

export function rateFor(table: RateTable, activeSources: number): { bps: number; version: string } {
  let bps = table.baseBps;
  for (const t of table.tiers) if (activeSources >= t.minActive && t.bps > bps) bps = t.bps;
  return { bps, version: table.version };
}
export const commissionCents = (amountCents: number, bps: number) => Math.max(0, Math.floor((amountCents * bps) / 10_000));
// REMAINDER RULE (f88): the partner share is rounded DOWN to a whole cent and the platform keeps the remainder, so
// partner + platform === gross exactly and no cent is lost or created. Sub-cent dust never favours the partner.
export function splitCents(grossCents: number, bps: number): { partnerCents: number; platformCents: number } {
  const partnerCents = commissionCents(grossCents, bps);
  return { partnerCents, platformCents: grossCents - partnerCents };
}

// Which partner, if any, earns on this invoice. SINGLE LEVEL: the payer's direct partner only. First the payer's client
// tenant (sub-portal), then a referral claim. Never the payer's own partner tenant (self-dealing), never a deleted
// partner, never a partner whose terms are not accepted.
export async function attribute(e: EntStore, accountId: string): Promise<{ partner: Tenant; sourceKey: string; sourceLabel: string } | undefined> {
  const mems = [...(await e.membershipsFor(accountId))].sort((a, b) => a.addedAt - b.addedAt || a.tenantId.localeCompare(b.tenantId)); // earliest join wins, not role-change order
  const own = new Set(mems.map((m) => m.tenantId));
  for (const m of mems) {
    const t = await e.tenantById(m.tenantId);
    if (!t || t.deletedAt || t.kind !== "client" || !t.parentId) continue;
    const p = await e.tenantById(t.parentId);
    if (!p || p.deletedAt || p.kind !== "partner" || !p.termsAcceptedAt) continue;
    if (own.has(p.id)) continue;
    return { partner: p, sourceKey: `tenant:${t.id}`, sourceLabel: t.name };
  }
  const r = await e.referralOf(accountId);
  if (r) {
    const p = await e.tenantById(r.partnerId);
    if (p && !p.deletedAt && p.kind === "partner" && p.termsAcceptedAt && !own.has(p.id)) {
      return { partner: p, sourceKey: `ref:${(await sha256Hex(accountId)).slice(0, 10)}`, sourceLabel: "Referral" };
    }
  }
  return undefined;
}
async function activeSources(e: EntStore, partnerId: string, now: number): Promise<number> {
  const net = new Map<string, number>();
  for (const x of await e.ledgerOf(partnerId)) {
    if (x.sourceKey && x.at >= now - ACTIVE_WINDOW_MS && (x.kind === "commission" || x.kind === "clawback")) net.set(x.sourceKey, (net.get(x.sourceKey) ?? 0) + x.amountCents);
  }
  return [...net.values()].filter((v) => v > 0).length;
}

// F5: the billing/signup adapter supplies the party signals (email, createdAt, payer fingerprint, signup network token).
export interface SelfDealCheck extends SelfDealOptions { party: (accountId: string) => Promise<Party | undefined> }

export async function recordCommission(e: EntStore, table: RateTable, inv: Invoice, now: number, check?: SelfDealCheck): Promise<LedgerEntry | undefined> {
  const at = await attribute(e, inv.accountId);
  if (!at) return undefined;
  const { bps, version } = rateFor(table, await activeSources(e, at.partner.id, now));
  const amount = commissionCents(inv.amountCents, bps);
  if (amount <= 0) return undefined;
  let holdReasons: string[] | undefined;
  if (check) {
    const referee = await check.party(inv.accountId);
    if (referee) {
      const staff = (await Promise.all((await e.membersOf(at.partner.id)).map((m) => check.party(m.accountId)))).filter((x): x is Party => !!x);
      const v = detectSelfDeal(staff, referee, check);
      if (v.suspect) holdReasons = v.reasons;
    }
  }
  const entry: LedgerEntry = {
    id: randomToken("led", 8), uniq: `commission:${inv.id}`, partnerId: at.partner.id, kind: "commission", amountCents: amount, at: now,
    availableAt: now + HOLD_DAYS * DAY, invoiceId: inv.id, sourceKey: at.sourceKey, sourceLabel: at.sourceLabel, rateBps: bps, rateVersion: version,
    ...(holdReasons ? { held: true, holdReasons } : {}),
  };
  return (await e.addLedger(entry)) ? entry : undefined;
}

// Refund clawback: bring the clawed-back total of each commission up to the refunded fraction. Idempotent: the unique
// key carries the cumulative target, so replaying the same refund writes nothing.
export async function clawback(e: EntStore, invoices: Invoice[], refundedCents: number, now: number): Promise<void> {
  const total = invoices.reduce((n, i) => n + i.amountCents, 0);
  if (total <= 0 || refundedCents <= 0) return;
  refundedCents = Math.floor(refundedCents);
  for (const inv of invoices) {
    const all = await e.ledgerForInvoice(inv.id);
    for (const partnerId of new Set(all.map((x) => x.partnerId))) {
      const led = all.filter((x) => x.partnerId === partnerId);
      const commissions = led.filter((x) => x.kind === "commission");
      const commission = commissions.reduce((n, x) => n + x.amountCents, 0);
      const already = -led.filter((x) => x.kind === "clawback").reduce((n, x) => n + x.amountCents, 0);
      // f88: EXACT integer floor(commission * refunded / total). The old float fraction (refunded / total) lost a cent on
      // some inputs (e.g. 53 instead of 54). BigInt keeps the product exact above 2^53.
      const target = refundedCents >= total ? commission : Number((BigInt(commission) * BigInt(refundedCents)) / BigInt(total));
      const delta = target - already;
      if (delta <= 0) continue;
      const src = commissions[0];
      await e.addLedger({
        id: randomToken("led", 8), uniq: `clawback:${inv.id}:${target}`, partnerId, kind: "clawback", amountCents: -delta, at: now, availableAt: now,
        invoiceId: inv.id, sourceKey: src.sourceKey, sourceLabel: src.sourceLabel,
        ...(src.held ? { held: true, holdReasons: src.holdReasons } : {}),
      });
    }
  }
}

export const balanceCents = async (e: EntStore, partnerId: string, now: number) => availableCents(await e.ledgerOf(partnerId), now);

export function statement(partner: Tenant, entries: LedgerEntry[], month: string): string {
  const [y, m] = month.split("-").map(Number);
  const from = Date.UTC(y, m - 1, 1), to = Date.UTC(y, m, 1);
  const inMonth = entries.filter((x) => x.partnerId === partner.id && x.at >= from && x.at < to); // f88: a statement only ever counts its own tenant's lines
  const sum = (...k: string[]) => inMonth.filter((x) => k.includes(x.kind)).reduce((n, x) => n + x.amountCents, 0);
  const aud = (c: number) => `${c < 0 ? "-" : ""}AU$${(Math.abs(c) / 100).toFixed(2)}`;
  return [
    `PARTNER STATEMENT ${month} (${partner.name})`,
    "This is a statement of commission, NOT a tax invoice. The recipient created tax invoice (RCTI) is pending lawyer review (GATE3).",
    `Commission earned: ${aud(sum("commission"))}`,
    `Refund clawbacks: ${aud(sum("clawback"))}`,
    `Payouts: ${aud(sum("payout", "payout_reversal"))}`,
    `Net movement: ${aud(inMonth.reduce((n, x) => n + x.amountCents, 0))}`,
    "Each ledger line shows the rate version that applied. Partners must disclose that they earn a commission when they recommend TITANOS.",
  ].join("\n");
}

// The operator's tap on a held commission (GATE1). approve releases it and the clawbacks held against it: the ORIGINAL
// 30-day availableAt still applies. reject keeps it held for good (never auto-denied, never silently paid).
export async function resolveHeld(e: EntStore, partnerId: string, entryId: string, approve: boolean): Promise<boolean> {
  const all = await e.ledgerOf(partnerId), c = all.find((x) => x.id === entryId && x.kind === "commission" && x.held);
  if (!c) return false;
  if (!approve) { if (c.holdReasons?.includes("rejected_by_operator")) return true; await e.updateLedger(c.id, { holdReasons: [...(c.holdReasons ?? []), "rejected_by_operator"] }); return true; }
  for (const x of all) if (x.held && x.invoiceId === c.invoiceId && (x.id === c.id || x.kind === "clawback")) await e.updateLedger(x.id, { held: false });
  return true;
}
