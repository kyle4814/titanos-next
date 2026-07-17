"use client";

// Interactive ADM-scope decision tree for /compliance. Replaces "read the
// FAQ and self-match" with three honest yes/no questions that resolve to
// exactly the legal scope described elsewhere on the page — never implies
// broader mandatory compliance than actually exists. No data is collected
// or submitted; this is client-side only.

import { useState } from "react";

type Answer = "yes" | "no" | null;

export default function ScopeChecker() {
  const [health, setHealth] = useState<Answer>(null);
  const [turnover, setTurnover] = useState<Answer>(null);

  const resolved = health !== null && (health === "yes" || turnover !== null);

  const inScope = health === "yes" || turnover === "yes";

  const reset = () => {
    setHealth(null);
    setTurnover(null);
  };

  return (
    <div
      style={{
        maxWidth: "var(--maxw-prose)",
        margin: "0 auto",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "26px 24px",
      }}
    >
      {!resolved ? (
        <div style={{ display: "grid", gap: 18 }}>
          {health === null && (
            <Question
              q="Is your business a health service provider (clinic, allied health, pharmacy, any size)?"
              onAnswer={setHealth}
            />
          )}
          {health === "no" && turnover === null && (
            <Question
              q="Is your annual turnover over AU$3M?"
              onAnswer={setTurnover}
            />
          )}
        </div>
      ) : (
        <div>
          {inScope ? (
            <>
              <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: "var(--fs-lg)", marginBottom: 10 }}>
                You&apos;re in ADM scope.
              </p>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
                {health === "yes"
                  ? "Health providers are covered by the Privacy Act at any size — there's no small-business exemption for health."
                  : "Businesses over AU$3M turnover are APP entities, covered by the automated-decision-making disclosure rule taking effect 10 December 2026."}
              </p>
            </>
          ) : (
            <>
              <p style={{ color: "var(--gold)", fontWeight: 700, fontSize: "var(--fs-lg)", marginBottom: 10 }}>
                The ADM rule doesn&apos;t apply to you yet.
              </p>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, marginBottom: 10 }}>
                Under AU$3M turnover and non-health, you&apos;re currently outside the automated-decision-making
                disclosure rule. That exemption is widely expected to narrow in a later reform tranche.
              </p>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
                One thing still applies regardless of size:{" "}
                <strong style={{ color: "var(--ice)" }}>
                  since 10 June 2025, any individual can sue any business directly for a serious privacy breach
                </strong>{" "}
                — that statutory tort isn&apos;t size-gated.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              background: "transparent",
              border: "none",
              color: "var(--dim)",
              fontSize: "var(--fs-xs)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Check again
          </button>
        </div>
      )}
    </div>
  );
}

function Question({ q, onAnswer }: { q: string; onAnswer: (a: Answer) => void }) {
  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", fontWeight: 500, marginBottom: 14 }}>{q}</p>
      <div style={{ display: "inline-flex", gap: 10 }}>
        <button
          type="button"
          onClick={() => onAnswer("yes")}
          style={{
            padding: "10px 24px",
            background: "var(--gold)",
            color: "var(--vault-black, #0a0a0a)",
            border: "none",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: "var(--fs-sm)",
            cursor: "pointer",
          }}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onAnswer("no")}
          style={{
            padding: "10px 24px",
            background: "transparent",
            color: "var(--ice)",
            border: "1px solid var(--border-strong, var(--gold-dim))",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: "var(--fs-sm)",
            cursor: "pointer",
          }}
        >
          No
        </button>
      </div>
    </div>
  );
}
