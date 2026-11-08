// Rank is a pure function of PROVEN fixes. Its only input is the list of jobs: there is no rating, review, stars,
// message or self-report field anywhere in the type, so none can move it (test/market.test.ts pins this).
// A fix counts only if a re-scan showed the fault gone (job.proof). A fix that came back inside the warranty window
// stops counting. Weights are EXAMPLE values until measured.
import type { Job } from "./store.ts";
import { washTradeFlags } from "./attribution.ts";

export const WARRANTY_DAYS = 30;
export const WEIGHT: Record<Job["severity"], number> = { FAIL: 3, WARN: 1 };
export const TIERS = [{ name: "Platinum", min: 80 }, { name: "Gold", min: 30 }, { name: "Silver", min: 10 }, { name: "Bronze", min: 1 }] as const;
export interface Rank { points: number; tier: string; provenFixes: number; holding: number; regressed: number; abandoned: number; washExcluded: number; holdRate: number | null; note: string }

export function rankFor(proAccountId: string, jobs: Job[]): Rank {
  let points = 0, proven = 0, regressed = 0, holding = 0, abandoned = 0, washExcluded = 0;
  const wash = washTradeFlags(jobs);   // linked payer/email pairs repeating jobs: still paid, never ranked (F-C4)
  for (const j of jobs) {
    if (j.abandonedBy.includes(proAccountId)) abandoned++;
    if (j.proAccountId !== proAccountId || !j.proof || !(j.status === "paid" || j.status === "reproved")) continue;
    if (wash.has(j.id)) { washExcluded++; continue; }
    proven++;
    if (j.regressedAt) { regressed++; continue; }
    holding++; points += WEIGHT[j.severity];
  }
  const tier = TIERS.find((t) => points >= t.min)?.name ?? "Unranked";
  return { points, tier, provenFixes: proven, holding, regressed, abandoned, washExcluded, holdRate: proven ? Math.round((holding / proven) * 1000) / 10 : null, note: "Rank counts fixes a re-scan proved and that are still holding. Reviews and ratings do not exist in this system." };
}
