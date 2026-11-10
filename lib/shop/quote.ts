// C5 shop: Auto Builder quote engine. Code only, deterministic, zero model calls. It can only say what is real:
// a shelf, its published price, or "quote". Unmatched asks become a generator config stub (logged, built overnight).
import type { GradedShelf, Quote, GeneratorConfig } from "./types";
import { isValidPrice } from "./grader.ts";
export type Vocab = { jobs: readonly string[]; sectors: readonly string[]; countries: readonly string[] };

const STOP = new Set(["i", "a", "an", "the", "for", "to", "my", "of", "and", "need", "want", "please", "can", "you", "me", "with", "in", "on", "do"]);

export function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/[\s-]+/).filter((t) => t && !STOP.has(t));
}

function score(ask: Set<string>, s: GradedShelf): number {
  const hay = new Set(tokens(`${s.name} ${s.slug} ${s.tags.join(" ")} ${s.bluf}`));
  let n = 0;
  for (const t of ask) if (hay.has(t)) n++;
  return n;
}

export function quoteAsk(text: string, shelves: GradedShelf[], vocab: Vocab, now = "1970-01-01"): Quote {
  const ask = new Set(tokens(text));
  let best: GradedShelf | null = null, bestN = 0;
  for (const s of shelves) {
    if (!s.grade.pass) continue; // only graded shelves can be quoted
    const n = score(ask, s);
    if (n > bestN || (n === bestN && best && s.id < best.id && n > 0)) { best = s; bestN = n; }
  }
  const minHits = ask.size <= 1 ? 1 : 2;
  if (best && bestN >= minHits) {
    // Defence in depth (F87): a quote never relabels a PROPOSED or malformed price as PUBLISHED, whatever the grade flag says.
    const priced = best.priceLabel === "PUBLISHED" && isValidPrice(best.priceAud) && best.cadence !== "quote" && best.cadence !== "none";
    return {
      matched: true, shelfId: best.id, priceAud: priced ? best.priceAud : null,
      priceLabel: priced ? "PUBLISHED" : "QUOTE", cadence: best.cadence,
      line: priced ? `${best.name}: published price on the shelf.` : `${best.name}: your quote is set on the shelf before you pay.`,
      missing: [], generatorStub: null,
    };
  }
  // Unmatched: detect slots so the buttons can ask for what is missing, then emit a stub config.
  const toks = tokens(text);
  const job = vocab.jobs.find((j) => j.split("-").every((p) => toks.includes(p)));
  const sector = vocab.sectors.find((x) => toks.includes(x));
  const country = vocab.countries.find((x) => toks.includes(x.toLowerCase()));
  const missing = [job ? "" : "job", sector ? "" : "sector", country ? "" : "country"].filter(Boolean);
  const slug = tokens(text).slice(0, 6).join("-") || "unmatched-ask";
  const stub: GeneratorConfig = {
    id: `ask-${slug}-${now}`, job: job ?? "unknown", sector: sector ?? "unknown", country: country ?? "unknown",
    name: `Requested: ${text.trim().slice(0, 80)}`, bluf: "Logged from an unmatched ask; the generator builds and grades it before it shows.",
    priceAud: null, synthetic: false,
  };
  return { matched: false, shelfId: null, priceAud: null, priceLabel: "QUOTE", cadence: "quote", line: "Not on a shelf yet. Logged, and we will build it and send you a quote.", missing, generatorStub: stub };
}

