// Single source of truth for the trust-strip stats. NEVER hand-typed: lib/stats.json is written daily by
// klinge-kernel bin/site_stats.py from our own records (2026-10-05: the old 1,700 / 3,600 figures had no record behind them).
import counted from "./stats.json";

export const STATS = {
  scansLast30Days: counted.scansLast30Days,
  organisationsResearched: counted.organisationsResearched,
  asOf: counted.asOf,
} as const;

export const STAT_LABELS = {
  scansShort: "domains checked in the last 30 days",
  researchedShort: "organisations researched in full dossiers",
} as const;

const fmt = (n: number) => n.toLocaleString("en-AU");

export const STAT_COMBINED =
  `${fmt(STATS.scansLast30Days)} domains checked in the last 30 days · ${fmt(STATS.organisationsResearched)} organisations researched in full dossiers`;
