"use client";

// Rotating one-line credibility strip. Cycles ONLY through numbers already
// verified elsewhere on the site (STATS) plus static true facts — never
// invents a new stat. Under reduced motion, renders the first line static.

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { STATS } from "@/lib/stats";

const LINES = [
  `${STATS.scansThisMonth}+ automated scans run this month`,
  `${STATS.uniqueBusinesses}+ AU/NZ/SG businesses in the scan corpus`,
  "ABN 34 318 502 254 — Australian-owned, verifiable",
  "Every finding verifiable — see the real evidence pack",
  "Privacy-compliant by design on every system built",
];

export default function StatsTicker() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setI((prev) => (prev + 1) % LINES.length);
        setVisible(true);
      }, 250);
    }, 3800);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <p
      aria-live="polite"
      style={{
        textAlign: "center",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: "var(--fs-xs)",
        letterSpacing: "0.05em",
        color: "var(--dim)",
        margin: "0 0 20px",
        minHeight: "1.4em",
        opacity: reduce ? 1 : visible ? 1 : 0,
        transition: reduce ? undefined : "opacity 0.25s ease",
      }}
    >
      {LINES[i]}
    </p>
  );
}
