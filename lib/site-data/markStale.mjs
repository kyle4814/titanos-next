// markStale: EV6 for the Proof Wall. A row measured more than maxDays before `today` is rewritten for display only:
// its value becomes "UNKNOWN", the date it was last measured is kept in lastMeasured, and staleReason says why.
// The row is never deleted and no figure is invented: numeric fields become null (bar widths 0), text fields "UNKNOWN".
// Pure: the input rows are not mutated and nothing is fetched. Rows with no ISO date are returned unchanged (the detector flags them).
export const MAX_DAYS = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_VALUE_KEYS = ["display", "beforeText", "afterText", "factorText", "jobsText", "todayText"];
const NUMERIC_VALUE_KEYS = ["before", "after", "jobs", "today"];
const PCT_KEYS = ["beforePct", "afterPct"];

export function ageDays(date, today) {
  if (!ISO.test(date || "") || !ISO.test(today || "")) return null;
  return Math.floor((Date.parse(today) - Date.parse(date)) / 86400000);
}

export function isStale(row, today, maxDays = MAX_DAYS) {
  const age = ageDays(row && row.date, today);
  return age !== null && age > maxDays;
}

export function markStale(rows, today, maxDays = MAX_DAYS) {
  return rows.map((r) => {
    const age = ageDays(r.date, today);
    if (age === null || age <= maxDays) return r;
    const out = { ...r, value: "UNKNOWN", stale: true, lastMeasured: r.date, staleReason: `measured ${r.date}, ${age} days old (limit ${maxDays}); re-measure needed` };
    for (const k of TEXT_VALUE_KEYS) if (k in r) out[k] = "UNKNOWN";
    for (const k of NUMERIC_VALUE_KEYS) if (k in r) out[k] = null;
    for (const k of PCT_KEYS) if (k in r) out[k] = 0;
    if ("titleText" in r) out.titleText = `UNKNOWN now (last measured ${r.date})`;
    if ("caption" in r) out.caption = `UNKNOWN now. Last measured ${r.date}.`;
    return out;
  });
}

// Does a (rendered) row still carry a numeric value although it is older than maxDays?
export function numericLeaks(rows, today, maxDays = MAX_DAYS) {
  const out = [];
  for (const r of rows) {
    if (!isStale(r, today, maxDays)) continue;
    const bad = [];
    for (const k of TEXT_VALUE_KEYS) if (k in r && r[k] !== "UNKNOWN") bad.push(k);
    for (const k of NUMERIC_VALUE_KEYS) if (k in r && r[k] !== null) bad.push(k);
    for (const k of PCT_KEYS) if (k in r && r[k] !== 0) bad.push(k);
    if (r.value !== "UNKNOWN" || !r.lastMeasured || !r.staleReason) bad.push("value/lastMeasured/staleReason");
    if (bad.length) out.push(`${r.id ?? "(no id)"}: rendered with a figure (${bad.join(", ")}), measured ${r.date}`);
  }
  return out;
}
