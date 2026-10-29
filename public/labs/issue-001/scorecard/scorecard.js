/**
 * Accepted Agent Throughput Scorecard - calculation core.
 *
 * Demonblade Labs, Issue 001. No dependencies, no network, no storage.
 * Every function is pure so the same code runs in the browser and under `node --test`.
 *
 * Vocabulary (the whole point of this tool is that these are fixed before anyone argues
 * about whether more workers helped):
 *
 *   attempted      tasks dispatched to workers in the window
 *   accepted       tasks an independent reviewer marked ACCEPTED (the only output that counts)
 *   rejected       tasks reviewed and not accepted
 *   wallHours      wall-clock hours the window spans
 *   workerHours    summed ACTIVE worker time (lane-hours). 3 workers busy 2 h = 6 workerHours
 *   reviewHours    human review + integration time spent on this window
 *   modelCostUsd   model/API dollars spent in the window
 *   reviewRateUsd  optional cost of an hour of human review, for a single total figure
 *   attributableAccepted
 *                  accepted results that fall inside a window where worker time was
 *                  actually observed. If your instrument samples worker count on a timer,
 *                  this is usually LOWER than `accepted`, and every per-worker-hour number
 *                  you quote is optimistic by 1 / coverage.
 */

/* Loaded two ways on purpose: a classic <script src> so the page works straight off the
   filesystem with no server (ES modules are CORS-blocked on file://), and module.exports
   so the same source is what the test suite exercises. One copy, no drift. */
