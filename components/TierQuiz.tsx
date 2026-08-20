"use client";

// Two-question tier recommender. Doesn't replace the pricing cards —
// it just answers "which one is for me" and scrolls/highlights the
// right card instead of making the visitor cross-reference three cards
// themselves. Recommendation drives a real scroll + pulse on the actual
// card, plus a direct order link as a fallback if scroll ever misses.
//
// Styled as instrumentation, not a marketing quiz: the component reads
// one input and returns one reading. No progress bars, no gamification.

import { useState } from "react";
import { SystemLabel } from "@/components/Myth";

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
          <SystemLabel style={{ textAlign: "center", marginBottom: 10 }}>
            Routing · input required
          </SystemLabel>
          <p
            style={{
              color: "var(--ice)",
              fontSize: "var(--fs-body)",
              fontWeight: 500,
              textAlign: "center",
              marginBottom: 18,
            }}
          >
            What should the system take on first?
          </p>
          <div style={{ display: "grid" }}>
            {SCOPE_OPTIONS.map((o, i) => (
              <button
                key={o.tier}
                type="button"
                onClick={() => goToTier(o.tier)}
                className="tier-quiz-option"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 6px",
                  background: "transparent",
                  border: "none",
                  borderTop: i === 0 ? "1px solid var(--border)" : "none",
                  borderBottom: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: "var(--fs-body)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                }}
              >
                <span>{o.label}</span>
                <span
                  aria-hidden="true"
                  className="label-system"
                  style={{ color: "var(--gold-dim)", flexShrink: 0 }}
                >
                  0{i + 1}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center" }} role="status" aria-live="polite">
          <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 12 }}>
            Reading
          </SystemLabel>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", margin: "0 0 6px" }}>
            Closest fit —
          </p>
          <p
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontStyle: "italic",
              color: "var(--gold)",
              fontSize: "var(--fs-lg)",
              fontWeight: 400,
              margin: "0 0 16px",
            }}
          >
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
              marginTop: 16,
              background: "transparent",
              border: "none",
              color: "var(--dim)",
              fontSize: "var(--fs-xs)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Reset
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
        .tier-quiz-option {
          transition: background-color 0.15s ease, padding-left 0.15s ease;
        }
        .tier-quiz-option:hover,
        .tier-quiz-option:focus-visible {
          background-color: rgb(var(--gold-rgb) / 0.05);
          padding-left: 14px;
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
