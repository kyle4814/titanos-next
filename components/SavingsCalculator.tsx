"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

// Every input is editable and every line of the maths is shown, so a reader can check it.
// Defaults: AU$54.83 an hour = ABS full-time average weekly ordinary-time earnings (AU$2,083.70, May 2026)
// over 38 hours (Fair Work maximum ordinary week). 46 working weeks = 52 minus 4 weeks' annual leave
// and about 2 weeks of public holidays (an assumption, editable).

const aud = (n: number) =>
  "AU$" + Math.round(n).toLocaleString("en-AU", { maximumFractionDigits: 0 });

const LABEL: CSSProperties = { color: "var(--ice)", fontSize: 14, display: "block", marginBottom: 4 };
const INPUT: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#000",
  color: "var(--ice)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 16,
};
const ROW: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid var(--border)",
  color: "var(--ice)",
  fontSize: 15,
  flexWrap: "wrap",
};

function Num({ label, value, set, step = 1 }: { label: string; value: number; set: (n: number) => void; step?: number }) {
  return (
    <label style={{ display: "block" }}>
      <span style={LABEL}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))}
        style={INPUT}
      />
    </label>
  );
}

export default function SavingsCalculator() {
  const [staff, setStaff] = useState(20);
  const [hours, setHours] = useState(2);
  const [rate, setRate] = useState(54.83);
  const [weeks, setWeeks] = useState(46);
  const [fee, setFee] = useState(1500);
  const [run, setRun] = useState(50);

  const hoursYear = staff * hours * weeks;
  const value = hoursYear * rate;
  const cost = (fee + run) * 12;
  const net = value - cost;
  const multiple = cost > 0 ? value / cost : 0;
  const payback = value > 0 ? cost / (value / 12) : 0;
  const fte = hoursYear / (38 * weeks || 1);

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "18px 18px 8px",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Num label="People on your team" value={staff} set={setStaff} />
        <Num label="Hours given back, per person per week" value={hours} set={setHours} step={0.5} />
        <Num label="Cost of an hour (AU$)" value={rate} set={setRate} step={0.01} />
        <Num label="Working weeks a year" value={weeks} set={setWeeks} />
        <Num label="Our monthly fee (AU$)" value={fee} set={setFee} step={100} />
        <Num label="Running cost a month (AU$)" value={run} set={setRun} step={10} />
      </div>
      <div style={{ marginTop: 16 }}>
        <div style={ROW}>
          <span>Hours given back a year</span>
          <b>
            {staff} × {hours} × {weeks} = {Math.round(hoursYear).toLocaleString("en-AU")} hours
          </b>
        </div>
        <div style={ROW}>
          <span>That is the same as</span>
          <b>{fte.toFixed(1)} full-time people&apos;s worth of hours, with nobody replaced</b>
        </div>
        <div style={ROW}>
          <span>Value of those hours</span>
          <b>
            {Math.round(hoursYear).toLocaleString("en-AU")} × AU${rate} = {aud(value)} a year
          </b>
        </div>
        <div style={ROW}>
          <span>What it costs you</span>
          <b>
            ({aud(fee)} + {aud(run)}) × 12 = {aud(cost)} a year
          </b>
        </div>
        <div style={{ ...ROW, color: "var(--gold)", fontSize: 17 }}>
          <span>Value left over</span>
          <b>{aud(net)} a year</b>
        </div>
        <div style={ROW}>
          <span>Every dollar in returns</span>
          <b>{multiple.toFixed(1)} dollars of time</b>
        </div>
        <div style={{ ...ROW, borderBottom: 0 }}>
          <span>Pays for itself in</span>
          <b>{payback > 0 ? `${payback.toFixed(1)} months` : "n/a"}</b>
        </div>
      </div>
    </div>
  );
}
