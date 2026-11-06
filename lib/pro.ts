// Browser client for the Pro seat and marketplace (C4). Pure functions over lib/portal.ts `call`, so
// scripts/test_pro_seat.mjs can check them without a browser. No model calls anywhere.
import { call, type Api } from "@/lib/portal";

export interface BoardJob { id: string; domainMasked: string; check: string; severity: "FAIL" | "WARN"; tier: string; payCents: number; claimFeeCents: number; postedAt: number; note: string }
export interface ProJob { id: string; domain: string; check: string; severity: string; tier: string; payCents: number; status: string; claimDeadline: number | null; deliveredAt: number | null; rescans: number; lastRescan: { at: number; status: string; detail: string } | null; proof: { scanId: string; at: number; detail: string } | null; payout: { status: string; amountCents: number } | null; regressedAt: number | null }
export interface OwnerJob { id: string; domain: string; check: string; priceCents: number; status: string; proof: ProJob["proof"]; payout: ProJob["payout"]; lastRescan: ProJob["lastRescan"] }
export interface RankView { display: string; points: number; tier: string; provenFixes: number; holding: number; regressed: number; abandoned: number; holdRate: number | null; note: string }
export interface PayoutsView { paidCents: number; pendingReviewCents: number; waitingForProofCents: number; frozenByDisputeCents: number; paid: { jobId: string; domain: string; amountCents: number }[]; rule: string }

export const joinPro = (api: Api, display: string, plan: "payg" | "seat") => call(api, "POST", "/pro/join", { acceptTerms: true, display, plan });
export const startOnboarding = (api: Api): Promise<{ url: string }> => call(api, "POST", "/pro/onboarding");
export const refreshOnboarding = (api: Api) => call(api, "POST", "/pro/onboarding/refresh");
export const getBoard = (api: Api): Promise<{ jobs: BoardJob[]; onboarded: boolean; activeClaims: number }> => call(api, "GET", "/pro/board");
export const claimJob = (api: Api, id: string): Promise<ProJob> => call(api, "POST", `/pro/jobs/${id}/claim`);
export const deliverJob = (api: Api, id: string, note: string): Promise<{ job: ProJob; reproved: boolean }> => call(api, "POST", `/pro/jobs/${id}/deliver`, { note });
export const getRank = (api: Api): Promise<RankView> => call(api, "GET", "/pro/rank");
export const getPayouts = (api: Api): Promise<PayoutsView> => call(api, "GET", "/pro/payouts");
export const getMyJobs = (api: Api): Promise<{ asOwner: OwnerJob[]; asPro: ProJob[] }> => call(api, "GET", "/market/jobs");
export const hireAPro = (api: Api, domainId: string, check: string): Promise<{ job: OwnerJob; payUrl: string }> => call(api, "POST", "/market/jobs", { domainId, check });
export const rescanJob = (api: Api, id: string) => call(api, "POST", `/market/jobs/${id}/rescan`);
export const disputeJob = (api: Api, id: string, reason: string) => call(api, "POST", `/market/jobs/${id}/dispute`, { reason });
export const cancelJob = (api: Api, id: string) => call(api, "POST", `/market/jobs/${id}/cancel`);
export const getLeaderboard = (api: Api): Promise<{ rows: { display: string; points: number; tier: string; provenFixes: number; holdRate: number | null }[]; basis: string }> => call(api, "GET", "/market/leaderboard", undefined, false);

export const aud = (cents: number) => `AU$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
export const STATUS_LABEL: Record<string, string> = {
  awaiting_funds: "Waiting for payment", open: "Open, waiting for a pro", claimed: "Claimed, work in progress", delivered: "Delivered, not yet confirmed by our re-scan",
  reproved: "Confirmed by re-scan, payout held for review", paid: "Confirmed by re-scan and paid", disputed: "In dispute, money frozen", cancelled: "Cancelled", refunded: "Refunded",
};
export const PRO_ERRORS: Record<string, string> = {
  pro_seat_required: "Join the Pro seat first.", terms_required: "Accept the pro terms to join.", payout_onboarding_required: "Finish payout setup first, so we can always pay you for proven work.",
  cannot_claim_own_job: "You cannot claim a job on your own domain.", job_not_open: "Someone else claimed that job first.", already_fixed: "That fault is already fixed, so there is nothing to claim.",
  too_many_active_claims: "You have 3 jobs in progress. Deliver one first.", claim_fee_failed: "The claim fee could not be collected. The job is still open.", rescan_too_soon: "Wait a minute between re-scans.",
  nothing_to_fix: "That control is passing, so there is nothing to hire for.", job_already_open_for_this_check: "There is already a live job for this fix.", too_many_open_jobs: "You have 10 jobs open. Finish or cancel one first.",
  domain_not_verified: "Verify the domain first.", cannot_cancel_after_claim: "A pro has claimed it. Use dispute if something is wrong.", delivery_note_required: "Say what you changed (a sentence is enough).",
  reason_required: "Tell us what went wrong (a sentence is enough).", market_jobs_active: "You have jobs in progress with money held against them. Settle or cancel them first.", marketplace_unavailable: "The marketplace is not open yet.",
  cannot_read_check: "We could not read that control just now. Try again shortly.", nothing_to_reprove: "Nothing is waiting for a re-scan on that job.",
};
