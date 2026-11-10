// traceRow: does every number a Proof Wall row prints appear in the source file and row it names? Pure (the caller supplies the parsed
// source). A row that prints UNKNOWN has no number to trace and passes. A row that prints a figure with no sourceFile/sourceRow, a source
// row that cannot be found, a figure the source row does not contain, or a date the source row does not support is reported.
const ISO = /^\d{4}-\d{2}-\d{2}/;
const SHOWN_KEYS = ["display", "beforeText", "afterText", "jobsText", "todayText", "workerSpendText"];
const nums = (text) => (String(text).match(/-?\d[\d,]*\.?\d*/g) || []).map((t) => Number(t.replace(/,/g, ""))).filter(Number.isFinite);

export const isUnknownRow = (r) => r.value === "UNKNOWN" || r.label === "UNKNOWN" || r.display === "UNKNOWN" || r.afterText === "UNKNOWN";

// the source row as text + the date(s) it supports
export function sourceRowOf(src, sourceRow) {
  if (Array.isArray(src.rows)) {
    const r = src.rows.find((x) => x.vector === sourceRow);
    return r ? { text: JSON.stringify(r), dates: [String(src.ts).slice(0, 10), ...(String(r.now).match(/\d{4}-\d{2}-\d{2}/g) || [])] } : null;
  }
  if (Array.isArray(src.metrics)) {
    const m = src.metrics.find((x) => x.id === sourceRow);
    return m ? { text: JSON.stringify(m), dates: [m.date] } : null;
  }
  return null;
}

const close = (a, b) => Math.abs(a - b) <= Math.max(0.006 * Math.abs(b), 0.0051);

/** @returns string[] problems (empty = traceable) */
export function traceRow(row, loadSource) {
  const id = row.id ?? "(no id)";
  if (isUnknownRow(row)) return [];
  if (!row.sourceFile || !row.sourceRow) return [`${id}: prints a figure but names no sourceFile/sourceRow`];
  if (!ISO.test(row.date || "")) return [`${id}: no measured date`];
  let src;
  try { src = loadSource(row.sourceFile); } catch { return [`${id}: sourceFile ${row.sourceFile} is not readable`]; }
  const found = sourceRowOf(src, row.sourceRow);
  if (!found) return [`${id}: source row "${row.sourceRow}" not found in ${row.sourceFile}`];
  const out = [];
  if (!found.dates.includes(row.date)) out.push(`${id}: date ${row.date} is not supported by the source row (${found.dates.join(", ")})`);
  const have = nums(found.text);
  const shown = SHOWN_KEYS.filter((k) => k in row && row[k] !== "UNKNOWN" && row[k] != null).flatMap((k) => nums(row[k]).map((n) => [k, n]));
  for (const [k, n] of shown) {
    const ok = have.some((s) => close(n, s) || close(n, s / 1024) || close(n, s / 100));
    if (!ok) out.push(`${id}: ${k} prints ${n}, which is not in source row "${row.sourceRow}" of ${row.sourceFile}`);
  }
  return out;
}
