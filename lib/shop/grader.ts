// C5 shop grader: every shelf is graded before it shows (plan ch.6 C5, line 1497). Pure, zero model calls.
import type { Shelf, Grade, Check, GradedShelf } from "./types";

const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|harness\w*|ecosystem)\b|[–—]/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STRIPE = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/;

function visibleText(s: Shelf): string[] {
  return [s.name, s.bluf, ...s.bullets, ...s.faq.flatMap((f) => [f.q, f.a])];
}

export function gradeShelf(s: Shelf): Grade {
  const c: Check[] = [];
  const add = (id: string, ok: boolean, why: string) => c.push({ id, ok, why });

  add("slug", SLUG.test(s.slug), "slug is kebab-case");
  add("name", s.name.trim().length >= 3 && s.name.length <= 120, "name 3 to 120 chars");
  add("bluf", s.bluf.trim().length >= 20 && s.bluf.length <= 400, "one-line answer 20 to 400 chars");
  add("source", s.source.trim().length > 0, "shelf traces to a source file");
  add("copy", !visibleText(s).some((t) => TELLS.test(t)), "no AI-tell words, no em or en dashes");
  add("not-synthetic", !s.synthetic, "synthetic configs never show publicly");

  // Price honesty: a number needs a real label; a quote needs the QUOTE label; never a price on PROPOSED.
  const priced = s.priceAud !== null && s.cadence !== "quote" && s.cadence !== "none";
  add(
    "price-honest",
    priced ? s.priceLabel === "PUBLISHED" && (s.priceAud as number) >= 0 : s.priceLabel === "QUOTE" || s.priceLabel === "UNKNOWN",
    "a shown price is PUBLISHED; otherwise the shelf says quote",
  );

  // Availability must be true: BUYABLE needs a real Stripe link and READY; FREE_STEP needs READY.
  let avOk = false;
  switch (s.availability) {
    case "BUYABLE": avOk = s.status === "READY" && s.buyUrl !== null && STRIPE.test(s.buyUrl) && priced && (s.priceAud as number) > 0; break;
    case "FREE_STEP": avOk = s.status === "READY" && s.buyUrl === null; break;
    case "QUOTE": avOk = s.priceLabel === "QUOTE" && s.buyUrl === null; break;
    case "SOON": avOk = false; break; // a shelf that cannot be used never shows
  }
  add("availability-true", avOk, "the shelf does what its availability badge says");

  if (s.kind === "generator") {
    add("fixture-proof", !!s.proof && s.proof.passed === true && s.proof.fixture.length > 0, "generator shelf carries a passing planted-fixture result");
  }
  add("content", s.bullets.length >= 1 && s.faq.length >= 1, "at least one bullet and one FAQ");
  return { pass: c.every((x) => x.ok), checks: c };
}

export function gradeAll(shelves: Shelf[]): GradedShelf[] {
  return shelves.map((s) => ({ ...s, grade: gradeShelf(s) }));
}

// The only door to the public page: graded and passing. Ungraded input cannot pass this.
export function visibleShelves(graded: GradedShelf[]): GradedShelf[] {
  return graded.filter((s) => s.grade && s.grade.pass === true && gradeShelf(s).pass);
}
