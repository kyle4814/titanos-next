import { formatAUD, formatMonthly } from "@/lib/pricing";

export type OfferGroup =
  | "tradies"
  | "multipliers"
  | "government"
  | "enterprise"
  | "sales"
  | "selfserve"
  | "specialist";

export type OfferStatus = "READY" | "CHECK" | "BUILD" | "KEY";

export type Offer = {
  slug: string;
  name: string;
  group: OfferGroup;
  buyer: string;
  bluf: string;
  forWho: string[];
  youGet: string[];
  howItWorks: [string, string, string];
  edge: string;
  priceAud: number | null;
  cadence: "month" | "one-off" | "per-seat-month" | "quote";
  priceNote?: string;
  status: OfferStatus;
  freeHook: string;
  faq: { q: string; a: string }[];
  ladderUp?: string;
  kyleMinutes: number;
};

export const GROUP_LABELS: Record<OfferGroup, string> = {
  tradies: "Tradies and trade businesses",
  multipliers: "Partners and multipliers",
  government: "Government work",
  enterprise: "Enterprise and boards",
  sales: "Sales and growth",
  selfserve: "Self-serve tools",
  specialist: "Specialist services",
};

export function formatOfferPrice(o: Offer): string {
  if (o.priceAud === null || o.cadence === "quote") return "Price on request";
  if (o.priceAud === 0) return formatAUD(0);
  switch (o.cadence) {
    case "month":
      return formatMonthly(o.priceAud);
    case "per-seat-month":
      return `${formatAUD(o.priceAud)}/seat/mo`;
    default:
      return `${formatAUD(o.priceAud)} one-off`;
  }
}

export function isReady(o: Offer): boolean {
  return o.status === "READY";
}
