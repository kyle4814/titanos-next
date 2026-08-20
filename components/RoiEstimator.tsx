"use client";

// Estimates value from the visitor's own numbers — never from claimed past
// results, since there are no past clients to claim results from yet.
// React state only. No localStorage/sessionStorage (unreliable in this
// deploy environment) and nothing is submitted or stored anywhere.
//
// 2026-08-10: range extended from solo-operator scale (max 40hrs/wk,
// $150/hr, ~AU$26k/mo ceiling) to team/enterprise scale (max 400hrs/wk,
// $500/hr) — the old ceiling couldn't produce a number anywhere near what
// justifies the AU$50k-150k enterprise tier, so a real enterprise buyer
// dragging both sliders to max still saw a small-business-shaped answer.
// Recommendation now also picks the matching tier instead of always
// pointing at the cheapest retainer.
//
// 2026-08-20: restyled as an instrument the visitor operates, not a
// persuasion widget. Inputs are labelled INPUT, the result is labelled
// COMPUTED — the distinction between "what you told it" and "what it
// worked out" stays visible at all times. No calculation changed.

import { useMemo, useState, type CSSProperties } from "react";
import { DISPLAY } from "@/lib/pricing";
import { SystemLabel } from "@/components/Myth";

const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function recommend(monthlyCost: number) {
  if (monthlyCost >= 40000) {
    return { label: "Enterprise AI Governance Program", price: DISPLAY.ENTERPRISE_FROM };
  }
  if (monthlyCost >= 12000) {
    return { label: "Embedded AI Partner", price: DISPLAY.AI_EMBEDDED_PARTNER };
  }
  if (monthlyCost >= 5000) {
    return { label: "AI Ops Partner", price: DISPLAY.AI_OPS_PARTNER };
  }
  return { label: "AI Growth Partner", price: DISPLAY.AI_GROWTH_PARTNER };
}

const readoutFigure: CSSProperties = {
  fontFamily: "var(--font-mono), ui-monospace, monospace",
  fontVariantNumeric: "tabular-nums",
  color: "var(--gold)",
};

export default function RoiEstimator() {
  const [hours, setHours] = useState(10);
  const [rate, setRate] = useState(45);

  const monthlyHours = hours * 4.33;
  const monthlyCost = Math.round(monthlyHours * rate);
  const tier = useMemo(() => recommend(monthlyCost), [monthlyCost]);
  const isTeamScale = hours > 40 || rate > 150;

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
      <SystemLabel style={{ marginBottom: 18 }}>Input — set your own numbers</SystemLabel>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, color: "var(--ice)", fontSize: "var(--fs-sm)", fontWeight: 500, marginBottom: 10 }}>
            <span>Hours/week your team spends on repetitive manual work</span>
            <strong style={{ ...readoutFigure, fontSize: "var(--fs-lg)", whiteSpace: "nowrap" }}>{GROUPED.format(hours)}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={400}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            style={{ width: "100%", height: 32, accentColor: "var(--gold, #c9a25a)" }}
            aria-label="Hours per week the team spends on repetitive manual work"
          />
          <span className="label-system" style={{ display: "block", marginTop: 4 }}>
            1 (one person, part-time) — 400 (a full department)
          </span>
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, color: "var(--ice)", fontSize: "var(--fs-sm)", fontWeight: 500, marginBottom: 10 }}>
            <span>Rough hourly cost of that work</span>
            <strong style={{ ...readoutFigure, fontSize: "var(--fs-lg)", whiteSpace: "nowrap" }}>AU${GROUPED.format(rate)}/hr</strong>
          </span>
          <input
            type="range"
            min={20}
            max={500}
            step={5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={{ width: "100%", height: 32, accentColor: "var(--gold, #c9a25a)" }}
            aria-label="Hourly cost of the work"
          />
          <span className="label-system" style={{ display: "block", marginTop: 4 }}>
            AU$20 (junior/admin) — AU$500 (specialist, exec, or blended enterprise rate)
          </span>
        </label>
      </div>

      <div className="divider-hairline" style={{ margin: "24px 0" }} />

      <div style={{ textAlign: "center" }}>
        <SystemLabel style={{ marginBottom: 10 }}>Computed — from the numbers above</SystemLabel>
        <div
          style={{
            ...readoutFigure,
            fontSize: "clamp(1.5rem, 4.5vw + 0.9rem, 2.4rem)",
            fontWeight: 600,
            lineHeight: 1.15,
            wordBreak: "keep-all",
          }}
        >
          AU${GROUPED.format(monthlyCost)}
        </div>
        <div className="label-system" style={{ marginTop: 6 }}>
          per month{isTeamScale ? " · team-wide" : ""}
        </div>

        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", margin: "14px 0 18px" }}>
          {GROUPED.format(hours)} hrs/week × AU${GROUPED.format(rate)}/hr × 4.33 weeks
        </p>

        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", margin: 0 }}>
          At that scale, the closer fit is a <strong style={{ color: "var(--gold)" }}>{tier.label}</strong> —{" "}
          <strong style={{ ...readoutFigure, fontWeight: 600 }}>
            {tier.price.startsWith("From") ? tier.price : `from ${tier.price}`}
          </strong>
          .
        </p>
      </div>

      <div className="divider-hairline" style={{ margin: "20px 0 14px" }} />

      <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
        This is your own arithmetic, not a claim about past results — there are no past clients
        to draw one from yet. Move the sliders; the number moves with them, nothing else.
      </p>
    </div>
  );
}
