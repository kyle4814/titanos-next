// F-C4 residual (f97): the dispute and warranty STATE MACHINE. Pure functions over plain data; no store, no clock, no network, no money.
//   OPEN -> EVIDENCE -> RESOLVED_PAID | RESOLVED_REFUNDED;  RESOLVED_PAID -> CLAWBACK (regression inside the warranty window after payout).
// Invariants (each has a property test and a mutation test in test/dispute.test.ts):
//   I1 only the edges in EDGES are legal; anything else is rejected and the case is returned untouched.
//   I2 replay-safe: the same eventId with the same payload is a no-op; the same eventId with a different payload is rejected.
//   I3 every accepted transition (and only those) appends exactly one audit entry; the log is hash chained and append-only.
//   I4 a dispute freezes rank credit: OPEN and EVIDENCE never count; REFUNDED and CLAWBACK are revoked; only RESOLVED_PAID counts.
//   I5 a clawback needs a payout, a regression inside the warranty window, and raises exactly one data-only card (moneyMoved is always false).
//   I6 time never runs backwards inside a case.
// Moving money (refund, transfer back) stays a GATE1 act done elsewhere on a human approval; this module only records and raises cards.
import { createHash } from "node:crypto";

export const WARRANTY_WINDOW_DAYS = 30;   // mirrors attribution.ts / rank.ts (EXAMPLE value until measured)
const DAY = 86_400_000;

export type DState = "OPEN" | "EVIDENCE" | "RESOLVED_PAID" | "RESOLVED_REFUNDED" | "CLAWBACK";
export const STATES: readonly DState[] = ["OPEN", "EVIDENCE", "RESOLVED_PAID", "RESOLVED_REFUNDED", "CLAWBACK"];
export type DKind = "SUBMIT_EVIDENCE" | "RESOLVE_PAID" | "RESOLVE_REFUND" | "REGRESSION";
export const KINDS: readonly DKind[] = ["SUBMIT_EVIDENCE", "RESOLVE_PAID", "RESOLVE_REFUND", "REGRESSION"];

// The legal edges. SUBMIT_EVIDENCE from EVIDENCE is a self loop (more evidence, same state, still one audit entry).
export const EDGES: Readonly<Record<string, DState>> = {
  "OPEN:SUBMIT_EVIDENCE": "EVIDENCE",
  "EVIDENCE:SUBMIT_EVIDENCE": "EVIDENCE",
  "EVIDENCE:RESOLVE_PAID": "RESOLVED_PAID",
  "EVIDENCE:RESOLVE_REFUND": "RESOLVED_REFUNDED",
  "RESOLVED_PAID:REGRESSION": "CLAWBACK",
};

export interface DEvent { eventId: string; kind: DKind; at: number; actor: string; detail?: string; regressedAt?: number }
export interface AuditEntry { seq: number; eventId: string; kind: DKind | "OPEN" | "IMPORT_PAID"; from: DState | null; to: DState; at: number; actor: string; detail: string; payloadHash: string; prev: string; hash: string }
export interface ClawbackCard { id: string; kind: "clawback_review"; jobId: string; amountCents: number; reason: string; createdAt: number; resolved: false; moneyMoved: false }
export interface DisputeCase {
  jobId: string; amountCents: number; state: DState; openedAt: number; actor: string;
  proofAt?: number;      // the re-scan that proved the fix (start of the warranty window); present for paid imports
  paidAt?: number;       // payout recorded; REGRESSION is only meaningful after this
  evidence: { eventId: string; at: number; actor: string; note: string }[];
  audit: AuditEntry[];
  cards: ClawbackCard[];
  synthetic?: true;
}
export type Result = { ok: true; case: DisputeCase; replay: boolean; card?: ClawbackCard } | { ok: false; reason: string; case: DisputeCase };

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const payloadOf = (e: DEvent) => JSON.stringify([e.kind, e.at, e.actor, e.detail ?? "", e.regressedAt ?? null]);
const GENESIS = "0".repeat(64);
const entryHash = (x: Omit<AuditEntry, "hash">) => sha(JSON.stringify([x.seq, x.eventId, x.kind, x.from, x.to, x.at, x.actor, x.detail, x.payloadHash, x.prev]));

function append(c: DisputeCase, e: { eventId: string; kind: AuditEntry["kind"]; from: DState | null; to: DState; at: number; actor: string; detail: string; payloadHash: string }) {
  const prev = c.audit.length ? c.audit[c.audit.length - 1].hash : GENESIS;
  const body = { seq: c.audit.length + 1, ...e, prev };
  c.audit.push({ ...body, hash: entryHash(body) });
}

// A dispute opens on a claimed or delivered job whose funds are held. Opening is itself audited.
export function openDispute(a: { jobId: string; amountCents: number; at: number; actor: string; eventId: string; reason: string; synthetic?: true }): DisputeCase {
  if (!Number.isInteger(a.amountCents) || a.amountCents < 0) throw new Error("amount_invalid");
  const c: DisputeCase = { jobId: a.jobId, amountCents: a.amountCents, state: "OPEN", openedAt: a.at, actor: a.actor, evidence: [], audit: [], cards: [], ...(a.synthetic ? { synthetic: true as const } : {}) };
  append(c, { eventId: a.eventId, kind: "OPEN", from: null, to: "OPEN", at: a.at, actor: a.actor, detail: a.reason, payloadHash: sha(JSON.stringify(["OPEN", a.at, a.actor, a.reason])) });
  return c;
}

