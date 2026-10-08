// The site's system numbers. NEVER hand-typed: lib/ledger.json is written by klinge-kernel bin/site_ledger_export.py from
// state/numbers/FACTS.json (curated, each fact traced to a receipt) and NUMBERS.json (the live ledger). Re-run the export, rebuild, redeploy.
import ledger from "./ledger.json";

export type LedgerKey = keyof typeof ledger.n;
export type Entry = { value: number; unit: string; label: string; method: string; source: string; as_of: string };

export const LEDGER = ledger.n as unknown as Record<LedgerKey, Entry>;
export const v = (k: LedgerKey): number => LEDGER[k].value;
export const label = (k: LedgerKey): string => LEDGER[k].label;
export const method = (k: LedgerKey): string => LEDGER[k].method;

/** 226892 -> "226,892" */
export const int = (k: LedgerKey): string => Math.round(v(k)).toLocaleString("en-AU");
/** 59.5 -> "59.5"; keeps the ledger's own decimals */
export const dec = (k: LedgerKey): string => String(v(k));
/** 24200000 -> "AU$24 million"; 10470000 -> "AU$10.5 million"; 484000 -> "AU$484,000" */
export function aud(k: LedgerKey): string {
  const x = v(k);
  if (x >= 1_000_000) return `AU$${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")} million`;
  return `AU$${Math.round(x).toLocaleString("en-AU")}`;
}
/** compact tile form: 24200000 -> "AU$24M", 2420000 -> "AU$2.4M", 484000 -> "AU$484k" */
export function audShort(k: LedgerKey): string {
  const x = v(k);
  if (x >= 1_000_000) return `AU$${(x / 1_000_000).toFixed(x >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  return `AU$${Math.round(x / 1000)}k`;
}
/** "~6,720" style rounded multiple */
export const times = (k: LedgerKey): string => `${Math.round(v(k)).toLocaleString("en-AU")}x`;

export const AS_OF_FACTS = ledger.facts_as_of; // "2026-10-08"
export const AS_OF_NUMBERS = ledger.numbers_as_of; // "2026-10-08T21:22:37"
const D = new Date(`${AS_OF_FACTS}T00:00:00+10:00`);
export const AS_OF_LONG = D.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Brisbane" }); // "8 October 2026"
export const RATE_NOTE = ledger.rate_note;

/** The one line under the locked home hero (and at the top of /engineering). */
export const HERO_STRIP =
  `Re-measured ${AS_OF_LONG}: ${int("estate_sloc")} lines of production code across ${int("estate_repos")} repositories, ${dec("estate_ey")} engineer-years (MODELLED, Basic COCOMO). ` +
  `Live pace: about ${dec("pace_ey_per_day_7d")} engineer-years a day over the last 7 days (MODELLED, four core repositories, ledger ${AS_OF_NUMBERS.slice(0, 10)}).`;

/** "about 24 engineers for about 30 months" (MODELLED) */
export const TEAM_LINE = `about ${Math.round(v("model_team"))} engineers for about ${Math.round(v("model_schedule_months"))} months`;
/** "about 5 months" of calendar time, around a day job */
export const ELAPSED_LINE = `about ${Math.round(v("elapsed_months"))} months`;
