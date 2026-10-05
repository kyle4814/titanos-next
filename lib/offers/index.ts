import type { Offer, OfferGroup } from "./types";
import { OFFERS_TRADIES } from "./data/tradies";
import { OFFERS_MULTIPLIERS_A } from "./data/multipliers-a";
import { OFFERS_MULTIPLIERS_B } from "./data/multipliers-b";
import { OFFERS_GOVERNMENT } from "./data/government";
import { OFFERS_ENTERPRISE } from "./data/enterprise";
import { OFFERS_SALES_SELFSERVE } from "./data/sales-selfserve";
import { OFFERS_SPECIALIST } from "./data/specialist";
import links from "./links.json";

export const ALL_OFFERS: Offer[] = [
  ...OFFERS_TRADIES,
  ...OFFERS_MULTIPLIERS_A,
  ...OFFERS_MULTIPLIERS_B,
  ...OFFERS_GOVERNMENT,
  ...OFFERS_ENTERPRISE,
  ...OFFERS_SALES_SELFSERVE,
  ...OFFERS_SPECIALIST,
];

// Fails the build on a duplicate slug.
(() => {
  const seen = new Set<string>();
  for (const o of ALL_OFFERS) {
    if (seen.has(o.slug)) throw new Error(`Duplicate offer slug: ${o.slug}`);
    seen.add(o.slug);
  }
})();

export function getOffer(slug: string): Offer | undefined {
  return ALL_OFFERS.find((o) => o.slug === slug);
}

export function offersByGroup(): Record<OfferGroup, Offer[]> {
  const out: Record<OfferGroup, Offer[]> = {
    tradies: [], multipliers: [], government: [], enterprise: [],
    sales: [], selfserve: [], specialist: [],
  };
  for (const o of ALL_OFFERS) out[o.group].push(o);
  return out;
}

export function buyHref(o: Offer): string | null {
  if (o.status !== "READY") return null;
  const map = links as Record<string, string>;
  return map[o.slug] || null;
}
