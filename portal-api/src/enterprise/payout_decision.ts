// C8 f40: maps a Kyle decision (approve / deny) onto the existing payout transitions. MOCK ADAPTER ONLY: the transfer goes
// through the injected PayoutProvider (tests inject MockPayouts); no Stripe, no network. The real transfer is GATE1 (see receipt).
// Rules: (1) a payout reaches "sending" only through an approval record; (2) the record is written first-writer-wins, so a
// repeat tap or a concurrent tap cannot send twice; (3) deny is terminal ("held": the payout ends rejected, the balance goes back,
// the reason is kept); (4) approve after the card expired is refused and nothing moves (deny is always allowed).
import { cardIdFor } from "./payout_card.ts";
import type { EntStore } from "./store.ts";
import type { Payout, PayoutProvider } from "./types.ts";

export const CARD_TTL_MS = 24 * 3_600_000; // a card is good for 24h from the payout's creation; a stale card is never approvable

export type DecisionKind = "approve" | "deny";
export interface ApprovalRecord { payoutId: string; decision: DecisionKind; cardId: string; decidedAt: number; expiresAt: number; reason?: string }
export interface ApprovalStore {
  // ATOMIC first-writer-wins: returns the stored record and whether this call created it. A D1 adapter: INSERT ... ON CONFLICT DO NOTHING then SELECT.
  decide(r: ApprovalRecord): Promise<{ record: ApprovalRecord; created: boolean }>;
  get(payoutId: string): Promise<ApprovalRecord | undefined>;
}
export class MemoryApprovalStore implements ApprovalStore {
  private m = new Map<string, ApprovalRecord>();
  async decide(r: ApprovalRecord) { const e = this.m.get(r.payoutId); if (e) return { record: e, created: false }; this.m.set(r.payoutId, r); return { record: r, created: true }; }
  async get(id: string) { return this.m.get(id); }
}

export interface DecideEnv { store: EntStore; approvals: ApprovalStore; transfer: PayoutProvider; now: number; newId: () => string }
export interface DecideReq { payoutId: string; decision: DecisionKind; tenantId?: string; cardId?: string; reason?: string }
export type Refusal = "not_found" | "wrong_tenant" | "card_mismatch" | "bad_decision" | "wrong_state" | "already_decided" | "expired" | "payout_account_missing";
export type DecideResult =
  | { ok: true; outcome: "applied" | "replayed"; decision: DecisionKind; state: "sending" | "paid" | "failed" | "held" | "rejected" | string; payout: Payout; reason?: string }
  | { ok: false; refused: Refusal; payout?: Payout };

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[^A-Za-z0-9 .,'-]/g, "").trim().slice(0, 120) : "");

export async function decidePayoutRecorded(env: DecideEnv, req: DecideReq): Promise<DecideResult> {
  if (req.decision !== "approve" && req.decision !== "deny") return { ok: false, refused: "bad_decision" };
  const p0 = await env.store.payoutById(req.payoutId);
  if (!p0) return { ok: false, refused: "not_found" };
  if (req.tenantId !== undefined && p0.partnerId !== req.tenantId) return { ok: false, refused: "not_found" }; // another tenant's id looks absent
  const cardId = cardIdFor(p0.id, p0.amountCents);
  if (req.cardId !== undefined && req.cardId !== cardId) return { ok: false, refused: "card_mismatch", payout: p0 };

  // a decision already on record: same decision is a no-op success, the opposite one is refused
  const prior = await env.approvals.get(p0.id);
  if (prior) return prior.decision === req.decision ? replay(p0, prior) : { ok: false, refused: "already_decided", payout: p0 };

  if (p0.status !== "pending_approval") return { ok: false, refused: "wrong_state", payout: p0 };
  const expiresAt = p0.createdAt + CARD_TTL_MS;
  if (req.decision === "approve") {
    if (env.now > expiresAt) return { ok: false, refused: "expired", payout: p0 };
    const t = await env.store.tenantById(p0.partnerId);
    if (!t?.payoutAccount) return { ok: false, refused: "payout_account_missing", payout: p0 };
  }

  const reason = req.decision === "deny" ? clean(req.reason) || "denied" : undefined;
  const { record, created } = await env.approvals.decide({ payoutId: p0.id, decision: req.decision, cardId, decidedAt: env.now, expiresAt, reason });
  if (!created) return record.decision === req.decision ? replay((await env.store.payoutById(p0.id)) ?? p0, record) : { ok: false, refused: "already_decided", payout: p0 };

  // we own the decision. compare-and-set on the payout: only a pending_approval payout moves.
  if (req.decision === "deny") {
    const won = await env.store.transitionPayout(p0.id, "pending_approval", "rejected");
    if (!won) return { ok: false, refused: "wrong_state", payout: p0 };
    await env.store.putPayout({ ...won, reason });
    await env.store.addLedger({ id: env.newId(), uniq: `payout_reversal:${p0.id}`, partnerId: won.partnerId, kind: "payout_reversal", amountCents: won.amountCents, at: env.now, availableAt: env.now, payoutId: p0.id });
    return { ok: true, outcome: "applied", decision: "deny", state: "held", payout: (await env.store.payoutById(p0.id))!, reason };
  }
  const won = await env.store.transitionPayout(p0.id, "pending_approval", "sending"); // the existing sending transition, reachable only after the record above
  if (!won) return { ok: false, refused: "wrong_state", payout: p0 };
  const t = (await env.store.tenantById(p0.partnerId))!;
  await env.store.putPayout({ ...won, sendingAt: env.now }); // age marker for the resume sweep (payout_sweep.ts); the sweep falls back to createdAt if a crash lands before this write
  try {
    const r = await env.transfer.transfer({ partnerId: won.partnerId, accountRef: t.payoutAccount!, amountCents: won.amountCents, idempotencyKey: won.id });
    await env.store.putPayout({ ...won, status: "paid", providerRef: r.ref, sendingAt: env.now });
  } catch {
    await env.store.putPayout({ ...won, status: "failed", reason: "provider_error", sendingAt: env.now });
    await env.store.addLedger({ id: env.newId(), uniq: `payout_reversal:${won.id}`, partnerId: won.partnerId, kind: "payout_reversal", amountCents: won.amountCents, at: env.now, availableAt: env.now, payoutId: won.id });
  }
  const after = (await env.store.payoutById(p0.id))!;
  return { ok: true, outcome: "applied", decision: "approve", state: after.status, payout: after };
}

function replay(p: Payout, r: ApprovalRecord): DecideResult {
  return { ok: true, outcome: "replayed", decision: r.decision, state: r.decision === "deny" ? "held" : p.status, payout: p, reason: r.reason };
}
