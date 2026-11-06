// C5 product/course entry grader (plan ch.6 C5, line 1497): an entry is CHECK until every check passes, then READY with a seal.
// Pure, zero model calls. READY is never a hand-set flag: verifyReady re-grades and re-computes the seal.
import { createHash } from "node:crypto";
import { TRUST_REFUND_LINE, INCOME_CLAIM, FAKE_URGENCY, AI_TELLS, AI_PHRASES, DASHES } from "./policy.ts";
import { PRICEBOOK, type PriceRow } from "./pricebook.ts";
import type { Check, Shelf } from "./types";

export type StripeRef = { mode: "test" | "mock" | "live"; url: string } | null;
export type Entry = {
  slug: string; kind: "product" | "course"; name: string; bluf: string; outcome: string;
  forWho: string[]; youGet: string[];
  priceAud: number | null; currency: string; priceLabel: "PUBLISHED" | "PROPOSED" | string;
  refundLine: string; stripe: StripeRef;
  delivery: { file: string; format: string } | null;
  outline?: { title: string; lessons: { title: string; outcome: string }[] }[];
  synthetic: boolean;
  status: "CHECK" | "READY";
  seal?: string; // set only by promoteEntry
};
export type Ctx = { pricebook: Record<string, PriceRow> };
export const REAL_CTX: Ctx = { pricebook: PRICEBOOK };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEST_LINK = /^https:\/\/buy\.stripe\.com\/test_[A-Za-z0-9]+$/;
const MOCK_LINK = /^mock:\/\/stripe\/[a-z0-9-]+$/;

export function visibleStrings(e: Entry): string[] {
  return [e.name, e.bluf, e.outcome, ...e.forWho, ...e.youGet, ...(e.outline ?? []).flatMap((m) => [m.title, ...m.lessons.flatMap((l) => [l.title, l.outcome])])];
}

export function gradeEntry(e: Entry, ctx: Ctx = REAL_CTX): { pass: boolean; checks: Check[] } {
  const c: Check[] = [];
  const add = (id: string, ok: boolean, why: string) => c.push({ id, ok, why });
  const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  const text = visibleStrings(e).filter((s) => typeof s === "string");

  const missing: string[] = [];
  for (const k of ["slug", "name", "bluf", "outcome", "refundLine"] as const) if (!str(e[k])) missing.push(k);
  if (!Array.isArray(e.forWho) || e.forWho.length === 0) missing.push("forWho");
  if (!Array.isArray(e.youGet) || e.youGet.length === 0) missing.push("youGet");
  if (e.kind !== "product" && e.kind !== "course") missing.push("kind");
  add("fields", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : "all required fields present");
  add("slug", typeof e.slug === "string" && SLUG.test(e.slug), "slug is kebab-case");

  // price: AU dollars, a whole positive number, equal to the pricebook row for this slug (ch.5 anchors never borrowed by another SKU)
  const row = ctx.pricebook[e.slug];
  add("currency", e.currency === "AUD", "price is in Australian dollars (AUD)");
  add("price-table", !!row && Number.isInteger(e.priceAud) && (e.priceAud as number) > 0 && e.priceAud === row.priceAud && e.priceLabel === row.label,
    row ? `price and label equal the pricebook row (AU$${row.priceAud} ${row.label})` : "slug has a pricebook row");

  add("refund-line", str(e.refundLine) && e.refundLine.replace(/\s+/g, " ").includes(TRUST_REFUND_LINE), "refund line contains the canonical /trust refund sentence");

  add("outcome-claims", !text.some((t) => INCOME_CLAIM.test(t) || FAKE_URGENCY.test(t)), "no guaranteed-income or fake-urgency wording");
  add("copy-lint", !text.some((t) => DASHES.test(t) || AI_TELLS.test(t) || AI_PHRASES.test(t)), "no em or en dashes, no AI-tell words or phrases (content_lint rules)");

  // Stripe: a TEST-mode link or a mock placeholder only. A live-mode link is never accepted here (promotion to live is GATE2).
  const s = e.stripe;
  const stripeOk = !!s && ((s.mode === "test" && TEST_LINK.test(s.url)) || (s.mode === "mock" && MOCK_LINK.test(s.url)));
  add("stripe-test-only", stripeOk, "Stripe link is TEST-mode (buy.stripe.com/test_...) or a mock:// placeholder, never live");

  if (e.kind === "course") {
    const o = e.outline;
    add("delivery", Array.isArray(o) && o.length >= 3 && o.every((m) => str(m.title) && Array.isArray(m.lessons) && m.lessons.length >= 2 && m.lessons.every((l) => str(l.title) && str(l.outcome))), "course has 3+ modules, each with 2+ lessons that state an outcome");
  } else {
    add("delivery", !!e.delivery && str(e.delivery.file) && str(e.delivery.format), "product names the file the buyer receives");
  }
  return { pass: c.every((x) => x.ok), checks: c };
}

