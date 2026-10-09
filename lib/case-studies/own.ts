// Case studies of our own products. Every figure comes from own.json (measured on a stated date from a stated
// source) or, for the HUD, from the numbers ledger in lib/ledger.json, so the pages cannot drift from their sources.
// consent=false keeps a study noindex and off every list, the menu and the site map until Kyle flips it.
import data from "./own.json";
import ledger from "../ledger.json";

export type Fact = { value: string; label: string; tag: string; source: string; as_of: string };
export type Shot = { id: string; caption: string; phone: string; desktop: string; alt_phone: string; alt_desktop: string };
export type OwnStudy = {
  slug: string;
  consent: boolean;
  consent_note: string;
  title: string;
  teaser: string;
  sector: string;
  brief: { heading: string; points: string[] };
  built: { name: string; text: string }[];
  how: { heading: string; paragraphs: string[] };
  facts: Fact[];
  gallery_heading: string;
  gallery_note: string;
  gallery: Shot[];
  status: string;
  limits: string[];
};

type LedgerRow = { value: number; label: string; source: string; as_of: string };
const N = (ledger as unknown as { n: Record<string, LedgerRow> }).n;

export function fmt(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString("en-AU") : String(v);
}

/** Facts for a study: its own rows, plus any rows pulled by key from the numbers ledger. */
export function factsOf(s: (typeof data.studies)[number]): Fact[] {
  const own = (s.facts ?? []) as Fact[];
  const pulled = ((s as { ledger_facts?: { key: string; label: string }[] }).ledger_facts ?? []).map(({ key, label }) => {
    const r = N[key];
    if (!r) throw new Error(`ledger key missing: ${key}`);
    return { value: fmt(r.value), label, tag: r.label, source: r.source.replace(/\/home\/[^/\s]+\/[^/\s]+\//g, ""), as_of: r.as_of };
  });
  return [...own, ...pulled];
}

export const OWN_INTRO = data.intro;
export const OWN_METHOD = data.methodology;
export const OWN_STUDIES: OwnStudy[] = data.studies.map((s) => ({ ...(s as unknown as OwnStudy), facts: factsOf(s) }));
export const ownVisible = (s: OwnStudy): boolean => s.consent === true;
export const OWN_VISIBLE: OwnStudy[] = OWN_STUDIES.filter(ownVisible);
export const ownPath = (slug: string): string => `/case-studies/own/${slug}`;
export const getOwn = (slug: string): OwnStudy | undefined => OWN_STUDIES.find((s) => s.slug === slug);
