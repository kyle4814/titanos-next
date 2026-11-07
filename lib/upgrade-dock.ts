// C7 upgrade dock (f270): PURE logic for the /agents#upgrade-dock section. No fetch, no clock, no random, no Stripe,
// no model call. Input: the account's plan, credits left, spend cap, 30-day calls and key scopes. Output: the ordered
// upgrade options the dock shows. Every AU$ figure comes from lib/pricing.ts (retainers, NUM1) or the credit pack table
// that mirrors portal-api/src/agent/credits.ts (a test pins the mirror). Nothing here invents a price.
import { PRICING, formatAUD, formatMonthly } from "./pricing.ts";
import toolsJson from "./agentTools.generated.json" with { type: "json" };

export type PlanId = "none" | "ai_growth" | "ai_ops" | "ai_embedded";
export const PLAN_ORDER: readonly PlanId[] = ["none", "ai_growth", "ai_ops", "ai_embedded"];
const PLAN_NAME: Record<PlanId, string> = { none: "no retainer", ai_growth: "AI Growth Partner", ai_ops: "AI Ops Partner", ai_embedded: "Embedded AI Partner" };
const PLAN_PRICE: Record<Exclude<PlanId, "none">, number> = {
  ai_growth: PRICING.AI_GROWTH_PARTNER, ai_ops: PRICING.AI_OPS_PARTNER, ai_embedded: PRICING.AI_EMBEDDED_PARTNER,
};

// Credit packs, mirrored from portal-api/src/agent/credits.ts (1 credit = AU$0.01, EXAMPLE rate). Pinned by test_f270_upgrade_dock.
export const CREDIT_PACKS = [
  { id: "credits_2000", credits: 2000, amountCents: 2000 },
  { id: "credits_10000", credits: 10000, amountCents: 10000 },
  { id: "credits_50000", credits: 50000, amountCents: 50000 },
] as const;

// Thresholds. Exported so the mutation test can flip them and watch a test fail.
export const LOW_COVER_DAYS = 14;   // top-up is offered when the balance covers fewer than this many days at the 30-day pace
export const CAP_WARN_RATIO = 0.8;  // raising the spend cap is offered once 30-day use reaches this share of the cap

export interface CallCount { tool: string; count: number; denied?: number } // denied = calls refused for a missing scope
export interface DockInput {
  plan: PlanId;
  creditsRemaining: number;
  spendCapCredits: number | null;   // max credits spendable in 30 days, null = no cap set
  calls30d: CallCount[];
  keyScopes: string[];
}
export type OptionKind = "topup" | "scope_widening" | "cap_raise" | "next_tier";
export interface DockAction { kind: "link" | "coming"; href?: string }
export interface DockOption {
  kind: OptionKind;
  id: string;
  title: string;
  priceAud: string | null;          // formatted AU$ string, null when there is no charge
  reason: string;
  reversible: boolean;              // true = can be undone without cost (a key scope or cap can be narrowed again)
  action: DockAction;
}

const TOOLS = (toolsJson as { tools: { name: string; scope: string; credits: number }[] }).tools;
const creditsOf = (tool: string) => TOOLS.find((t) => t.name === tool)?.credits ?? 0;
const scopeOf = (tool: string) => TOOLS.find((t) => t.name === tool)?.scope;
const nn = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

// Refused (denied) calls were never charged, so they are not counted as credit use.
export function creditsUsed30d(calls: CallCount[]): number { return calls.reduce((s, c) => s + Math.max(0, nn(c.count) - nn(c.denied)) * creditsOf(c.tool), 0); }
export const totalCalls30d = (calls: CallCount[]): number => calls.reduce((s, c) => s + nn(c.count), 0);

// Smallest pack that covers 30 days at the current pace (at least one pack); the largest pack when none does.
export function packFor(creditsNeeded: number) {
  return CREDIT_PACKS.find((p) => p.credits >= creditsNeeded) ?? CREDIT_PACKS[CREDIT_PACKS.length - 1];
}

