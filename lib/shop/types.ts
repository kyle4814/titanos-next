// C5 shop: shared types. Types only, so Node can import the .ts modules directly in tests (type stripping).
export type ShelfKind = "offer" | "product" | "course" | "generator";
export type Availability = "BUYABLE" | "FREE_STEP" | "QUOTE" | "SOON";
export type PriceLabel = "PUBLISHED" | "PROPOSED" | "QUOTE" | "UNKNOWN";

export type Shelf = {
  id: string; // kind:slug
  kind: ShelfKind;
  slug: string;
  name: string;
  bluf: string;
  bullets: string[];
  faq: { q: string; a: string }[];
  priceAud: number | null;
  cadence: "month" | "one-off" | "per-seat-month" | "quote" | "none";
  priceLabel: PriceLabel;
  status: string; // source status word (READY, CHECK, ...)
  availability: Availability;
  buyUrl: string | null;
  href: string; // on-site page
  source: string; // file the shelf was built from (trace, plan line 1497)
  synthetic: boolean; // true = illustrative config, never shown publicly
  proof?: { fixture: string; passed: boolean }; // generator shelves: the planted-fixture result
  tags: string[];
};

export type Check = { id: string; ok: boolean; why: string };
export type Grade = { pass: boolean; checks: Check[] };
export type GradedShelf = Shelf & { grade: Grade };

export type GeneratorConfig = {
  id: string;
  job: string;
  sector: string;
  country: string;
  name: string;
  bluf: string;
  priceAud: number | null;
  synthetic: boolean;
  proof?: { fixture: string; passed: boolean };
};

export type Quote = {
  matched: boolean;
  shelfId: string | null;
  priceAud: number | null;
  priceLabel: PriceLabel;
  cadence: Shelf["cadence"];
  line: string;
  missing: string[]; // slots still needed (tap buttons)
  generatorStub: GeneratorConfig | null; // unmatched asks become a config overnight
};
