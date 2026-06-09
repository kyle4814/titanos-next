"use client";

/**
 * DeadlineCounter — live "X days remaining" pill.
 * Computes integer days to 2026-12-11 on mount, re-renders daily.
 */

import { useEffect, useState } from "react";

const TARGET = new Date("2026-12-11T00:00:00+10:00").getTime();

function calc(): number {
  const now = Date.now();
  return Math.max(0, Math.ceil((TARGET - now) / 86400000));
}

export default function DeadlineCounter() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    setDays(calc());
    const id = setInterval(() => setDays(calc()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      style={{
        display: "inline-block",
        marginLeft: 10,
        padding: "3px 10px",
        background: "rgb(var(--gold-rgb) / 0.08)",
        border: "1px solid var(--gold-dim)",
        color: "var(--gold)",
        fontFamily: "var(--font-display), Georgia, serif",
        fontSize: "var(--fs-sm)" /* AES-09: Cinzel ≥0.85rem (was 0.78rem) */,
        letterSpacing: "0.06em",
        borderRadius: "var(--radius-lg)",
        verticalAlign: "middle",
      }}
      aria-live="polite"
    >
      {days === null ? "—" : `${days} days remaining`}
    </span>
  );
}
