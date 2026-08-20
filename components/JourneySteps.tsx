// The visitor's path through the business, in order — audit call first,
// a working system in month 1, then the retainer that keeps compounding.
// This is a real sequence (not a decorative device), so numbering it is correct.
//
// Rendered as ordered descent: each stage is a threshold, marked in the
// machine's register (STAGE 01 / 04), joined by a hairline rule rather
// than a "how it works" chevron.

import { SystemLabel } from "@/components/Myth";

const STEPS = [
  { num: "1", title: "Audit call", body: "Free, no obligation. We work out what's worth automating." },
  { num: "2", title: "First system, live", body: "Built inside month 1 of the retainer. Not a separate build fee." },
  { num: "3", title: "Partnership", body: "Months 2-3: optimised against how you actually use it." },
  { num: "4", title: "Compounding growth", body: "Month-to-month after that. The systems keep improving." },
] as const;

export default function JourneySteps() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 0,
        maxWidth: "var(--maxw-wide)",
        margin: "0 auto",
      }}
    >
      {STEPS.map((s, i) => (
        <div
          key={s.num}
          style={{
            position: "relative",
            padding: "22px 24px",
            borderTop: "1px solid var(--border)",
            borderRight: i < STEPS.length - 1 ? "1px solid var(--border)" : "none",
          }}
          className="journey-step"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 34,
                height: 30,
                padding: "0 6px",
                border: "1px solid var(--gold-dim)",
                background: "rgb(var(--gold-rgb) / 0.06)",
                color: "var(--gold)",
                fontFamily: "var(--font-display), Georgia, serif",
                fontWeight: 700,
                fontSize: "var(--fs-sm)",
                letterSpacing: "0.02em",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <SystemLabel>{`STAGE ${String(i + 1).padStart(2, "0")} / ${String(STEPS.length).padStart(2, "0")}`}</SystemLabel>
          </div>
          <h3
            style={{
              fontFamily: "var(--font-body), system-ui, sans-serif",
              color: "var(--ice)",
              fontSize: "var(--fs-body)",
              fontWeight: 600,
              margin: "0 0 6px",
            }}
          >
            {s.title}
          </h3>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.6, margin: 0 }}>
            {s.body}
          </p>
          {i < STEPS.length - 1 && (
            <span
              aria-hidden="true"
              className="journey-thread"
              style={{
                position: "absolute",
                right: -1,
                top: 22,
                bottom: 22,
                width: 1,
                background:
                  "linear-gradient(180deg, transparent, rgb(var(--gold-rgb) / 0.4) 20%, rgb(var(--gold-rgb) / 0.4) 80%, transparent)",
              }}
            />
          )}
        </div>
      ))}
      <style>{`
        @media (max-width: 720px) {
          .journey-step { border-right: none !important; }
          .journey-thread { display: none; }
        }
      `}</style>
    </div>
  );
}
