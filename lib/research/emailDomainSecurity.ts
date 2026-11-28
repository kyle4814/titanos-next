// Data for /research/australian-email-domain-security-2026.
// Every number below is read from the nine per-band research reports of the TITANOS SpoofGuard sampling run
// (klinge-kernel state/research/d89e1778/ocean/deep3, files Q08, Q30, Q32, Q37, Q43, Q47, Q51, Q55; run 2026-09-30 to 2026-10-01).
// The per-domain rows are not published and no business is named: only per-band counts live here.
// Totals, rates and the interval are COMPUTED from the per-band counts, never typed.

export const STUDY_PATH = "/research/australian-email-domain-security-2026";
export const STUDY_CSV = "/data/australian-email-domain-security-2026.csv";
export const STUDY_DATE_RUN = "2026-09-30 to 2026-10-01";
export const STUDY_DATE_PUBLISHED = "2026-11-29";

export type Band = {
  id: string;          // research report id
  rankLow: number;     // Tranco rank band, lower bound
  rankHigh: number;
  run: string;         // ISO date of the run
  sampled: number;     // domains drawn
  live: number;        // sampled minus dead or duplicate (the denominator)
  noRecord: number | null;   // no DMARC record at all
  pNone: number | null;      // DMARC at p=none (monitor only)
  quarantine: number | null;
  reject: number | null;
  dmarcGap: number;    // noRecord + pNone
  doubleGap: number;   // DMARC gap AND security.txt confirmed absent
  unknown: number;     // DMARC gap but security.txt could not be read (timeouts, challenges, soft 200)
};

export const BANDS: Band[] = [
  { id: "Q08", rankLow: 900000, rankHigh: 1000000, run: "2026-09-30", sampled: 40, live: 39, noRecord: 10, pNone: 18, quarantine: 8, reject: 3, dmarcGap: 28, doubleGap: 21, unknown: 7 },
  { id: "Q30", rankLow: 800000, rankHigh: 900000, run: "2026-09-30", sampled: 45, live: 43, noRecord: 10, pNone: 24, quarantine: 6, reject: 3, dmarcGap: 34, doubleGap: 22, unknown: 12 },
  { id: "Q32", rankLow: 700000, rankHigh: 800000, run: "2026-09-30", sampled: 40, live: 39, noRecord: 11, pNone: 17, quarantine: 4, reject: 7, dmarcGap: 28, doubleGap: 21, unknown: 7 },
  { id: "Q37", rankLow: 600000, rankHigh: 700000, run: "2026-09-30", sampled: 40, live: 40, noRecord: 11, pNone: 18, quarantine: 6, reject: 5, dmarcGap: 29, doubleGap: 22, unknown: 7 },
  { id: "Q43", rankLow: 500000, rankHigh: 600000, run: "2026-09-30", sampled: 40, live: 40, noRecord: 9, pNone: 23, quarantine: 4, reject: 4, dmarcGap: 32, doubleGap: 15, unknown: 17 },
  { id: "Q47", rankLow: 400000, rankHigh: 500000, run: "2026-10-01", sampled: 40, live: 37, noRecord: 11, pNone: 15, quarantine: 11, reject: 0, dmarcGap: 26, doubleGap: 16, unknown: 9 },
  { id: "Q51", rankLow: 300000, rankHigh: 400000, run: "2026-10-01", sampled: 40, live: 40, noRecord: null, pNone: null, quarantine: null, reject: null, dmarcGap: 27, doubleGap: 20, unknown: 7 },
  { id: "Q55", rankLow: 200000, rankHigh: 300000, run: "2026-10-01", sampled: 40, live: 40, noRecord: null, pNone: null, quarantine: null, reject: null, dmarcGap: 23, doubleGap: 16, unknown: 7 },
];

export const pct = (n: number, d: number) => (100 * n) / d;
export const pct1 = (n: number, d: number) => `${pct(n, d).toFixed(1)}%`;

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [100 * (centre - half), 100 * (centre + half)];
}

const sum = (f: (b: Band) => number) => BANDS.reduce((a, b) => a + f(b), 0);

export function totals() {
  const live = sum((b) => b.live);
  const sampled = sum((b) => b.sampled);
  const dmarcGap = sum((b) => b.dmarcGap);
  const doubleGap = sum((b) => b.doubleGap);
  const unknown = sum((b) => b.unknown);
  const full = BANDS.filter((b) => b.noRecord !== null);
  const mix = {
    live: full.reduce((a, b) => a + b.live, 0),
    noRecord: full.reduce((a, b) => a + (b.noRecord as number), 0),
    pNone: full.reduce((a, b) => a + (b.pNone as number), 0),
    quarantine: full.reduce((a, b) => a + (b.quarantine as number), 0),
    reject: full.reduce((a, b) => a + (b.reject as number), 0),
    bands: full.length,
  };
  return { sampled, live, dmarcGap, doubleGap, unknown, mix, ci: wilson(doubleGap, live), ciGap: wilson(dmarcGap, live) };
}

// The third-party figure behind "99.76% of domains publish no security.txt".
export const SECURITY_TXT_SURVEY = {
  publisher: "IoT Defense",
  title: "The State of Security.txt Adoption: An Analysis of 240 Million Domains in 2026",
  url: "https://blog.iotdef.com/the-state-of-security-txt-adoption-an-analysis-of-240-million-domains-in-2026/",
  published: "2026-02-01",
  scanned: 241285150,
  withFile: 573123,
};
export const surveyNoFilePct = () => 100 * (1 - SECURITY_TXT_SURVEY.withFile / SECURITY_TXT_SURVEY.scanned);

export function csvText(): string {
  const head = "band,rank_low,rank_high,run_date,sampled,live,no_dmarc_record,dmarc_p_none,dmarc_quarantine,dmarc_reject,dmarc_gap,double_gap,security_txt_unreadable,double_gap_rate_pct";
  const cell = (v: number | null) => (v === null ? "" : String(v));
  const rows = BANDS.map((b, i) => [i + 1, b.rankLow, b.rankHigh, b.run, b.sampled, b.live, cell(b.noRecord), cell(b.pNone), cell(b.quarantine), cell(b.reject), b.dmarcGap, b.doubleGap, b.unknown, pct(b.doubleGap, b.live).toFixed(1)].join(","));
  const t = totals();
  // the policy mix is only recorded for 6 of the 8 bands, so the pooled row leaves those four columns empty
  rows.push(["all", "200000", "1000000", "", t.sampled, t.live, "", "", "", "", t.dmarcGap, t.doubleGap, t.unknown, pct(t.doubleGap, t.live).toFixed(1)].join(","));
  return [head, ...rows].join("\n") + "\n";
}