// An undisputed job that was simply paid enters the machine already RESOLVED_PAID, so a later regression can raise a clawback.
export function importPaid(a: { jobId: string; amountCents: number; proofAt: number; paidAt: number; actor: string; eventId: string; synthetic?: true }): DisputeCase {
  if (!Number.isInteger(a.amountCents) || a.amountCents < 0) throw new Error("amount_invalid");
  if (a.paidAt < a.proofAt) throw new Error("paid_before_proof");
  const c: DisputeCase = { jobId: a.jobId, amountCents: a.amountCents, state: "RESOLVED_PAID", openedAt: a.paidAt, actor: a.actor, proofAt: a.proofAt, paidAt: a.paidAt, evidence: [], audit: [], cards: [], ...(a.synthetic ? { synthetic: true as const } : {}) };
  append(c, { eventId: a.eventId, kind: "IMPORT_PAID", from: null, to: "RESOLVED_PAID", at: a.paidAt, actor: a.actor, detail: "paid job entered the warranty machine", payloadHash: sha(JSON.stringify(["IMPORT_PAID", a.proofAt, a.paidAt, a.actor])) });
  return c;
}

const reject = (c: DisputeCase, reason: string): Result => ({ ok: false, reason, case: c });

export function apply(input: DisputeCase, e: DEvent): Result {
  if (!e || typeof e.eventId !== "string" || !e.eventId) return reject(input, "event_id_required");
  if (!KINDS.includes(e.kind)) return reject(input, "unknown_event_kind");
  if (!Number.isFinite(e.at)) return reject(input, "time_invalid");
  const ph = sha(payloadOf(e));
  const seen = input.audit.find((x) => x.eventId === e.eventId);
  if (seen) return seen.payloadHash === ph ? { ok: true, case: input, replay: true } : reject(input, "event_id_reused_with_different_payload");   // I2
  const to = EDGES[`${input.state}:${e.kind}`];
  if (!to) return reject(input, `illegal_transition:${input.state}:${e.kind}`);   // I1
  const last = input.audit[input.audit.length - 1];
  if (last && e.at < last.at) return reject(input, "time_runs_backwards");   // I6

  const c = structuredClone(input);
  let card: ClawbackCard | undefined;
  if (e.kind === "SUBMIT_EVIDENCE") {
    const note = (e.detail ?? "").trim(); if (!note) return reject(input, "evidence_empty");
    c.evidence.push({ eventId: e.eventId, at: e.at, actor: e.actor, note });
  } else if (e.kind === "RESOLVE_PAID") {
    c.paidAt = e.at; c.proofAt ??= e.at;   // payout is released at resolution; the warranty clock starts at the proof (or now if no earlier proof is recorded)
  } else if (e.kind === "RESOLVE_REFUND") {
    /* data only: the refund itself is a GATE1 act elsewhere */
  } else if (e.kind === "REGRESSION") {
    const r = e.regressedAt ?? e.at;
    if (c.paidAt === undefined || c.proofAt === undefined) return reject(input, "no_payout_to_claw_back");   // I5
    if (r < c.proofAt) return reject(input, "regression_before_proof");
    if (r - c.proofAt > WARRANTY_WINDOW_DAYS * DAY) return reject(input, "outside_warranty_window");   // a new fault, not a clawback
    if (r > e.at) return reject(input, "regression_in_the_future");
    card = { id: `cb_${c.jobId}`, kind: "clawback_review", jobId: c.jobId, amountCents: c.amountCents, reason: `regression ${Math.floor((r - c.proofAt) / DAY)} days after the proof inside the ${WARRANTY_WINDOW_DAYS} day warranty. Approving records it; no money moves here.`, createdAt: e.at, resolved: false, moneyMoved: false };
    c.cards.push(card);
  }
  const from = c.state; c.state = to;
  append(c, { eventId: e.eventId, kind: e.kind, from, to, at: e.at, actor: e.actor, detail: e.detail ?? "", payloadHash: ph });   // I3
  return { ok: true, case: c, replay: false, ...(card ? { card } : {}) };
}

// I4: what the case means for the pro's rank. Disputed work earns nothing until it resolves in the pro's favour.
export type RankCredit = "counts" | "frozen" | "revoked";
export function rankCredit(c: Pick<DisputeCase, "state">): RankCredit {
  switch (c.state) {
    case "OPEN": case "EVIDENCE": return "frozen";
    case "RESOLVED_PAID": return "counts";
    case "RESOLVED_REFUNDED": case "CLAWBACK": return "revoked";
  }
}

// I3 verifier: recompute every hash and link. Returns the first broken seq, or null when intact.
export function verifyAudit(c: DisputeCase): number | null {
  let prev = GENESIS;
  for (let i = 0; i < c.audit.length; i++) {
    const { hash, ...rest } = c.audit[i];
    if (rest.seq !== i + 1 || rest.prev !== prev || entryHash(rest) !== hash) return i + 1;
    prev = hash;
  }
  return null;
}
