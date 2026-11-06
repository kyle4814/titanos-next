// F45 scorer: joins the ask log to hand labels and decides the 80% answer-rate kill test. Pure; no clock, no fs.
import type { AskRow } from "./asklog.ts";

export const MIN_SAMPLE = 200;       // fixed: the verdict is refused below this many labelled asks
export const TARGET = 0.8;
export type Answerable = "yes" | "no" | "partial";
export type Label = { ask_id: string; correct_intent: string; answerable: Answerable };

export function parseLabels(text: string, label = "labels"): Label[] {
  const out: Label[] = [];
  const lines = text.split("\n");
  let header = false;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.startsWith("#")) return;
    const c = line.split("\t");
    if (!header) {
      if (c.join("\t") !== "ask_id\tcorrect_intent\tanswerable") throw new Error(label + " line " + (i + 1) + ": header must be ask_id<TAB>correct_intent<TAB>answerable");
      header = true; return;
    }
    if (c.length !== 3) throw new Error(label + " line " + (i + 1) + ": expected 3 tab-separated columns");
    const [ask_id, correct_intent, a] = c.map((s) => s.trim());
    if (!/^[0-9a-f]{12}$/.test(ask_id)) throw new Error(label + " line " + (i + 1) + ": bad ask_id");
    if (!correct_intent) throw new Error(label + " line " + (i + 1) + ": empty correct_intent (use 'none' if no shelf should answer)");
    if (a !== "yes" && a !== "no" && a !== "partial") throw new Error(label + " line " + (i + 1) + ": answerable must be yes, no or partial, got '" + a + "'");
    out.push({ ask_id, correct_intent, answerable: a });
  });
  if (!header && lines.some((l) => l.trim() && !l.startsWith("#"))) throw new Error(label + ": missing header");
  return out;
}

export type Score = {
  verdict: "PASS" | "FAIL" | "INSUFFICIENT SAMPLE";
  logged: number; labelled: number; unlabelled: number; min: number;
  yes: number; partial: number; no: number;
  answerRate: number | null; partialRate: number | null; wilsonLow: number | null; wilsonHigh: number | null;
  intentAccuracy: number | null;
  unanswered: { ask_id: string; q: string; intent: string; correct_intent: string }[];
  synthetic: boolean;
  lowerBoundBelowTarget: boolean;
};

export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export function score(rows: AskRow[], labels: Label[]): Score {
  const byId = new Map<string, AskRow>();
  for (const r of rows) { if (byId.has(r.ask_id)) throw new Error("duplicate ask_id in log: " + r.ask_id); byId.set(r.ask_id, r); }
  const seen = new Set<string>();
  for (const l of labels) {
    if (seen.has(l.ask_id)) throw new Error("duplicate label for ask_id " + l.ask_id);
    seen.add(l.ask_id);
    if (!byId.has(l.ask_id)) throw new Error("label for ask_id " + l.ask_id + " has no row in the log");
  }
  let yes = 0, partial = 0, no = 0, intentOk = 0;
  const unanswered: Score["unanswered"] = [];
  for (const l of labels) {
    const r = byId.get(l.ask_id)!;
    if (l.answerable === "yes") yes++; else if (l.answerable === "partial") partial++; else { no++; unanswered.push({ ask_id: l.ask_id, q: r.q, intent: r.intent, correct_intent: l.correct_intent }); }
    if (r.intent === l.correct_intent) intentOk++;
  }
  const n = labels.length;
  const answerRate = n ? yes / n : null;
  const [lo, hi] = n ? wilson(yes, n) : [null, null];
  const verdict: Score["verdict"] = n < MIN_SAMPLE ? "INSUFFICIENT SAMPLE" : (answerRate as number) >= TARGET ? "PASS" : "FAIL";
  return {
    verdict, logged: rows.length, labelled: n, unlabelled: rows.length - n, min: MIN_SAMPLE, yes, partial, no,
    answerRate, partialRate: n ? partial / n : null, wilsonLow: lo, wilsonHigh: hi, intentAccuracy: n ? intentOk / n : null,
    unanswered, synthetic: rows.some((r) => r.synthetic === true), lowerBoundBelowTarget: verdict === "PASS" && (lo as number) < TARGET,
  };
}

const pct = (x: number | null) => (x === null ? "n/a" : (x * 100).toFixed(1) + "%");
export function render(s: Score): string {
  const L: string[] = [];
  if (s.synthetic) L.push("DATA: SYNTHETIC. This run tests the scorer, it says nothing about real visitors.");
  L.push("logged asks: " + s.logged + "   labelled: " + s.labelled + "   unlabelled: " + s.unlabelled);
  L.push("answer rate (yes): " + pct(s.answerRate) + " (" + s.yes + "/" + s.labelled + ")   partial rate: " + pct(s.partialRate) + " (" + s.partial + ")   no: " + s.no);
  L.push("95% interval on answer rate (Wilson): " + (s.wilsonLow === null ? "n/a" : pct(s.wilsonLow) + " to " + pct(s.wilsonHigh)));
  L.push("intent accuracy (matched intent equals correct_intent): " + pct(s.intentAccuracy));
  L.push("unanswered (" + s.unanswered.length + "):");
  for (const u of s.unanswered) L.push("  " + u.ask_id + "  routed=" + u.intent + "  correct=" + u.correct_intent + "  q=" + JSON.stringify(u.q));
  if (s.verdict === "INSUFFICIENT SAMPLE") L.push("INSUFFICIENT SAMPLE: " + s.labelled + " labelled asks, need " + s.min + " before any verdict on the 80% target.");
  else L.push("VERDICT: " + s.verdict + " (answer rate " + pct(s.answerRate) + " against " + TARGET * 100 + "%, n=" + s.labelled + ")" + (s.lowerBoundBelowTarget ? " NOTE: point estimate passes but the 95% lower bound is below 80%." : ""));
  return L.join("\n");
}