;(function (root) {
  "use strict";


const ZERO_DIV = null; // every ratio with an empty denominator is null, never 0, never Infinity

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const nz = (v) => (isNum(v) && v > 0 ? v : null);           // positive-or-null denominator
const ratio = (a, b) => (isNum(a) && nz(b) !== null ? a / b : ZERO_DIV);
const round = (v, p = 2) => (isNum(v) ? Number(v.toFixed(p)) : v);

/** Input problems a reader must see before they trust any number below. */
function validate(r = {}) {
  const errors = [], warnings = [];
  const fields = ["attempted", "accepted", "rejected", "wallHours", "workerHours",
                  "reviewHours", "modelCostUsd", "reviewRateUsd", "retries",
                  "attributableAccepted", "workers"];
  for (const f of fields) {
    const v = r[f];
    if (v === undefined || v === null || v === "") continue;
    if (!isNum(v)) errors.push(`${f}: not a finite number`);
    else if (v < 0) errors.push(`${f}: negative values are not meaningful (${v})`);
  }
  if (isNum(r.accepted) && isNum(r.attempted) && r.accepted > r.attempted)
    errors.push(`accepted (${r.accepted}) exceeds attempted (${r.attempted})`);
  if (isNum(r.accepted) && isNum(r.rejected) && isNum(r.attempted) &&
      r.accepted + r.rejected > r.attempted)
    warnings.push(`accepted + rejected (${r.accepted + r.rejected}) exceeds attempted (${r.attempted}): some tasks counted twice, or attempted is stale`);
  if (isNum(r.attributableAccepted) && isNum(r.accepted) && r.attributableAccepted > r.accepted)
    errors.push(`attributableAccepted (${r.attributableAccepted}) exceeds accepted (${r.accepted})`);
  if (isNum(r.workerHours) && isNum(r.wallHours) && isNum(r.workers) &&
      nz(r.wallHours) && r.workerHours > r.wallHours * r.workers + 1e-9)
    warnings.push(`workerHours (${r.workerHours}) exceeds workers x wallHours (${r.workers * r.wallHours}): worker count or active time is wrong`);
  if (nz(r.accepted) === null && nz(r.attempted) !== null)
    warnings.push("zero accepted results: throughput and cost per accepted are undefined, not zero");
  return { ok: errors.length === 0, errors, warnings };
}

/** The core scorecard for one window. Returns nulls, never fake zeros. */
function score(r = {}) {
  const v = validate(r);
  const accepted = isNum(r.accepted) ? r.accepted : null;
  const attributable = isNum(r.attributableAccepted) ? r.attributableAccepted : accepted;

  const coverage = ratio(attributable, accepted);
  const workerMinPerAccepted = ratio(isNum(r.workerHours) ? r.workerHours * 60 : null, attributable);
  const totalCost = (isNum(r.modelCostUsd) ? r.modelCostUsd : 0) +
    (isNum(r.reviewHours) && isNum(r.reviewRateUsd) ? r.reviewHours * r.reviewRateUsd : 0);
  const hasCost = isNum(r.modelCostUsd) || (isNum(r.reviewHours) && isNum(r.reviewRateUsd));

  return {
    valid: v.ok, errors: v.errors, warnings: v.warnings,

    acceptanceRatio:        round(ratio(accepted, r.attempted), 3),
    acceptedPerWallHour:    round(ratio(accepted, r.wallHours), 3),
    acceptedPerWorkerHour:  round(ratio(attributable, r.workerHours), 3),
    workerMinPerAccepted:   round(workerMinPerAccepted, 1),
    modelCostPerAccepted:   round(ratio(isNum(r.modelCostUsd) ? r.modelCostUsd : null, accepted), 2),
    totalCostPerAccepted:   hasCost ? round(ratio(totalCost, accepted), 2) : ZERO_DIV,
    integrationRatio:       round(ratio(r.reviewHours, r.workerHours), 3),
    reworkShare:            round(ratio(r.retries, r.attempted), 3),

    // Attribution integrity: the half of the picture a timer-sampled instrument hides.
    attributionCoverage:    round(coverage, 3),
    // What the per-worker-hour figure would be if the uncovered results cost the same rate.
    correctedWorkerMinPerAccepted:
      round(ratio(isNum(r.workerHours) ? r.workerHours * 60 : null,
                  isNum(attributable) ? attributable : null), 1),
    naiveWorkerMinPerAccepted:
      round(ratio(isNum(r.workerHours) ? r.workerHours * 60 : null, accepted), 1),
  };
}

/**
 * Polling-interval check for any instrument that reads a worker count on a timer.
 *
 * What it can tell you: whether a worker can start and finish inside one polling
 * interval and therefore never be observed at all.
 *
 * What it deliberately refuses to tell you: that any polling interval is safe.
 * No fixed interval guarantees an arbitrarily short job is seen. Halving the
 * interval bounds misses only for workers that last longer than the interval.
 * The only reliable fix is per-worker start and end events.
 *
 * `shortestWorkerMin` is the SHORTEST worker you care about observing, not the
 * longest one your timeout allows. `workerLifetimeMin` is accepted as an alias
 * for compatibility and means the same thing here.
 */
function samplingAdequacy(o = {}) {
  const period = o.samplePeriodMin;
  const shortest = o.shortestWorkerMin !== undefined ? o.shortestWorkerMin : o.workerLifetimeMin;
  if (nz(period) === null || nz(shortest) === null)
    return { verdict: "UNKNOWN", boundedAt: ZERO_DIV, ratio: ZERO_DIV,
             note: "give a positive polling interval and the shortest worker you need to observe" };
  const boundedAt = shortest / 2;
  const r = period / shortest;
  const verdict = period >= shortest ? "CAN MISS WORKERS"
    : period > boundedAt ? "MISSES POSSIBLE"
    : "MISSES BOUNDED AT THIS LENGTH";
  const tail = " Nothing shorter than that is guaranteed to be seen by any fixed interval; per-worker start and end events are the only reliable fix.";
  return {
    verdict, boundedAt: round(boundedAt, 1), ratio: round(r, 2),
    note: (verdict === "CAN MISS WORKERS"
      ? `a ${shortest} min worker fits inside your ${period} min interval, so it can start and finish unobserved and its time is counted as zero. Polling every ${round(boundedAt, 1)} min would bound misses for workers of at least ${shortest} min.`
      : verdict === "MISSES POSSIBLE"
        ? `a ${shortest} min worker spans your ${period} min interval only sometimes. Poll every ${round(boundedAt, 1)} min or faster to be sure of seeing workers of at least ${shortest} min.`
        : `every worker of at least ${shortest} min crosses at least one sample at a ${period} min interval.`) + tail,
  };
}

/**
 * Should you add workers? Compares two measured windows on accepted output per
 * worker-hour. Deliberately refuses a verdict when either side has no accepted result.
 */
function compare(a = {}, b = {}, { tolerance = 0.05 } = {}) {
  const sa = score(a), sb = score(b);
  const x = sa.acceptedPerWorkerHour, y = sb.acceptedPerWorkerHour;
  if (!isNum(x) || !isNum(y) || x === 0)
    return { verdict: "UNDECIDABLE", deltaPct: ZERO_DIV, a: sa, b: sb,
             note: "one side has no accepted result or no observed worker time" };
  const deltaPct = (y - x) / x;
  const verdict = deltaPct > tolerance ? "SCALING HELPED"
    : deltaPct < -tolerance ? "SCALING HURT" : "NO DETECTABLE DIFFERENCE";
  return { verdict, deltaPct: round(deltaPct * 100, 1), a: sa, b: sb,
           note: `accepted per worker-hour ${x} -> ${y}; tolerance +/-${tolerance * 100}%` };
}

  const API = { ZERO_DIV, validate, score, samplingAdequacy, compare };
  if (typeof module === "object" && module && module.exports) module.exports = API;
  root.Scorecard = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
