"use client";

// Two-question tier recommender. Doesn't replace the pricing cards —
// it just answers "which one is for me" and scrolls/highlights the
// right card instead of making the visitor cross-reference three cards
// themselves. Recommendation drives a real scroll + pulse on the actual
// card, plus a direct order link as a fallback if scroll ever misses.

import { useState } from "react";

type Tier = "growth" | "ops" | "embedded";

const TIER_LABEL: Record<Tier, string> = {
  growth: "AI Growth Partner",
  ops: "AI Ops Partner",
  embedded: "Embedded AI Partner",
};

const SCOPE_OPTIONS: { label: string; tier: Tier }[] = [
  { label: "One specific task, to start", tier: "growth" },
  { label: "Several things across the business", tier: "ops" },
  { label: "A full rebuild of how we operate", tier: "embedded" },
];

export default function TierQuiz() {
  const [scope, setScope] = useState<Tier | null>(null);
  const [pulsing, setPulsing] = useState(false);

  const goToTier = (tier: Tier) => {
    setScope(tier);
    const el = document.getElementById(`tier-${tier}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setPulsing(true);
      window.setTimeout(() => setPulsing(false), 1600);
    }
  };

  return (
    <div
      style={{
        maxWidth: "var(--maxw-content)",
        margin: "0 auto",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "24px 22px",
      }}
    >
      {!scope ? (
        <>
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", fontWeight: 500, textAlign: "center", marginBottom: 16 }}>
            What do you want automated first?
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.tier}
                type="button"
                onClick={() => goToTier(o.tier)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "14px 18px",
                  background: "var(--bg-alt, rgba(255,255,255,0.03))",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", margin: "0 0 6px" }}>
            That sounds like
          </p>
          <p style={{ color: "var(--gold)", fontSize: "var(--fs-lg)", fontWeight: 700, margin: "0 0 14px" }}>
            {TIER_LABEL[scope]}
          </p>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}>
            Scrolled to it below — or{" "}
            <a href={`/order/ai?tier=${scope}`} style={{ color: "var(--gold)" }}>
              go straight to the order form →
            </a>
          </p>
          <button
            type="button"
            onClick={() => setScope(null)}
            style={{
              marginTop: 14,
              background: "transparent",
              border: "none",
              color: "var(--dim)",
              fontSize: "var(--fs-xs)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Start over
          </button>
        </div>
      )}
      <style>{`
        @keyframes tier-quiz-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgb(var(--gold-rgb) / 0); }
          50% { box-shadow: 0 0 0 6px rgb(var(--gold-rgb) / 0.25); }
        }
        .tier-quiz-highlight {
          animation: tier-quiz-pulse 0.8s ease-in-out 2;
        }
      `}</style>
      {pulsing && scope && <HighlightInjector tier={scope} />}
    </div>
  );
}

// Adds/removes the pulse class on the live DOM node — kept outside React's
// render tree for the target card since the card lives in a sibling section.
function HighlightInjector({ tier }: { tier: Tier }) {
  if (typeof document !== "undefined") {
    const el = document.getElementById(`tier-${tier}`);
    if (el && !el.classList.contains("tier-quiz-highlight")) {
      el.classList.add("tier-quiz-highlight");
      window.setTimeout(() => el.classList.remove("tier-quiz-highlight"), 1600);
    }
  }
  return null;
}
