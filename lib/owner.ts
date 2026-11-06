// Browser client and view helpers for the owner seat (/app). Pure functions, no model calls.
import { call, type Api } from "@/lib/portal";

export type ProofState = "OPEN" | "PROVEN_FIXED" | "REGRESSED" | "UNKNOWN" | "MONITORING";
export interface OwnerFinding { check: string; state: ProofState; status: string; detail: string; unreadable?: boolean }
export interface OwnerQuest { id: string; check: string; title: string; kind: "auto" | "guided"; severity: "FAIL" | "WARN"; minutesByHand: number; minutesWithPlan: number; xp: number; evidence: string }
export interface OwnerOverview {
  domain: string; level: number; levelName: string; next?: { level: number; name: string; why: string }; badge: { level: number; since: number } | null;
  findings: OwnerFinding[]; quests: { open: OwnerQuest[]; done: OwnerQuest[] }; hours: { hours: number; minutes: number; label: string };
  xp: number; monitor: { active: boolean }; lastScan: { at: number; grade: string; score: number } | null; events: { at: number; kind: string; detail: string }[];
}
export interface DomainRow { id: string; domain: string; level: number; levelName: string; badge: { level: number } | null; openQuests: number; lastScanAt: number | null }

export const listOwnerDomains = (api: Api): Promise<{ domains: DomainRow[] }> => call(api, "GET", "/app/domains");
export const getOverview = (api: Api, id: string): Promise<OwnerOverview> => call(api, "GET", `/app/domains/${id}`);
export const rescan = (api: Api, id: string): Promise<OwnerOverview> => call(api, "POST", `/app/domains/${id}/scan`);
export const oneTapFix = (api: Api, id: string, check: string): Promise<{ result: string; detail: string; fixId: string | null; overview: OwnerOverview }> => call(api, "POST", `/app/domains/${id}/fix`, { check });
export const undoFix = (api: Api, id: string, fixId: string): Promise<OwnerOverview> => call(api, "POST", `/app/domains/${id}/fixes/${fixId}/undo`);
export const reportMarkdown = (api: Api, id: string): Promise<string> => call(api, "GET", `/app/domains/${id}/report?format=md`);

// Plain labels. A state is never worded as fixed unless a re-scan proved it.
export const STATE_LABEL: Record<ProofState, string> = {
  PROVEN_FIXED: "Proven fixed by re-scan",
  REGRESSED: "Fault returned",
  OPEN: "Not fixed yet",
  UNKNOWN: "Could not be read",
  MONITORING: "Passing, watched",
};
export const FIX_RESULT_TEXT: Record<string, string> = {
  proven: "Fixed, and a re-scan proves it.",
  partial: "Improved. A re-scan shows the next step is still open.",
  rolled_back: "We undid that change because the re-scan did not show an improvement. Nothing was left changed.",
  guided: "This one needs a detail only you or your provider has, so we show the steps instead of guessing.",
  no_zone: "Connect your DNS provider to let us apply fixes. Until then, follow the steps.",
  not_open: "Nothing to fix here.",
  unknown_check: "Run a scan first.",
};
export const OWNER_ERRORS: Record<string, string> = {
  scan_too_soon: "A scan just ran. Give it a minute and try again.",
  domain_not_verified: "Verify the domain first.",
  zone_changed_since: "The records changed after our fix, so we left them alone.",
  already_reverted: "That fix was already undone.",
  owner_seat_unavailable: "The owner dashboard is not open yet. Email us and we will run it by hand.",
};
export const levelBar = (level: number) => Array.from({ length: 10 }, (_, i) => i < level);
export const hoursLine = (h: { hours: number; label: string }) => `${h.hours} hours given back (${h.label.split(":")[0].toLowerCase()})`;
export const badgeLine = (o: Pick<OwnerOverview, "badge" | "events">) => o.badge ? `Level ${o.badge.level} badge held` : o.events.some((e) => e.kind === "badge_lost") ? "Badge lost: a fault returned. Fix it to earn it back." : "No badge yet (from Level 3)";
