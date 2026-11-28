import { STRATEGIES, type Answer, type Strategy } from "./questions.ts";

export type StrategyResult = { id: string; name: string; points: number; max: number; pct: number | null; answered: number; total: number; allYes: boolean };
export type Gap = { strategyId: string; strategyName: string; questionId: string; text: string; fix: string; answer: "no" | "partial" };
export type Result = { points: number; max: number; pct: number; answered: number; total: number; strategies: StrategyResult[]; gaps: Gap[]; band: "start" | "partway" | "close" | "all-yes" };

const POINTS: Record<Answer, number | null> = { yes: 1, partial: 0.5, no: 0, na: null };

/** Pure scoring: yes = 1, partial = half, no = 0, does-not-apply is left out of both sides. Unanswered counts as nothing yet. */
export function score(answers: Record<string, Answer | undefined>, strategies: Strategy[] = STRATEGIES): Result {
  const out: StrategyResult[] = [];
  const gaps: Gap[] = [];
  let points = 0, max = 0, answered = 0, total = 0;
  for (const s of strategies) {
    let p = 0, m = 0, a = 0, yes = 0, applicable = 0;
    for (const q of s.questions) {
      total++;
      const ans = answers[q.id];
      if (!ans) { m += 1; applicable++; continue; }
      a++;
      const v = POINTS[ans];
      if (v === null) continue;
      applicable++;
      m += 1; p += v;
      if (ans === "yes") yes++;
      else gaps.push({ strategyId: s.id, strategyName: s.name, questionId: q.id, text: q.text, fix: q.fix, answer: ans as "no" | "partial" });
    }
    answered += a;
    points += p; max += m;
    out.push({ id: s.id, name: s.name, points: p, max: m, pct: m ? Math.round((p / m) * 100) : null, answered: a, total: s.questions.length, allYes: applicable > 0 && yes === applicable && a === s.questions.length });
  }
  // gaps: outright No first, then Partial, original order kept inside each
  gaps.sort((x, y) => (x.answer === y.answer ? 0 : x.answer === "no" ? -1 : 1));
  const pct = max ? Math.round((points / max) * 100) : 0;
  const complete = answered === total;
  const band = complete && gaps.length === 0 ? "all-yes" : pct >= 75 ? "close" : pct >= 40 ? "partway" : "start";
  return { points, max, pct, answered, total, strategies: out, gaps, band };
}

export function resultText(r: Result): string {
  const lines = [
    `Essential Eight quick score (Maturity Level One self-check), titanos.tech/tools/essential-eight-score`,
    `Overall: ${r.pct}% (${r.points} of ${r.max} points, ${r.answered} of ${r.total} questions answered). An estimate only, not an ASD assessment.`,
    "",
    ...r.strategies.map((s) => `${s.name}: ${s.pct === null ? "n/a" : s.pct + "%"}${s.allYes ? " (all yes)" : ""}`),
  ];
  if (r.gaps.length) {
    lines.push("", "Gaps to close:");
    r.gaps.forEach((g, i) => lines.push(`${i + 1}. [${g.strategyName}] ${g.answer === "no" ? "No" : "Partly"}: ${g.fix}`));
  }
  return lines.join("\n");
}
