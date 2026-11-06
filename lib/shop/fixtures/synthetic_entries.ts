// SYNTHETIC FIXTURES (labelled, test data only). Never imported by build_shop.mjs, never merged into the real catalogue,
// never shown publicly (synthetic: true). 12 entries: 1 pass + 11 single-fault. Slugs start "synthetic-".
import type { Entry } from "../entry_grade.ts";
import type { PriceRow } from "../pricebook.ts";
import { TRUST_REFUND_LINE } from "../policy.ts";

export const FIXTURE_LABEL = "SYNTHETIC: illustrative test entries, not products";
const row = (priceAud: number): PriceRow => ({ priceAud, label: "PROPOSED", source: "SYNTHETIC fixture" });

const good = (): Entry => ({
  slug: "synthetic-good-guide", kind: "product", name: "Synthetic Guide: Tidy Your Quote Emails",
  bluf: "A short synthetic guide used to prove the grader passes a clean product entry.",
  outcome: "You have a tested quote follow-up routine that you approve before anything is sent.",
  forWho: ["Test readers only"], youGet: ["A one-page routine", "Three message templates"],
  priceAud: 30, currency: "AUD", priceLabel: "PROPOSED",
  refundLine: `Email us and we will sort it out in plain terms. ${TRUST_REFUND_LINE}`,
  stripe: { mode: "mock", url: "mock://stripe/synthetic-good-guide" },
  delivery: { file: "synthetic-good-guide.pdf", format: "PDF, about 10 pages" }, synthetic: true, status: "CHECK",
});
const goodCourse = (): Entry => ({
  ...good(), slug: "synthetic-fault-course-no-outline", kind: "course", name: "Synthetic Course: Quotes Start to Finish",
  delivery: { file: "c.zip", format: "ZIP" },
  outline: [1, 2, 3].map((n) => ({ title: `Module ${n}`, lessons: [{ title: "Lesson A", outcome: "A clear outcome." }, { title: "Lesson B", outcome: "Another outcome." }] })),
});

// [entry, the ONE check id it must fail]
export const FIXTURES: { entry: Entry; fails: string | null }[] = [
  { entry: good(), fails: null },
  { entry: { ...good(), slug: "synthetic-fault-no-outcome", outcome: "" }, fails: "fields" },
  { entry: { ...good(), slug: "synthetic-fault-wrong-price", priceAud: 31 }, fails: "price-table" },
  { entry: { ...good(), slug: "synthetic-fault-usd", currency: "USD" }, fails: "currency" },
  { entry: { ...good(), slug: "synthetic-fault-no-refund", refundLine: "Email us and we will sort it out." }, fails: "refund-line" },
  { entry: { ...good(), slug: "synthetic-fault-income", outcome: "Earn $5,000 a month with guaranteed passive income." }, fails: "outcome-claims" },
  { entry: { ...good(), slug: "synthetic-fault-urgency", bluf: "A short synthetic guide, hurry, only 3 copies left at this price." }, fails: "outcome-claims" },
  { entry: { ...good(), slug: "synthetic-fault-ai-tell", bluf: "A short synthetic guide that will leverage your inbox, in a robust way." }, fails: "copy-lint" },
  { entry: { ...good(), slug: "synthetic-fault-live-link", stripe: { mode: "live", url: "https://buy.stripe.com/abc123XYZ" } }, fails: "stripe-test-only" },
  { entry: { ...good(), slug: "synthetic-fault-no-link", stripe: null }, fails: "stripe-test-only" },
  { entry: { ...good(), slug: "synthetic-fault-no-delivery", delivery: null }, fails: "delivery" },
  { entry: { ...goodCourse(), outline: [] }, fails: "delivery" },
];
export const FIXTURE_PRICEBOOK: Record<string, PriceRow> = Object.fromEntries(FIXTURES.map((f) => [f.entry.slug, row(30)]));
