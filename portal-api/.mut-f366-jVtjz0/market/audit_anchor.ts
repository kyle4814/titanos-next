// F-C4 residual (f102): anchor the dispute audit head hashes OUTSIDE the case, so a rewritten-whole-case is caught.
// Why: verifyAudit (dispute.ts) only proves a case is internally consistent. Whoever can edit the case can edit an entry and
// recompute every later hash, and verifyAudit still passes. An anchor is a copy of (jobId, seq, head) held in a separate
// append-only store; a recomputed chain no longer matches it.
// Invariants (each has a test and a mutation test in test/audit_anchor.test.ts):
//   A1 append-only: a (jobId, seq) is written once; a different head for the same key is rejected, never overwritten.
//   A2 idempotent: the same (jobId, seq, head) again is a no-op ("replay"), not an error and not a second row.
//   A3 contiguous: the next anchor for a job is seq = last + 1 (no gaps), so a hole cannot hide a rewrite.
//   A4 a recomputed chain (rewrite) is caught at the first anchored seq whose hash differs.
//   A5 truncation below the latest anchor is caught.
//   A6 an unanchored case is NOT reported as verified (UNKNOWN is never zero).
// Honest limit: entries appended after the latest anchor, and a truncation only back to the latest anchor, are not detectable.
// Anchor every head right after each accepted transition. Whoever can write BOTH the case and the anchor store defeats this.
import type { D1Like } from "../env.ts";
import { verifyAudit, type DisputeCase } from "./dispute.ts";

export interface Anchor { jobId: string; seq: number; head: string; at: number }
export type AnchorResult = { ok: true; replay: boolean } | { ok: false; reason: "anchor_conflict" | "anchor_gap" | "anchor_invalid" };
export interface AnchorStore {
  /** Append one anchor. Never overwrites. */
  append(a: Anchor): Promise<AnchorResult>;
  /** All anchors for a job, ordered by seq. */
  list(jobId: string): Promise<Anchor[]>;
}

const valid = (a: Anchor) => typeof a.jobId === "string" && a.jobId !== "" && Number.isInteger(a.seq) && a.seq >= 1 && /^[0-9a-f]{64}$/.test(a.head) && Number.isFinite(a.at);

export class MemoryAnchorStore implements AnchorStore {
  private m = new Map<string, Anchor[]>();
  async append(a: Anchor): Promise<AnchorResult> {
    if (!valid(a)) return { ok: false, reason: "anchor_invalid" };
    const l = this.m.get(a.jobId) ?? [];
    const have = l[a.seq - 1];
    if (have) return have.head === a.head ? { ok: true, replay: true } : { ok: false, reason: "anchor_conflict" };   // A1, A2
    if (a.seq !== l.length + 1) return { ok: false, reason: "anchor_gap" };   // A3
    l.push({ ...a }); this.m.set(a.jobId, l);
    return { ok: true, replay: false };
  }
  async list(jobId: string) { return (this.m.get(jobId) ?? []).map((x) => ({ ...x })); }
}

// D1-shaped adapter, written against migrations/0006_audit_anchor.sql. Tested against a fake only; never applied live.
export class D1AnchorStore implements AnchorStore {
  private db: D1Like;
  constructor(db: D1Like) { this.db = db; }
  async list(jobId: string) {
    const r = await this.db.prepare("SELECT job_id, seq, head, anchored_at FROM audit_anchor WHERE job_id = ? ORDER BY seq").bind(jobId).all<Record<string, unknown>>();
    return r.results.map((x) => ({ jobId: String(x.job_id), seq: Number(x.seq), head: String(x.head), at: Number(x.anchored_at) }));
  }
  async append(a: Anchor): Promise<AnchorResult> {
    if (!valid(a)) return { ok: false, reason: "anchor_invalid" };
    // One conditional INSERT: only when seq is exactly last+1. rows changed tells us; never read-then-write.
    const ins = await this.db.prepare(
      `INSERT INTO audit_anchor (job_id, seq, head, anchored_at)
       SELECT ?, ?, ?, ? WHERE ? = (SELECT COALESCE(MAX(seq), 0) + 1 FROM audit_anchor WHERE job_id = ?)
       ON CONFLICT(job_id, seq) DO NOTHING`,
    ).bind(a.jobId, a.seq, a.head, a.at, a.seq, a.jobId).run();
    if (Number((ins as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1) return { ok: true, replay: false };
    const have = await this.db.prepare("SELECT head FROM audit_anchor WHERE job_id = ? AND seq = ?").bind(a.jobId, a.seq).first<{ head: string }>();
    if (have) return String(have.head) === a.head ? { ok: true, replay: true } : { ok: false, reason: "anchor_conflict" };
    return { ok: false, reason: "anchor_gap" };
  }
}

/** Anchor every not-yet-anchored head of a case, in order. Refuses a case whose own chain is already broken. */
export async function anchorCase(store: AnchorStore, c: DisputeCase, at: number): Promise<{ ok: true; anchored: number } | { ok: false; reason: string }> {
  const broken = verifyAudit(c); if (broken !== null) return { ok: false, reason: `chain_broken_at_${broken}` };
  const have = await store.list(c.jobId);
  // The anchored prefix must already agree with the case, or we would be blessing a rewrite as new history.
  for (const a of have) { if (!c.audit[a.seq - 1] || c.audit[a.seq - 1].hash !== a.head) return { ok: false, reason: `anchor_mismatch_at_${a.seq}` }; }
  let n = 0;
  for (let i = have.length; i < c.audit.length; i++) {
    const r = await store.append({ jobId: c.jobId, seq: c.audit[i].seq, head: c.audit[i].hash, at });
    if (!r.ok) return { ok: false, reason: r.reason };
    if (!r.replay) n++;
  }
  return { ok: true, anchored: n };
}

export type AnchorVerdict =
  | { ok: true; anchoredThrough: number; unanchoredTail: number }
  | { ok: false; reason: "chain_broken" | "truncated" | "head_mismatch" | "unanchored"; seq?: number };

/** verifyAudit PLUS the external anchors. Catches a recomputed (rewritten) chain and truncation. */
export async function verifyAnchored(store: AnchorStore, c: DisputeCase): Promise<AnchorVerdict> {
  const broken = verifyAudit(c); if (broken !== null) return { ok: false, reason: "chain_broken", seq: broken };
  const anchors = await store.list(c.jobId);
  if (anchors.length === 0) return { ok: false, reason: "unanchored" };   // A6
  for (const a of anchors) {
    const e = c.audit[a.seq - 1];
    if (!e) return { ok: false, reason: "truncated", seq: a.seq };   // A5
    if (e.hash !== a.head) return { ok: false, reason: "head_mismatch", seq: a.seq };   // A4
  }
  const through = anchors[anchors.length - 1].seq;
  return { ok: true, anchoredThrough: through, unanchoredTail: c.audit.length - through };
}
