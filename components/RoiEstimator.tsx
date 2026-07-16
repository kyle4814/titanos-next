"use client";

// Estimates value from the visitor's own numbers — never from claimed past
// results, since there are no past clients to claim results from yet.
// React state only. No localStorage/sessionStorage (unreliable in this
// deploy environment) and nothing is submitted or stored anywhere.

import { useState } from "react";
import { PRICING, formatAUD } from "@/lib/pricing";

const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function RoiEstimator() {
  const [hours, setHours] = useState(10);
  const [rate, setRate] = useState(45);

  const monthlyHours = hours * 4.33;
  const monthlyCost = Math.round(monthlyHours * rate);
  const retainerEntry = PRICING.AI_GROWTH_PARTNER;

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
            Hours/week on repetitive manual work: <strong style={{ color: "var(--gold)" }}>{hours}</strong>
          </span>
          <input
            type="range"
            min={1}
            max={40}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--gold, #c9a25a)" }}
            aria-label="Hours per week on repetitive manual work"
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", color: "var(--ice)", fontSize: "var(--fs-sm)", fontWeight: 500, marginBottom: 8 }}>
            Rough hourly cost of that person: <strong style={{ color: "var(--gold)" }}>AU${rate}/hr</strong>
          </span>
          <input
            type="range"
            min={20}
            max={150}
            step={5}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--gold, #c9a25a)" }}
            aria-label="Hourly cost of the person doing that work"
          />
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
          {hours} hrs/week at AU${rate}/hr ≈{" "}
          <strong style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
            AU${GROUPED.format(monthlyCost)}/month
          </strong>{" "}
          going to manual work.
        </p>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", margin: "0 0 14px" }}>
          That&apos;s the kind of work an AI Growth Partnership takes off your plate — from{" "}
          <strong style={{ color: "var(--gold)" }}>{formatAUD(retainerEntry)}/mo</strong>.
        </p>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", margin: 0 }}>
          An estimate to help you think it through — your real numbers will differ.
        </p>
      </div>
    </div>
  );
}
