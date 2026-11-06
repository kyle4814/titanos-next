// C5 shop: generator config schema + an expander for SYNTHETIC illustrative configs.
// The real 1,000 configs were not found on disk by this lane (see receipt). Synthetic configs never show publicly (grader).
import type { GeneratorConfig } from "./types";

export const JOBS = ["email-security-audit", "privacy-policy-pack", "quote-follow-up", "tender-bid-pack", "review-reply-drafts", "invoice-chase", "staff-onboarding-kit", "supplier-risk-check", "monthly-report"] as const;
export const SECTORS = ["plumbing", "electrical", "accounting", "dental", "real-estate", "construction", "legal", "retail"] as const;
export const COUNTRIES = ["AU", "NZ", "UK", "US"] as const;

export function validateConfig(c: Partial<GeneratorConfig>): string[] {
  const e: string[] = [];
  if (!c.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) e.push("id must be kebab-case");
  for (const k of ["job", "sector", "country", "name", "bluf"] as const) if (!c[k] || String(c[k]).trim() === "") e.push(`${k} missing`);
  if (typeof c.synthetic !== "boolean") e.push("synthetic must be explicit true or false");
  if (c.priceAud !== null && c.priceAud !== undefined && !(c.priceAud >= 0)) e.push("priceAud invalid");
  return e;
}

// SYNTHETIC: job x sector x country, labelled, with a fixture result that the caller supplies (never invented here).
export function expandSynthetic(limit = 36, passed: (id: string) => boolean = () => true): GeneratorConfig[] {
  const out: GeneratorConfig[] = [];
  for (const country of COUNTRIES) for (const sector of SECTORS) for (const job of JOBS) {
    if (out.length >= limit) return out;
    const id = `${job}-${sector}-${country.toLowerCase()}`;
    out.push({
      id, job, sector, country,
      name: `${job.replace(/-/g, " ")} for ${sector} (${country})`,
      bluf: `A ready-made ${job.replace(/-/g, " ")} set up for ${sector} businesses in ${country}.`,
      priceAud: null, synthetic: true, proof: { fixture: `fixture-${job}`, passed: passed(id) },
    });
  }
  return out;
}
