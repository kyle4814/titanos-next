"use client";

// Counts down to the real 10 December 2026 Privacy Act deadline — nothing
// else. Not a scarcity device; the date is legislated, not manufactured.

import { useEffect, useState } from "react";

const DEADLINE = new Date("2026-12-10T00:00:00+11:00").getTime();

function diff(now: number) {
  const ms = Math.max(0, DEADLINE - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

export default function DeadlineCountdown() {
  const [t, setT] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  useEffect(() => {
    setT(diff(Date.now()));
    const id = window.setInterval(() => setT(diff(Date.now())), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!t) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        gap: 18,
        alignItems: "baseline",
        justifyContent: "center",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        color: "var(--gold)",
        flexWrap: "wrap",
      }}
      aria-label={`${t.days} days until the 10 December 2026 Privacy Act deadline`}
    >
      <Unit value={t.days} label="days" />
      <Unit value={t.hours} label="hrs" />
      <Unit value={t.minutes} label="min" />
      <span style={{ color: "var(--dim)", fontSize: "var(--fs-xs)" }}>until 10 Dec 2026</span>
    </div>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span style={{ textAlign: "center" }}>
      <span style={{ fontSize: "1.4rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--dim)", marginLeft: 4 }}>{label}</span>
    </span>
  );
}
