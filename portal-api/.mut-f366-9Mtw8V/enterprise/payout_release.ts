// C8 f54: operator release / refund of a HELD payout. PURE and MOCK ONLY: neither operation ever calls the transfer adapter
// (a release only re-queues; the retry executor sends later, under its own gates). No Stripe, no network, no scheduler.
// Rules: (1) only a row in status "held" moves, by compare-and-set, so a double tap or a release/refund race has one winner;
// (2) release: held -> approved_retry, attempts reset to 0, the hold reason and the operator note are kept, releasedAt set;
// (3) refund: held -> refunded, plus ONE positive payout_reversal ledger entry that cancels the negative payout entry
// (uniq payout_reversal:<id>, so a repeat adds nothing; a replay heals a crash between the CAS and the ledger write);
// (4) a repeat of the same action is a no-op success (replayed); the opposite action after a terminal one is refused;
// (5) tenant is mandatory; another tenant's payout looks absent. Fail closed: a refund with no original payout entry moves nothing.
import type { EntStore } from "./store.ts";
import type { Payout } from "./types.ts";

export type ReleaseRefusal = "not_found" | "wrong_state" | "already_refunded" | "ledger_entry_missing" | "tenant_required";
export type ReleaseResult =
  | { ok: true; outcome: "applied" | "replayed"; action: "release" | "refund"; payout: Payout }
  | { ok: false; refused: ReleaseRefusal; payout?: Payout };
export interface ReleaseEnv { store: EntStore; now: number; newId: () => string }
export interface ReleaseReq { payoutId: string; tenantId: string; note?: string }

export const cleanNote = (s: unknown) => (typeof s === "string" ? s.replace(/[^A-Za-z0-9 .,'-]/g, "").trim().slice(0, 200) : "");

async function load(env: ReleaseEnv, req: ReleaseReq): Promise<{ p: Payout } | { refused: ReleaseResult }> {
  if (typeof req.tenantId !== "string" || req.tenantId === "") return { refused: { ok: false, refused: "tenant_required" } };
  const p = await env.store.payoutById(req.payoutId);
  if (!p || p.partnerId !== req.tenantId) return { refused: { ok: false, refused: "not_found" } }; // another tenant's id looks absent
  return { p };
}

export async function releaseHeldPayout(env: ReleaseEnv, req: ReleaseReq): Promise<ReleaseResult> {
  const l = await load(env, req);
  if ("refused" in l) return l.refused;
  const p0 = l.p;
  if (p0.status === "refunded") return { ok: false, refused: "already_refunded", payout: p0 };
  if (p0.status !== "held") {
    // a repeat tap: this row was already released (and has moved on, or not yet been picked up)
    if (p0.releasedAt !== undefined && p0.refundedAt === undefined) return { ok: true, outcome: "replayed", action: "release", payout: p0 };
    return { ok: false, refused: "wrong_state", payout: p0 };
  }
  // a row held AGAIN after an earlier release is a fresh hold (heldAt is newer): that release is a new, legitimate action
  const note = cleanNote(req.note);
  const won = await env.store.transitionPayout(p0.id, "held", "approved_retry", { attempts: 0, releasedAt: env.now, ...(note ? { operatorNote: note } : {}) }); // fields land with the claim, so a loser sees a finished row
  if (!won) { // lost a race: re-read and answer from the winner's state
    const now = await env.store.payoutById(p0.id);
    if (now?.status === "refunded") return { ok: false, refused: "already_refunded", payout: now };
    if (now && now.releasedAt !== undefined) return { ok: true, outcome: "replayed", action: "release", payout: now };
    return { ok: false, refused: "wrong_state", payout: now };
  }
  return { ok: true, outcome: "applied", action: "release", payout: { ...won } }; // reason (why it was held) stays
}

export async function refundHeldPayout(env: ReleaseEnv, req: ReleaseReq): Promise<ReleaseResult> {
  const l = await load(env, req);
  if ("refused" in l) return l.refused;
  const p0 = l.p;
  const original = (await env.store.ledgerOf(p0.partnerId)).find((e) => e.kind === "payout" && e.payoutId === p0.id && e.amountCents < 0);
  if (p0.status === "refunded") { await reverse(env, p0, original); return { ok: true, outcome: "replayed", action: "refund", payout: p0 }; }
  if (p0.status !== "held") return { ok: false, refused: "wrong_state", payout: p0 };
  if (!original) return { ok: false, refused: "ledger_entry_missing", payout: p0 }; // nothing to reverse: do not mark it refunded
  const note = cleanNote(req.note);
  const won = await env.store.transitionPayout(p0.id, "held", "refunded", { refundedAt: env.now, ...(note ? { operatorNote: note } : {}) });
  if (!won) {
    const now = await env.store.payoutById(p0.id);
    if (now?.status === "refunded") { await reverse(env, now, original); return { ok: true, outcome: "replayed", action: "refund", payout: now }; }
    return { ok: false, refused: "wrong_state", payout: now };
  }
  await reverse(env, won, original);
  return { ok: true, outcome: "applied", action: "refund", payout: { ...won } };
}

// Adds the one reversing entry (idempotent on uniq). Amount is exactly the negative of the original payout entry, so the pair nets to zero.
async function reverse(env: ReleaseEnv, p: Payout, original: { amountCents: number } | undefined) {
  if (!original) return;
  await env.store.addLedger({ id: env.newId(), uniq: `payout_reversal:${p.id}`, partnerId: p.partnerId, kind: "payout_reversal", amountCents: -original.amountCents, at: env.now, availableAt: env.now, payoutId: p.id });
}
