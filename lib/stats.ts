// Single source of truth for the trust-strip stats. NEVER hand-typed: lib/stats.json is written daily by
// klinge-kernel bin/site_stats.py from our own records (2026-10-05: the old 1,700 / 3,600 figures had no record behind them).
import counted from "./stats.json";

export const STATS = {
  scansLast30Days: counted.scansLast30Days,
  organisationsResearched: counted.organisationsResearched,
  asOf: counted.asOf,
} as const;

// 2026-11-27: the count is a dated snapshot, so every label names its date instead of saying "the last 30 days".
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const [Y, M, D] = counted.asOf.slice(0, 10).split("-").map(Number);
export const STATS_ASOF_LONG = `${D} ${MONTHS[M - 1]} ${Y}`;
export const SCANS_PHRASE = `domains checked in the 30 days to ${STATS_ASOF_LONG}`;

export const STAT_LABELS = {
  scansShort: SCANS_PHRASE,
  researchedShort: "organisations researched in full dossiers",
} as const;

const fmt = (n: number) => n.toLocaleString("en-AU");

export const STAT_COMBINED =
  `${fmt(STATS.scansLast30Days)} ${SCANS_PHRASE} · ${fmt(STATS.organisationsResearched)} organisations researched in full dossiers`;
