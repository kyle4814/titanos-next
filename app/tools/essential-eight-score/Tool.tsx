"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { STRATEGIES, TOTAL_QUESTIONS, ACSC_MODEL_URL, type Answer } from "./questions";
import { score, resultText } from "./score";

const LABEL: Record<Answer, string> = { yes: "Yes", partial: "Partly", no: "No", na: "Does not apply" };
const BAND_TEXT: Record<string, string> = {
  start: "Early days. That is a normal place to start, and the gap list below is your order of work.",
  partway: "Partway there. Some controls are in place and a few clear gaps remain.",
  close: "Close to Maturity Level One on most strategies. Finish the gaps below, then collect evidence.",
  "all-yes": "Every answer is Yes. Keep the evidence (screenshots, reports, policy settings), because a self-check is not proof.",
};

export default function Tool() {
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({});
  const [copied, setCopied] = useState(false);
  const r = useMemo(() => score(answers), [answers]);
  const done = r.answered === r.total;

  const set = (id: string, a: Answer) => setAnswers((p) => ({ ...p, [id]: a }));
  const copy = async () => {
    try { await navigator.clipboard.writeText(resultText(r)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the print button still works */ }
  };

  return (
    <div className="e8-tool">
      <div className="e8-progress" role="status" aria-live="polite">
        <div className="e8-progress__bar" aria-hidden="true"><span style={{ width: `${Math.round((r.answered / TOTAL_QUESTIONS) * 100)}%` }} /></div>
        <p>{r.answered} of {TOTAL_QUESTIONS} answered. Nothing you choose leaves this page.</p>
      </div>

      {STRATEGIES.map((s, i) => (
        <section key={s.id} className="e8-strategy" aria-labelledby={`e8-h-${s.id}`}>
          <header>
            <span className="e8-num">{i + 1}</span>
            <div>
              <h3 id={`e8-h-${s.id}`}>{s.name}</h3>
              <p>{s.plain}</p>
            </div>
          </header>
          {s.questions.map((q) => (
            <fieldset key={q.id} className="e8-q">
              <legend>{q.text}</legend>
              <p className="e8-help">{q.help}</p>
              <div className="e8-opts" role="radiogroup">
                {(q.na ? (["yes", "partial", "no", "na"] as Answer[]) : (["yes", "partial", "no"] as Answer[])).map((a) => (
                  <label key={a} className={`e8-opt e8-opt--${a}`} data-on={answers[q.id] === a}>
                    <input type="radio" name={q.id} value={a} checked={answers[q.id] === a} onChange={() => set(q.id, a)} />
                    <span>{LABEL[a]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      ))}

      <section className="e8-result" aria-labelledby="e8-result-h" id="your-score">
        <h3 id="e8-result-h">Your quick score</h3>
        {r.answered === 0 ? (
          <p className="e8-muted">Answer the questions above and your score, strategy breakdown and gap list appear here. If you are unsure, answer No: an honest No is more useful than an optimistic Yes.</p>
        ) : (
          <>
            <div className="e8-score" aria-live="polite">
              <div className="e8-score__n"><strong>{r.pct}</strong><span>%</span></div>
              <div>
                <p className="e8-score__t">{done ? "Overall estimate" : "Running estimate"}: {r.points} of {r.max} points</p>
                <p className="e8-muted">{done ? BAND_TEXT[r.band] : `Unanswered questions count as zero until you answer them (${r.total - r.answered} to go).`}</p>
              </div>
            </div>
            <ul className="e8-bars">
              {r.strategies.map((s) => (
                <li key={s.id}>
                  <span className="e8-bars__name">{s.name}</span>
                  <span className="e8-bars__track" aria-hidden="true"><span style={{ width: `${s.pct ?? 0}%` }} /></span>
                  <span className="e8-bars__pct">{s.pct === null ? "n/a" : `${s.pct}%`}{s.allYes ? " (all yes)" : ""}</span>
                </li>
              ))}
            </ul>

            <h4>Your gap list ({r.gaps.length})</h4>
            {r.gaps.length === 0 ? (
              <p className="e8-muted">{done ? "No gaps in your answers." : "No gaps so far in the questions you have answered."}</p>
            ) : (
              <ol className="e8-gaps">
                {r.gaps.map((g) => (
                  <li key={g.questionId}>
                    <span className={`e8-flag e8-flag--${g.answer}`}>{g.answer === "no" ? "No" : "Partly"}</span>
                    <div>
                      <p className="e8-gap__s">{g.strategyName}</p>
                      <p>{g.fix}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="e8-actions">
              <button type="button" className="pe-btn pe-btn--dark" onClick={copy}>{copied ? "Copied" : "Copy results as text"}</button>
              <button type="button" className="pe-btn pe-btn--dark" onClick={() => window.print()}>Print or save as PDF</button>
              <button type="button" className="pe-btn pe-btn--dark" onClick={() => setAnswers({})}>Start again</button>
            </div>
            <div className="e8-next">
              <p><strong>Turn the gap list into evidence.</strong> The Essential Eight Maturity Level One Checklist gives you one page per strategy, what evidence to keep and a gap sheet to hand to your IT provider.</p>
              <div className="e8-actions">
                <Link href="/shop" className="pe-btn pe-btn--gold">See it in the shop</Link>
                <Link href="/products/essential-eight-ml1-checklist" className="pe-btn pe-btn--dark">What is in the checklist</Link>
              </div>
            </div>
          </>
        )}
        <p className="e8-small">Source for every question: <a href={ACSC_MODEL_URL} rel="noopener">ASD Essential Eight maturity model, Appendix A (Maturity Level One)</a>. This is an estimate to help you plan. It is not an ASD assessment, an audit or a certification.</p>
      </section>
    </div>
  );
}
