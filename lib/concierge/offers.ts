// Offer shelves from the real catalogue (lib/offers/data). Price and availability come from the data only.
import type { Shelf } from "./types.ts";

export type OfferIn = { slug: string; name: string; group: string; buyer: string; bluf: string; forWho: string[]; youGet: string[]; priceAud: number | null; cadence: string; status: string };
// Concierge-owned phrasing layer: how people ask for an offer in their own words. Labelled data, not a claim about the offer.
export const ALIASES: Record<string, string[]> = {
  "scam-shield-for-tradies": ["fake invoices", "invoice scam", "payment scam", "pretending to be my supplier", "someone is impersonating my supplier", "scam shield"],
  "subbie-finder": ["find reliable subcontractors", "find subbies", "subcontractors for my jobs"],
  "franchise-posture-board": ["all my franchise locations", "one view of every franchisee"],
  "free-tender-digest": ["free email of new tenders", "free tender email"],
  "quote-chaser": ["chase my quotes", "chase quotes", "unanswered quotes", "quotes never answered"],
  "insurer-book-scan": ["policy book", "insurer portfolio scan", "scan an insurance book"],
  "msp-prospect-feed": ["msp prospects", "prospects for an msp"],
  "payee-domain-change-watch": ["payee details change", "bank details email changes", "supplier email domain changes"],
  "tender-intelligence-radar": ["who wins the contracts", "competitors winning tenders", "competitor win map"],
  "global-tender-desk": ["overseas tenders", "foreign tenders", "international tenders", "overseas government tenders", "tenders in the us and europe", "us and eu tenders"],
  "charity-profit-mirror": ["profit analysis for a charity", "charity profit"],
};
export function shelfFromOffer(o: OfferIn): Shelf {
  const quote = o.priceAud === null || o.cadence === "quote";
  const ready = o.status === "READY";
  const price = quote ? "by quote" : o.priceAud === 0 ? "free" : "AU$" + o.priceAud + (o.cadence === "month" ? " a month" : o.cadence === "per-seat-month" ? " a seat a month" : " one-off");
  return {
    id: "offer:" + o.slug, kind: "offer", title: o.name, href: "/offers/" + o.slug, home: [],
    keywords: [...(ALIASES[o.slug] ?? []), o.name.toLowerCase(), o.buyer.toLowerCase(), ...o.forWho.map((x) => x.toLowerCase())],
    text: (o.name + " " + o.bluf + " " + o.youGet.join(" ")).toLowerCase(),
    availability: ready ? "READY" : "NOT_YET_OPEN", priceAud: quote ? null : o.priceAud, cadence: quote ? "quote" : o.cadence,
    answer: o.name + ": " + o.bluf + " Price: " + price + "." + (ready ? "" : " It is not open for purchase yet. Ask for a quote or to be told when it opens."),
  };
}
