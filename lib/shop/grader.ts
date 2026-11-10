// C5 shop grader: every shelf is graded before it shows (plan ch.6 C5, line 1497). Pure, zero model calls.
import type { Shelf, Grade, Check, GradedShelf } from "./types";

const TELLS = /\b(delve|leverag\w*|robust|holistic|landscape|cutting-edge|seamless\w*|streamlin\w*|synerg\w*|harness\w*|ecosystem)\b|[–—]/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Public buy links are LIVE links only: a test_ link or a mock:// placeholder must never reach a public buy button.
const STRIPE = /^https:\/\/buy\.stripe\.com\/(?!test_)[A-Za-z0-9_]+$/;

function visibleText(s: Shelf): string[] {
  return [s.name, s.bluf, ...s.bullets, ...s.faq.flatMap((f) => [f.q, f.a])];
}

// Every key a shelf may carry. Anything else could reach rendering unreviewed, so it hides the shelf.
const ALLOWED_KEYS = new Set([
  "id", "kind", "slug", "name", "bluf", "bullets", "faq", "priceAud", "cadence", "priceLabel", "status",
  "availability", "buyUrl", "href", "source", "synthetic", "proof", "tags", "grade",
]);
const isStr = (v: unknown): v is string => typeof v === "string";
const strArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
// A price is a finite number >= 0 that lands on a safe-integer cent amount. "49", Infinity, NaN, null, 1e309, -1 all fail.
export const isValidPrice = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

export function gradeShelf(s: Shelf): Grade {
  const c: Check[] = [];
  const add = (id: string, ok: boolean, why: string) => c.push({ id, ok, why });

  // Shape first: if the shape is wrong, nothing below may throw, and the shelf is hidden.
  const o = (s !== null && typeof s === "object" ? s : {}) as unknown as Record<string, unknown>;
  const faqOk = Array.isArray(o.faq) && (o.faq as unknown[]).every((f) => !!f && typeof f === "object" && isStr((f as { q?: unknown }).q) && isStr((f as { a?: unknown }).a));
  const unknownKeys = s !== null && typeof s === "object" ? Object.keys(o).filter((k) => !ALLOWED_KEYS.has(k)) : ["<not an object>"];
  const shapeOk =
    !!s && typeof s === "object" && isStr(o.slug) && isStr(o.name) && isStr(o.bluf) && isStr(o.source) &&
    strArr(o.bullets) && strArr(o.tags) && faqOk && typeof o.synthetic === "boolean" && (o.buyUrl === null || isStr(o.buyUrl));
  add("types", shapeOk, "title, bluf, source are strings; bullets and tags are string arrays; faq is {q,a} strings");
  add("no-unknown-fields", unknownKeys.length === 0, unknownKeys.length ? `unknown field: ${unknownKeys.join(", ")}` : "no fields outside the shelf schema");
  const priceTyped = o.priceAud === null || isValidPrice(o.priceAud);
  add("price-type", priceTyped, "price is null or a finite number of at least 0 on a whole-cent amount");
  if (!shapeOk) return { pass: false, checks: c };

  add("slug", SLUG.test(s.slug), "slug is kebab-case");
  add("name", s.name.trim().length >= 3 && s.name.length <= 120, "name 3 to 120 chars");
  add("bluf", s.bluf.trim().length >= 20 && s.bluf.length <= 400, "one-line answer 20 to 400 chars");
  add("source", s.source.trim().length > 0, "shelf traces to a source file");
  add("copy", !visibleText(s).some((t) => TELLS.test(t)), "no AI-tell words, no em or en dashes");
  add("not-synthetic", !s.synthetic, "synthetic configs never show publicly");

  // Price honesty: a number needs a real label; a quote needs the QUOTE label; never a price on PROPOSED.
  // Type check first (F-C5): priceTyped (above) is null or a finite whole-cent number >= 0. Infinity, NaN and the string "49" never show.
  // Zero is allowed only because a free step is a real PUBLISHED AU$0; a BUYABLE shelf must be finite and > 0 below.
  const priced = s.priceAud !== null && s.cadence !== "quote" && s.cadence !== "none";
  add(
    "price-honest",
    priceTyped && (priced ? s.priceLabel === "PUBLISHED" : s.priceLabel === "QUOTE" || s.priceLabel === "UNKNOWN"),
    "a shown price is PUBLISHED; otherwise the shelf says quote",
  );

  // Availability must be true: BUYABLE needs a real Stripe link and READY; FREE_STEP needs READY.
  let avOk = false;
  switch (s.availability) {
    case "BUYABLE": avOk = s.status === "READY" && s.buyUrl !== null && STRIPE.test(s.buyUrl) && priced && priceTyped && (s.priceAud as number) > 0; break;
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
  return graded.filter((s) => s && s.grade && s.grade.pass === true && gradeShelf(s).pass);
}
