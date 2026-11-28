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
  // Related offer in lib/offers/offers.json (used only if the pricebook has no published row).
  offerSlug?: string;
  // The published price in AUD (Kyle 2026-11-29). lib/shop/pricebook.ts carries the same figure and its source.
  suggestedPriceAud: number;
  // Courses only.
  outline?: Module[];
  bundle?: string[];
  faq: { q: string; a: string }[];
};