export function nextTier(plan: PlanId): Exclude<PlanId, "none"> | null {
  const i = PLAN_ORDER.indexOf(plan);
  return i >= 0 && i < PLAN_ORDER.length - 1 ? (PLAN_ORDER[i + 1] as Exclude<PlanId, "none">) : null;
}

const RANK: Record<OptionKind, number> = { topup: 0, scope_widening: 1, cap_raise: 2, next_tier: 3 };

export function upgradeOptions(input: DockInput): DockOption[] {
  const out: DockOption[] = [];
  const credits = nn(input.creditsRemaining);
  const used = creditsUsed30d(input.calls30d);
  const daily = used / 30;
  const coverDays = daily > 0 ? credits / daily : Infinity;
  const cap = input.spendCapCredits;

  // 1. Credit top-up: no credits at all, or fewer than LOW_COVER_DAYS of cover at the 30-day pace.
  if (credits === 0 || coverDays < LOW_COVER_DAYS) {
    const pack = packFor(Math.max(used, 1));
    const days = Number.isFinite(coverDays) ? Math.floor(coverDays) : null;
    out.push({
      kind: "topup", id: pack.id, title: `Top up ${pack.credits} credits`, priceAud: formatAUD(pack.amountCents / 100),
      reason: credits === 0
        ? "Your balance is empty, so model-backed calls stop until you top up. Calls that cost nothing keep working."
        : `Your balance covers about ${days} days at the pace of the last 30 days.`,
      reversible: false, // credits are prepaid and are not refunded once bought
      action: { kind: "coming" }, // the top-up route exists in portal-api (POST /agent/credits/topup) but the live API is not deployed
    });
  }

  // 2. Scope widening: calls refused in the last 30 days because the key lacks the scope.
  const missing = new Map<string, number>();
  for (const c of input.calls30d) {
    const d = nn(c.denied); const sc = scopeOf(c.tool);
    if (d > 0 && sc && !input.keyScopes.includes(sc)) missing.set(sc, (missing.get(sc) ?? 0) + d);
  }
  for (const [scope, n] of [...missing.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    out.push({
      kind: "scope_widening", id: `scope:${scope}`, title: `Add the ${scope} scope to your key`, priceAud: null,
      reason: `${n} call${n === 1 ? " was" : "s were"} refused in the last 30 days because this key lacks that scope. Adding it costs nothing.`,
      reversible: true, action: { kind: "coming" },
    });
  }

  // 3. Spend cap raise: 30-day use has reached CAP_WARN_RATIO of the cap.
  if (cap !== null && cap > 0 && used >= cap * CAP_WARN_RATIO) {
    out.push({
      kind: "cap_raise", id: "cap_raise", title: "Raise your spend cap", priceAud: null,
      reason: used >= cap ? "You have reached your own spend cap, so model-backed calls are paused until it resets or you raise it."
        : "You have used most of your own spend cap. Raising it is your choice and costs nothing by itself.",
      reversible: true, action: { kind: "coming" },
    });
  }

  // 4. Next retainer tier: always last. Three-month minimum, so not reversible within the term.
  const nt = nextTier(input.plan);
  if (nt) {
    const calls = totalCalls30d(input.calls30d);
    out.push({
      kind: "next_tier", id: nt, title: `Move to ${PLAN_NAME[nt]}`, priceAud: formatMonthly(PLAN_PRICE[nt]),
      reason: `${input.plan === "none" ? "You have no retainer yet" : `You are on ${PLAN_NAME[input.plan]}`} and made ${calls} call${calls === 1 ? "" : "s"} in the last 30 days. This tier has a ${PRICING.AI_RETAINER_MIN_MONTHS}-month minimum.`,
      reversible: false, action: { kind: "link", href: "/pricing" },
    });
  }

  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
}

// A fixed, labelled example so the static preview page can show the dock working. Not a real account.
export const SYNTHETIC_EXAMPLE: DockInput = {
  plan: "none", creditsRemaining: 40, spendCapCredits: 500, keyScopes: ["catalogue:read", "scan:read"],
  calls30d: [{ tool: "domain_check", count: 80 }, { tool: "explain_finding", count: 3, denied: 3 }],
};
