"use client";
import Link from "next/link";
import { useState } from "react";
import { QUESTIONS, assess, type Answer, type QuestionId } from "./logic";

const LABEL: Record<QuestionId, string> = {
  turnover: "Turnover over AU$3 million",
  health: "Health service provider",
  trading: "Trading in personal information",
  contract: "Commonwealth contracted service provider",
  reporting: "AML/CTF reporting entity",
  related: "Part of a related group of companies",
  other: "Tax file number, credit, health record or opt-in rules",
};

const VERDICT = {
  covered: {
    tag: "Likely covered",
    head: "The Privacy Act probably applies to you",
    body: "At least one answer takes you outside the small business exemption. That means the Australian Privacy Principles apply to your business, including a privacy policy, collection notices, security of personal information and the notifiable data breaches scheme.",
  },
  check: {
    tag: "Needs a closer look",
    head: "You may be covered, and a quick check will settle it",
    body: "No answer clearly puts you inside the Act, but at least one was a yes on a special rule or an unsure. Do not assume you are exempt. Read the OAIC guidance linked below for that rule, or ask a privacy lawyer.",
  },
  exempt: {
    tag: "Likely exempt for now",
    head: "You look like a small business operator under the exemption",
    body: "On these answers you fall under the AU$3 million small business exemption. That is a position at a point in time. Turnover moves, the Government has agreed in principle to review the exemption, and customers and larger clients often expect a privacy policy anyway.",
  },
} as const;

export default function Checker() {
  const [answers, setAnswers] = useState<Partial<Record<QuestionId, Answer>>>({});
  const [step, setStep] = useState(0);
  const done = step >= QUESTIONS.length;
  const q = QUESTIONS[step];

  const pick = (a: Answer) => {
    setAnswers((prev) => ({ ...prev, [q.id]: a }));
    setStep(step + 1);
  };
  const result = done ? assess(answers) : null;
  const v = result ? VERDICT[result.verdict] : null;

  return (
    <section className="pt-card pt-checker" aria-labelledby="pt-checker-h">
      <p className="pt-kicker" id="pt-checker-h">Free checker, seven questions, nothing is stored or sent</p>
      {!done && q ? (
        <div>
          <div className="pt-progress" role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1} aria-label="Question progress">
            <span style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }} />
          </div>
          <p className="pt-step">Question {step + 1} of {QUESTIONS.length}</p>
          <fieldset className="pt-fieldset">
            <legend className="pt-q">{q.text}</legend>
            <p className="pt-help">{q.help}</p>
            <div className="pt-answers" role="group" aria-label="Your answer">
              <button type="button" className="pt-btn" onClick={() => pick("yes")}>Yes</button>
              <button type="button" className="pt-btn" onClick={() => pick("no")}>No</button>
              <button type="button" className="pt-btn pt-btn--ghost" onClick={() => pick("unsure")}>Not sure</button>
            </div>
          </fieldset>
          {step > 0 && <button type="button" className="pt-link" onClick={() => setStep(step - 1)}>Back one question</button>}
        </div>
      ) : result && v ? (
        <div aria-live="polite">
          <span className={`pt-tag pt-tag--${result.verdict}`}>{v.tag}</span>
          <h2 className="pt-result-h">{v.head}</h2>
          <p>{v.body}</p>
          {result.reasons.length > 0 && (
            <>
              <p className="pt-small-h">What drove this result</p>
              <ul className="pt-list">{result.reasons.map((r) => <li key={r}>{LABEL[r]}</li>)}</ul>
            </>
          )}
          <p className="pt-small-h">What to do next</p>
          <ul className="pt-list">
            {result.verdict !== "exempt" ? (
              <>
                <li>Write or update your privacy policy and collection notices. The <Link href="/products/privacy-policy-template-pack">Privacy Policy Template Pack</Link> is a plain-English starting point.</li>
                <li>From 10 December 2026, if software makes or helps make decisions that significantly affect people, your policy has to say so. The <Link href="/products/privacy-adm-wording-guide">automated decision wording guide</Link> covers it.</li>
              </>
            ) : (
              <>
                <li>Keep your records of turnover each year, so you know the day you cross AU$3 million.</li>
                <li>Consider a short privacy policy anyway. The <Link href="/products/privacy-policy-template-pack">template pack</Link> is built for businesses your size.</li>
              </>
            )}
            <li>See everything privacy on the <Link href="/shop">TITANOS shop</Link>, or the full Privacy Act and Essential Eight service on <Link href="/compliance">the compliance page</Link>.</li>
          </ul>
          <div className="pt-answers">
            <Link className="pt-btn pt-btn--gold" href="/shop">Privacy templates in the shop</Link>
            <Link className="pt-btn" href="/compliance">Privacy Act compliance</Link>
            <button type="button" className="pt-btn pt-btn--ghost" onClick={() => { setAnswers({}); setStep(0); }}>Start again</button>
          </div>
          <p className="pt-disclaimer">General information, not legal advice. The checker applies a simplified reading of the Act to your answers and cannot cover every case. For a firm answer, ask the OAIC or a privacy lawyer.</p>
        </div>
      ) : null}
    </section>
  );
}
