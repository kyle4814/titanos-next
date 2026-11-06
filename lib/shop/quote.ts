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
