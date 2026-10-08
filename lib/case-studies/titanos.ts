// The TITANOS self case study. Every figure comes from titanos.json (own records) or lib/ledger.json (the site's number ledger),
// so the page cannot drift from its sources. Ledger facts are rendered by key, never retyped.
import data from "./titanos.json";
import ledger from "../ledger.json";

export const TITANOS = data;
export const titanosPath = "/case-studies/titanos";

export type LedgerFact = { label: string; method: string; source: string; text: string };
export const FACTS = ledger.facts as unknown as Record<string, LedgerFact>;
export const FACTS_AS_OF: string = ledger.facts_as_of;

/** Look up a curated ledger fact by key; throws at build time if the key is gone. */
export function fact(key: string): LedgerFact {
  const f = FACTS[key];
  if (!f) throw new Error(`ledger fact missing: ${key}`);
  return f;
}