// The seal binds the graded content. Anything that changes after grading (price, copy, link) breaks it.
export function sealOf(e: Entry): string {
  const { status: _s, seal: _x, ...rest } = e;
  return createHash("sha256").update(JSON.stringify(rest, Object.keys(rest).sort())).digest("hex");
}

// CHECK -> READY only when every check passes. Returns the entry unchanged (CHECK) plus the failed checks otherwise.
export function promoteEntry(e: Entry, ctx: Ctx = REAL_CTX): { entry: Entry; failed: Check[] } {
  const g = gradeEntry(e, ctx);
  if (!g.pass) { const { seal: _x, ...rest } = e; return { entry: { ...rest, status: "CHECK" }, failed: g.checks.filter((x) => !x.ok) }; }
  const base: Entry = { ...e, status: "READY" };
  return { entry: { ...base, seal: sealOf(base) }, failed: [] };
}

// A READY entry is honest only if its seal matches its content AND a fresh grade passes. Returns the problems (empty = honest).
export function verifyReady(e: Entry, ctx: Ctx = REAL_CTX): string[] {
  if (e.status !== "READY") return [];
  const out: string[] = [];
  if (!e.seal) out.push("READY without a grade seal (hand-edited flag)");
  else if (e.seal !== sealOf(e)) out.push("READY seal does not match content (edited after grading)");
  const g = gradeEntry(e, ctx);
  if (!g.pass) out.push("READY but fresh grade fails: " + g.checks.filter((x) => !x.ok).map((x) => x.id).join(", "));
  return out;
}

// The only door from entries to the public shelf: READY, honest, not synthetic (unless a test opts in with includeSynthetic).
export function visibleEntries(entries: Entry[], ctx: Ctx = REAL_CTX, opts: { includeSynthetic?: boolean } = {}): Entry[] {
  return entries.filter((e) => e.status === "READY" && verifyReady(e, ctx).length === 0 && (opts.includeSynthetic || !e.synthetic));
}

export function entryToShelf(e: Entry): Shelf {
  return {
    id: `${e.kind}:${e.slug}`, kind: e.kind, slug: e.slug, name: e.name, bluf: e.bluf, bullets: e.youGet,
    faq: [{ q: "What if it is not right for me?", a: e.refundLine }], priceAud: e.priceAud, cadence: "one-off",
    priceLabel: e.priceLabel as Shelf["priceLabel"], status: e.status, availability: "SOON", buyUrl: null,
    href: `/products/${e.slug}`, source: "lib/shop/entry_grade.ts", synthetic: e.synthetic, tags: [e.kind],
  };
}

// The shelf builder for entries: only READY, honest entries become shelf cards. `ungraded_shown` is measured by an independent
// fresh re-grade of every shown card, so it is a real count, not a constant. A card has no buy button until the live link card (GATE2).
export function buildEntryShelves(entries: Entry[], ctx: Ctx = REAL_CTX, opts: { includeSynthetic?: boolean } = {}) {
  const shown = visibleEntries(entries, ctx, opts);
  const ungraded_shown = shown.filter((e) => !gradeEntry(e, ctx).pass || !e.seal || e.seal !== sealOf(e)).length;
  return { shelves: shown.map(entryToShelf), counts: { total: entries.length, shown: shown.length, ungraded_shown } };
}
