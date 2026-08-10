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

import { useMemo, useState } from "react";
import { DISPLAY } from "@/lib/pricing";

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", color: "var(--ice)", fontSize: "var(--fs-sm)", fontWeight: 500, marginBottom: 8 }}>
            Hours/week your team spends on repetitive manual work: <strong style={{ color: "var(--gold)" }}>{GROUPED.format(hours)}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={400}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--gold, #c9a25a)" }}
            aria-label="Hours per week the team spends on repetitive manual work"
          />
          <span style={{ display: "block", color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>
            1 (one person, part-time) to 400 (a full department)
          </span>
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", color: "var(--ice)", fontSize: "var(--fs-sm)", fontWeight: 500, marginBottom: 8 }}>
            Rough hourly cost of that work: <strong style={{ color: "var(--gold)" }}>AU${GROUPED.format(rate)}/hr</strong>
          </span>
          <input
            type="range"
            min={20}
            max={500}
            step={5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--gold, #c9a25a)" }}
            aria-label="Hourly cost of the work"
          />
          <span style={{ display: "block", color: "var(--dim)", fontSize: "var(--fs-xs)", marginTop: 4 }}>
            AU$20 (junior/admin) to AU$500 (specialist, exec, or blended enterprise rate)
          </span>
        </label>
      </div>

      <div
        style={{
          marginTop: 22,
          paddingTop: 20,
          borderTop: "1px solid var(--border)",
          textAlign: "center",
        }}
      >
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", margin: "0 0 6px" }}>
          {GROUPED.format(hours)} hrs/week at AU${GROUPED.format(rate)}/hr ≈{" "}
          <strong style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
            AU${GROUPED.format(monthlyCost)}/month
          </strong>{" "}
          going to manual work{isTeamScale ? ", team-wide" : ""}.
        </p>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", margin: "0 0 14px" }}>
          At that scale, the right fit is a <strong style={{ color: "var(--gold)" }}>{tier.label}</strong> — from{" "}
          <strong style={{ color: "var(--gold)" }}>{tier.price}</strong>.
        </p>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", margin: 0 }}>
          An estimate to help you think it through — your real numbers will differ.
        </p>
      </div>
    </div>
  );
}
