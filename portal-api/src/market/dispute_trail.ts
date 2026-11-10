// F-C4 residual (f103): wire the dispute state machine (dispute.ts) and the audit-head anchors (audit_anchor.ts) into the market service.
// Every dispute case write (open, evidence, resolve) goes through commit(): apply the event, store the case, anchor the new head(s).
// Invariants (tests in test/dispute_trail.test.ts, mutants in test/mutate_dispute_trail.mjs):
//   W1 fail closed: if an anchor write fails, the case is restored to the last fully anchored state and commit() throws; the caller undoes its own write.
//   W2 every accepted head is anchored before the write is acknowledged (no unanchored tail after a normal lifecycle).
//   W3 the read verdict is verifyAnchored; a case with no anchors is "unanchored", never "verified".
// Honest limit: the case store and the anchor store are two objects here; whoever writes BOTH defeats the anchor (separate trust domain = GATE5).
import { apply, openDispute, verifyAudit, type DEvent, type DisputeCase } from "./dispute.ts";
import { anchorCase, MemoryAnchorStore, verifyAnchored, type AnchorStore, type AnchorVerdict } from "./audit_anchor.ts";

export interface DisputeCaseStore { get(jobId: string): Promise<DisputeCase | undefined>; put(c: DisputeCase): Promise<void>; delete(jobId: string): Promise<void> }
export class MemoryDisputeCaseStore implements DisputeCaseStore {
  private m = new Map<string, DisputeCase>();
  async get(id: string) { const c = this.m.get(id); return c ? structuredClone(c) : undefined; }
  async put(c: DisputeCase) { this.m.set(c.jobId, structuredClone(c)); }
  async delete(id: string) { this.m.delete(id); }
}
export interface DisputeTrail { cases: DisputeCaseStore; anchors: AnchorStore }
export const memoryTrail = (): DisputeTrail => ({ cases: new MemoryDisputeCaseStore(), anchors: new MemoryAnchorStore() });
export class TrailError extends Error { reason: string; constructor(reason: string) { super(reason); this.reason = reason; } }

export type Step = { open: { jobId: string; amountCents: number; at: number; actor: string; eventId: string; reason: string } } | { event: DEvent };

/** Apply the steps in order. Each step stores the case then anchors its head. On any failure the case returns to the last anchored state and this throws. */
export async function commit(t: DisputeTrail, jobId: string, steps: Step[], at: number): Promise<DisputeCase> {
  const start = await t.cases.get(jobId);
  let good = start;                                  // last fully anchored case (or none)
  let cur = start;
  const restore = async () => { if (good) await t.cases.put(good); else await t.cases.delete(jobId); };
  try {
    for (const s of steps) {
      if ("open" in s) { if (cur) throw new TrailError("case_exists"); cur = openDispute(s.open); }
      else { if (!cur) throw new TrailError("no_case"); const r = apply(cur, s.event); if (!r.ok) throw new TrailError(r.reason); cur = r.case; }
      await t.cases.put(cur);
      const a = await anchorCase(t.anchors, cur, at);
      if (!a.ok) throw new TrailError(`anchor_failed:${a.reason}`);
      good = cur;
    }
  } catch (e) {
    await restore().catch(() => { /* a failed restore leaves the case verifiable as head_mismatch/truncated, never silently verified */ });
    throw e instanceof TrailError ? e : new TrailError("anchor_failed:store_error");
  }
  return cur!;
}

export interface TrailReport { jobId: string; state: string; entries: number; verdict: AnchorVerdict }
export async function report(t: DisputeTrail, jobId: string): Promise<TrailReport | undefined> {
  const c = await t.cases.get(jobId); if (!c) return undefined;
  let verdict: AnchorVerdict;
  try { verdict = await verifyAnchored(t.anchors, c); } catch { verdict = { ok: false, reason: "unanchored" }; }
  return { jobId, state: c.state, entries: c.audit.length, verdict };
}
export { verifyAudit };
