"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/courses";

const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 22px", marginBottom: 18 } as const;

export default function CourseQuiz({ questions, passPct, certificateHref }: { questions: QuizQuestion[]; passPct: number; certificateHref: string }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const score = questions.filter((q, i) => picked[i] === q.answer).length;
  const pct = Math.round((score / questions.length) * 100);
  const passed = pct >= passPct;
  const complete = Object.keys(picked).length === questions.length;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (complete) setDone(true); }}>
      {questions.map((q, i) => (
        <fieldset key={i} style={{ ...card, margin: "0 0 18px" }}>
          <legend style={{ color: "var(--gold)", padding: "0 8px" }}>Question {i + 1} of {questions.length}</legend>
          <p style={{ color: "var(--text)", lineHeight: 1.7, marginBottom: 12 }}>{q.q}</p>
          {q.options.map((o, j) => {
            const mark = done ? (j === q.answer ? "✓ " : picked[i] === j ? "✗ " : "") : "";
            return (
              <label key={j} style={{ display: "block", padding: "6px 0", color: "var(--text)", cursor: done ? "default" : "pointer" }}>
                <input type="radio" name={`q${i}`} disabled={done} checked={picked[i] === j} onChange={() => setPicked({ ...picked, [i]: j })} style={{ marginRight: 10 }} />
                {mark}{o}
              </label>
            );
          })}
          {done && <p style={{ color: "var(--ice)", marginTop: 10, lineHeight: 1.7 }}>{picked[i] === q.answer ? "Correct. " : "Not quite. "}{q.why}</p>}
        </fieldset>
      ))}
      {!done && <button type="submit" disabled={!complete} className="label-system" style={{ padding: "12px 22px", border: "1px solid var(--gold-dim)", background: "var(--card)", color: "var(--gold)", cursor: complete ? "pointer" : "not-allowed", opacity: complete ? 1 : 0.55 }}>{complete ? "Check my answers" : `Answer all ${questions.length} questions to check`}</button>}
      {done && (
        <div role="status" style={card}>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-lg)", marginBottom: 8 }}>You scored {score} of {questions.length} ({pct}%). The pass mark is {passPct}%.</p>
          {passed
            ? <p style={{ color: "var(--ok)" }}>Passed. <a href={certificateHref} style={{ color: "var(--ice)" }}>Open your certificate page</a>.</p>
            : <p style={{ color: "var(--text)" }}>Not there yet, and that is fine. Re-read the lessons the explanations point to, then <button type="button" onClick={() => { setPicked({}); setDone(false); }} style={{ color: "var(--ice)", background: "none", border: 0, cursor: "pointer", textDecoration: "underline" }}>try again</button>.</p>}
        </div>
      )}
    </form>
  );
}
