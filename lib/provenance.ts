// EV6 helper: which system a page's numbers come from and what date they were read.
// Data lives in lib/site-data/provenance.json; the date is never hand-typed when it follows the ledger.
import prov from "./site-data/provenance.json";
import ledger from "./ledger.json";

export type Prov = { system: string; date: string; source: string; scope: string };
type Raw = { system: string; date?: string; dateFrom?: string; source: string; scope: string };

const RAW = prov as unknown as Record<string, Raw>;

export const PROVENANCE_ROUTES = Object.keys(RAW).filter((k) => k.startsWith("/"));

export function provenance(route: string): Prov {
  const r = RAW[route];
  if (!r) throw new Error(`No provenance entry for ${route}`);
  const date = r.dateFrom === "ledger" ? ledger.facts_as_of : r.date;
  if (!date) throw new Error(`No date for ${route}`);
  return { system: r.system, date, source: r.source, scope: r.scope };
}

export function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00+10:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" });
}
