import type { Obs, Clawback } from "./attribution.ts";
import type { DisputeCase } from "./dispute.ts";
// C4 marketplace state. MemoryMarketStore is the test/local adapter; a D1 adapter is NOT BUILT (migration 0004 defines
// the tables, state kept as one JSON row per job/pro like the owner seat). Until then the Worker fails closed.
export type JobStatus = "awaiting_funds" | "open" | "claimed" | "delivered" | "reproved" | "paid" | "disputed" | "cancelled" | "refunded";
export type Tier = "small" | "standard" | "large";
export interface Proof { scanId: string; at: number; baseline: string; now: string; detail: string }
export interface Payout { status: "pending_review" | "paid"; amountCents: number; transferId?: string; cardId?: string; at?: number }
export interface Job {
  id: string; ownerAccountId: string; domainId: string; domain: string; check: string; severity: "FAIL" | "WARN"; tier: Tier;
  priceCents: number; claimFeeCents: number; status: JobStatus; createdAt: number; updatedAt: number;
  baseline: { at: number; status: string; detail: string };
  checkoutId?: string; paymentIntent?: string; fundedAt?: number;
  proAccountId?: string; claimedAt?: number; claimDeadline?: number; claimFeeRef?: string; abandonedBy: string[];
  deliveredAt?: number; deliveryNote?: string; rescans: number; lastRescan?: { at: number; status: string; detail: string };
  proof?: Proof; payout?: Payout; refundRef?: string;
  dispute?: { at: number; by: string; reason: string; priorStatus: "claimed" | "delivered"; cardId: string; resolvedAt?: number; outcome?: string };
  // F-C4 attribution: observations of the check (who saw it fixed, and when), payer/email link keys for wash-trade detection, the clawback ledger, and a denied-card memory.
  observations?: Obs[]; attribution?: { verdict: "withheld"; reason: string; evidenceAt?: number; evidenceSrc?: string; at: number };
  payerFp?: string; proPayerFp?: string; ownerEmailDomain?: string; proEmailDomain?: string;
  disputeCase?: DisputeCase; disputeArchive?: DisputeCase[];   // f99: the verified machine (dispute.ts) is the record; `dispute` above stays the owner-facing view
  clawbacks?: Clawback[]; payoutDenied?: { at: number; cardId: string; proofKey: string };
  regressedAt?: number; warrantyChecks: number; warrantyOkAt?: number; events: { at: number; kind: string; detail: string }[];
}
export interface ProProfile { accountId: string; joinedAt: number; connectAccountId?: string; onboarded: boolean; plan: "payg" | "seat"; display: string }
export interface MarketCard { id: string; kind: "payout_review" | "dispute" | "clawback_review"; jobId: string; reason: string; createdAt: number; resolved: boolean; outcome?: string }
export interface MarketStore {
  getJob(id: string): Promise<Job | undefined>; putJob(j: Job): Promise<void>; allJobs(): Promise<Job[]>;
  // Indexed reads (hot paths must not call allJobs). Every result is in the SAME order allJobs() would give (first-insert order).
  // D1 (NOT BUILT): jobsByOwner = WHERE owner_account_id=?; jobsByPro = WHERE pro_account_id=?; jobsTouchingPro = jobsByPro UNION jobs whose
  // abandoned_by JSON contains the id (use a job_abandoned(job_id, pro_id) side table, indexed on pro_id); jobsByStatus = WHERE status IN (...);
  // jobsByDomain = WHERE domain_id=?. Indexes: (owner_account_id), (pro_account_id), (status), (domain_id), ORDER BY rowid.
  // view=true: read-only snapshot WITHOUT the defensive clone (the caller must not mutate or retain it). Every caller that only reads (rank, payouts,
  // board, caps, deletion guard) passes it: cloning every job per request was the remaining linear cost. D1 ignores the flag (rows are fresh).
  jobsByOwner(accountId: string, view?: boolean): Promise<Job[]>; jobsByPro(accountId: string, view?: boolean): Promise<Job[]>; jobsTouchingPro(accountId: string, view?: boolean): Promise<Job[]>;
  jobsByStatus(statuses: JobStatus[], view?: boolean): Promise<Job[]>; jobsByDomain(domainId: string, view?: boolean): Promise<Job[]>;
  // Compare-and-set: writes j only if the stored status is one of `from`. D1: UPDATE ... WHERE id=? AND status IN (...). The ONLY safe way to claim or pay.
  transition(from: JobStatus[], j: Job): Promise<boolean>;
  getPro(accountId: string): Promise<ProProfile | undefined>; putPro(p: ProProfile): Promise<void>; allPros(): Promise<ProProfile[]>;
  putCard(c: MarketCard): Promise<void>; getCard(id: string): Promise<MarketCard | undefined>; openCards(): Promise<MarketCard[]>;
}
export class MemoryMarketStore implements MarketStore {
  jobs = new Map<string, Job>(); pros = new Map<string, ProProfile>(); cards = new Map<string, MarketCard>();
  // Secondary indexes: key -> job ids. Rebuilt per job on every write (reindex), so they can never drift from `jobs`.
  private seq = new Map<string, number>(); private nextSeq = 0;
  private byOwner = new Map<string, Set<string>>(); private byPro = new Map<string, Set<string>>(); private byAbandoned = new Map<string, Set<string>>();
  private byStatus = new Map<string, Set<string>>(); private byDomain = new Map<string, Set<string>>();
  private keys(j: Job): [Map<string, Set<string>>, string][] {
    const k: [Map<string, Set<string>>, string][] = [[this.byOwner, j.ownerAccountId], [this.byStatus, j.status], [this.byDomain, j.domainId]];
    if (j.proAccountId) k.push([this.byPro, j.proAccountId]);
    for (const x of j.abandonedBy) k.push([this.byAbandoned, x]);
    return k;
  }
  private reindex(old: Job | undefined, j: Job) {
    if (old) for (const [m, key] of this.keys(old)) { const s = m.get(key); if (s) { s.delete(j.id); if (!s.size) m.delete(key); } }
    for (const [m, key] of this.keys(j)) { let s = m.get(key); if (!s) m.set(key, s = new Set()); s.add(j.id); }
    if (!this.seq.has(j.id)) this.seq.set(j.id, this.nextSeq++);
  }
  private put(j: Job) { this.reindex(this.jobs.get(j.id), j); this.jobs.set(j.id, structuredClone(j)); }
  private pull(ids: Iterable<string>, view = false): Job[] {
    const out: Job[] = []; for (const id of ids) { const j = this.jobs.get(id); if (j) out.push(j); }
    out.sort((x, y) => this.seq.get(x.id)! - this.seq.get(y.id)!);
    return view ? out : out.map((j) => structuredClone(j));
  }
  async getJob(id: string) { const j = this.jobs.get(id); return j ? structuredClone(j) : undefined; }
  async putJob(j: Job) { this.put(j); }
  async transition(from: JobStatus[], j: Job) { const cur = this.jobs.get(j.id); if (!cur || !from.includes(cur.status)) return false; this.put(j); return true; }
  async allJobs() { return [...this.jobs.values()].map((j) => structuredClone(j)); }
  async jobsByOwner(id: string, view = false) { return this.pull(this.byOwner.get(id) ?? [], view); }
  async jobsByPro(id: string, view = false) { return this.pull(this.byPro.get(id) ?? [], view); }
  async jobsTouchingPro(id: string, view = false) { return this.pull(new Set([...(this.byPro.get(id) ?? []), ...(this.byAbandoned.get(id) ?? [])]), view); }
  async jobsByStatus(st: JobStatus[], view = false) { return this.pull(st.flatMap((x) => [...(this.byStatus.get(x) ?? [])]), view); }
  async jobsByDomain(id: string, view = false) { return this.pull(this.byDomain.get(id) ?? [], view); }
  async getPro(id: string) { const p = this.pros.get(id); return p ? structuredClone(p) : undefined; }
  async putPro(p: ProProfile) { this.pros.set(p.accountId, structuredClone(p)); }
  async allPros() { return [...this.pros.values()].map((p) => structuredClone(p)); }
  async putCard(c: MarketCard) { this.cards.set(c.id, structuredClone(c)); }
  async getCard(id: string) { const c = this.cards.get(id); return c ? structuredClone(c) : undefined; }
  async openCards() { return [...this.cards.values()].filter((c) => !c.resolved).map((c) => structuredClone(c)); }
}
