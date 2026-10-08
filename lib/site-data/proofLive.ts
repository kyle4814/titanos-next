// proof.json is generated from the 12:52 baseline. The fleet figures on it move every hour, so they are overlaid here from lib/ledger.json
// (written by klinge-kernel bin/site_ledger_export.py from NUMBERS.json). Everything else stays a dated baseline receipt.
import raw from "./proof.json";
import { v, int, dec, AS_OF_NUMBERS } from "../ledger";

const day = AS_OF_NUMBERS.slice(0, 10);
const usd2 = (k: Parameters<typeof v>[0]) => `US$${v(k).toFixed(2)}`;

type Star = (typeof raw.stars)[number];
const OVERLAY: Record<string, Partial<Star>> = {
  s_jobs: { display: `${int("fleet_jobs_24h")} jobs`, caption: "Worker jobs finished in the last 24 hours (job ledger)" },
  s_fail: { display: `${dec("fleet_fail_rate_24h")}%`, caption: "Fleet jobs that failed or got stuck in the last 24 hours" },
  s_median: { display: `${dec("fleet_median_job_min")} min`, caption: "Median time per job over the last 24 hours" },
  s_usd_job: { display: `US$${v("usd_per_job_fleet").toFixed(2)}`, caption: `Fleet-wide cost per job today over ${int("fleet_jobs_24h")} jobs. An upper bound: it includes the interactive session.` },
  s_usd_today: { display: usd2("spend_today_usd"), caption: "Spent in one day, API-equivalent pricing" },
  s_tokens: { display: `${int("tokens_after")} tokens`, caption: "Median a worker reads before acting" },
};

export const proof = {
  ...raw,
  stars: raw.stars.map((s) => (OVERLAY[s.id] ? { ...s, ...OVERLAY[s.id], date: day } : s)),
  fleetCost: {
    ...raw.fleetCost,
    after: v("usd_per_job_fleet"),
    jobs: v("fleet_jobs_24h"),
    today: v("spend_today_usd"),
    afterText: `US$${v("usd_per_job_fleet").toFixed(2)}`,
    jobsText: int("fleet_jobs_24h"),
    todayText: usd2("spend_today_usd"),
    date: day,
  },
};
