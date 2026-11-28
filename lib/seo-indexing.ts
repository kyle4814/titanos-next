// One place that decides which generated pages search engines may index. Read by the page metadata
// (robots), the sitemap (lib/routes.ts) and the SEO tests, so the three cannot drift apart.
import { availability } from "@/lib/offers";
import type { Offer } from "@/lib/offers/types";

/** Only an offer with a live checkout (BUYABLE) is a search entry point; the rest are "launching soon" and stay noindex until they sell. */
export function offerIndexable(o: Offer): boolean {
  return availability(o) === "BUYABLE";
}

/** The ten /sectors/<slug> pages are thin (about 300 words, one number): noindex until each has its own data and 800+ words. */
export const SECTOR_PAGES_INDEXABLE = false;
