export type ProductKind = "guide" | "checklist" | "template" | "playbook" | "course";

export type Lesson = { title: string; outcome: string };
export type Module = { title: string; lessons: Lesson[] };

export type Product = {
  slug: string;
  kind: ProductKind;
  name: string;
  bluf: string;
  forWho: string[];
  youGet: string[];
  // The file the buyer receives after paying. Staged: the file is produced when the payment link goes live.
  delivery: { file: string; format: string; note: string };
  // When set, the price is read from lib/offers/offers.json (single source of truth). Otherwise the price is TBC.
  offerSlug?: string;
  // Staged proposal for Kyle's Stripe card only. Never shown on the site as a price.
  suggestedPriceAud: number;
  // Courses only.
  outline?: Module[];
  bundle?: string[];
  faq: { q: string; a: string }[];
};
