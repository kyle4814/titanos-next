// CONSIST-02 — Single source of truth for the trust-strip stats.
// Update the numbers here; every page reads from this file.
//
// Canonical phrasing (per MASTER_AUDIT_2026-06-05 CONSIST-02):
//   "1,700+ automated corpus scans this month · 3,600+ unique AU/NZ/SG businesses in the scan corpus"

export const STATS = {
  scansThisMonth: 1700,
  uniqueBusinesses: 3600,
} as const;

export const STAT_LABELS = {
  scansShort: "automated corpus scans this month",
  businessesShort: "unique AU/NZ/SG businesses in the scan corpus",
} as const;

export const STAT_COMBINED =
  "1,700+ automated corpus scans this month · 3,600+ unique AU/NZ/SG businesses in the scan corpus";
