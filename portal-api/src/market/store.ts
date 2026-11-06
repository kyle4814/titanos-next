import type { Obs, Clawback } from "./attribution.ts";
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
  clawbacks?: Clawback[]; payoutDenied?: { at: number; cardId: string; proofKey: string };
  regressedAt?: number; warrantyChecks: number; warrantyOkAt?: number; events: { at: number; kind: string; detail: string }[];
}
export interface ProProfile { accountId: string; joinedAt: number; connectAccountId?: string; onboarded: boolean; plan: "payg" | "seat"; display: string }
export interface MarketCard { id: string; kind: "payout_review" | "dispute" | "clawback_review"; jobId: string; reason: string; createdAt: number; resolved: boolean; outcome?: string }
export interface MarketStore {
  getJob(id: string): Promise<Job | undefined>; putJob(j: Job): Promise<void>; allJobs(): Promise<Job[]>;
  // Compare-and-set: writes j only if the stored status is one of `from`. D1: UPDATE ... WHERE id=? AND status IN (...). The ONLY safe way to claim or pay.
  transition(from: JobStatus[], j: Job): Promise<boolean>;
  getPro(accountId: string): Promise<ProProfile | undefined>; putPro(p: ProProfile): Promise<void>; allPros(): Promise<ProProfile[]>;
  putCard(c: MarketCard): Promise<void>; getCard(id: string): Promise<MarketCard | undefined>; openCards(): Promise<MarketCard[]>;
}
export class MemoryMarketStore implements MarketStore {
  jobs = new Map<string, Job>(); pros = new Map<string, ProProfile>(); cards = new Map<string, MarketCard>();
  async getJob(id: string) { const j = this.jobs.get(id); return j ? structuredClone(j) : undefined; }
  async putJob(j: Job) { this.jobs.set(j.id, structuredClone(j)); }
  async transition(from: JobStatus[], j: Job) { const cur = this.jobs.get(j.id); if (!cur || !from.includes(cur.status)) return false; this.jobs.set(j.id, structuredClone(j)); return true; }
  async allJobs() { return [...this.jobs.values()].map((j) => structuredClone(j)); }
  async getPro(id: string) { const p = this.pros.get(id); return p ? structuredClone(p) : undefined; }
  async putPro(p: ProProfile) { this.pros.set(p.accountId, structuredClone(p)); }
  async allPros() { return [...this.pros.values()].map((p) => structuredClone(p)); }
  async putCard(c: MarketCard) { this.cards.set(c.id, structuredClone(c)); }
  async getCard(id: string) { const c = this.cards.get(id); return c ? structuredClone(c) : undefined; }
  async openCards() { return [...this.cards.values()].filter((c) => !c.resolved).map((c) => structuredClone(c)); }
}