// ---------------------------------------------------------------------------------------------------------------------
// F207 scoped quotes. Additive: quoteAsk above is unchanged. quoteScoped prices a matched, PUBLISHED shelf for a scope and
// either returns a quote with an explicit validity window and the caller's assumptions echoed, or REFUSES with a typed
// reason. It never clamps, never invents a price, never calls a model. Policy numbers below are placeholders for Kyle's
// decision (UNKNOWN until he sets them); tests pass their own policy to hit the edges.
// ---------------------------------------------------------------------------------------------------------------------
export type Scope = { units: number; extras: number }; // units: whole number >= 1; extras: whole number >= 0
export type QuotePolicy = { minAud: number; capAud: number; validDays: number; stepPct: number; extraAud: number };
export const DEFAULT_POLICY: QuotePolicy = { minAud: 20, capAud: 5000, validDays: 14, stepPct: 25, extraAud: 15 };
export const MAX_UNITS = 1000; export const MAX_EXTRAS = 1000;
export type RefusalReason = "INVALID_DATE" | "INVALID_SCOPE" | "MISSING_ASSUMPTIONS" | "NO_MATCH" | "UNPRICED" | "BELOW_MINIMUM" | "ABOVE_CAP";
export type ScopedQuote =
  | { ok: true; shelfId: string; priceAud: number; scope: Scope; validFrom: string; validUntil: string; assumptions: string[]; line: string }
  | { ok: false; reason: RefusalReason; detail: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function validDay(d: string): boolean {
  if (typeof d !== "string" || !ISO_DAY.test(d)) return false;
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
}
export function addDays(d: string, n: number): string { return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10); }
const whole = (n: unknown, lo: number, hi: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi;
const refuse = (reason: RefusalReason, detail: string): ScopedQuote => ({ ok: false, reason, detail });

export function quoteScoped(text: string, scope: Scope, assumptions: string[], shelves: GradedShelf[], vocab: Vocab, now: string, policy: QuotePolicy = DEFAULT_POLICY): ScopedQuote {
  if (!validDay(now)) return refuse("INVALID_DATE", "The quote date must be a real day in YYYY-MM-DD form.");
  if (!scope || !whole(scope.units, 1, MAX_UNITS) || !whole(scope.extras, 0, MAX_EXTRAS)) return refuse("INVALID_SCOPE", "Scope needs a whole number of units from 1 and a whole number of extras from 0.");
  if (!Array.isArray(assumptions) || assumptions.length === 0 || !assumptions.every((a) => typeof a === "string" && a.trim().length > 0)) return refuse("MISSING_ASSUMPTIONS", "A quote needs at least one written assumption.");
  const base = quoteAsk(text, shelves, vocab, now);
  if (!base.matched) return refuse("NO_MATCH", "That ask is not on a shelf yet, so there is nothing to price.");
  if (base.priceAud === null) return refuse("UNPRICED", "That shelf is priced by quote, so a scoped price cannot be worked out here.");
  const baseCents = Math.round(base.priceAud * 100);
  const stepCents = Math.round((baseCents * policy.stepPct) / 100);
  let raw = baseCents + (scope.units - 1) * stepCents + scope.extras * Math.round(policy.extraAud * 100);
  if (raw < Math.round(policy.minAud * 100)) return refuse("BELOW_MINIMUM", `The price for this scope is under the minimum of AUD ${policy.minAud}.`);
  if (raw > Math.round(policy.capAud * 100)) return refuse("ABOVE_CAP", `The price for this scope is over the AUD ${policy.capAud} limit for online quotes.`);
  const validUntil = addDays(now, policy.validDays);
  const derived = [`Priced from the published shelf price of AUD ${base.priceAud}.`, `Scope: ${scope.units} units and ${scope.extras} extras.`, `This quote is valid from ${now} to ${validUntil}.`];
  return {
    ok: true, shelfId: base.shelfId as string, priceAud: raw / 100, scope: { units: scope.units, extras: scope.extras },
    validFrom: now, validUntil, assumptions: [...assumptions, ...derived],
    line: `${base.line} Scoped price: AUD ${raw / 100}, valid until ${validUntil}.`,
  };
}

// A quote is usable on its valid day and every day up to and including validUntil; the day after, it has expired.
export function isExpired(q: { validUntil: string }, today: string): boolean { return today > q.validUntil; }
export function acceptQuote(q: ScopedQuote, today: string): { ok: true } | { ok: false; reason: "EXPIRED" | "NOT_A_QUOTE" | "INVALID_DATE" } {
  if (!q.ok) return { ok: false, reason: "NOT_A_QUOTE" };
  if (!validDay(today)) return { ok: false, reason: "INVALID_DATE" };
  return isExpired(q, today) ? { ok: false, reason: "EXPIRED" } : { ok: true };
}
