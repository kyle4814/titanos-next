"use client";

import { useMemo, useState } from "react";
import { proof } from "@/lib/site-data/proofLive";
import InView from "./InView";
import "./charts.css";

const LABELS = Object.keys(proof.labels) as (keyof typeof proof.labels)[];
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export default function ProofWall() {
  const [open, setOpen] = useState<string | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const shown = useMemo(() => proof.stars.filter((s) => !only || s.label === only), [only]);
  // constellation: one point per star on a golden-angle spiral, decorative only
  const dots = useMemo(
    () => proof.stars.map((s, i) => {
      const r = Math.sqrt((i + 0.5) / proof.stars.length) * 46;
      return { id: s.id, x: 50 + Math.cos(i * GOLDEN_ANGLE) * r, y: 50 + Math.sin(i * GOLDEN_ANGLE) * r };
    }),
    [],
  );
  return (
    <section id="proof-wall" className="w4-wrap w4-wall" aria-labelledby="w4-wall-h" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <InView>
      <p className="w4-eyebrow">THE PROOF WALL</p>
      <h2 id="w4-wall-h" className="w4-h2">Every number is a star. Open one to see what it is and where it came from.</h2>
      <svg className="w4-const" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <polyline pathLength={1} className="w4-draw" points={dots.map((d) => [d.x.toFixed(1), d.y.toFixed(1)].join(",")).join(" ")} />
        {dots.map((d) => (
          <circle key={d.id} cx={d.x} cy={d.y} r={open === d.id ? 1.1 : 0.45} className={open === d.id ? "on" : ""} />
        ))}
      </svg>
      <div className="w4-legend" role="group" aria-label="Filter by label">
        {LABELS.map((l) => {
          const count = proof.labelCounts[l];
          return (
            <button key={l} type="button" className="w4-chip w4-chip--btn" data-label={l} aria-pressed={only === l} disabled={count === 0} onClick={() => setOnly(only === l ? null : l)}>
              {l} {count}
            </button>
          );
        })}
      </div>
      <p className="w4-note">{only ? proof.labels[only as keyof typeof proof.labels] : "Tap a label to filter. A label with a zero has nothing to show yet, and we leave it that way."}</p>
      <ul className="w4-stars">
        {shown.map((s) => {
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="w4-star" data-phi-reveal data-open={isOpen ? "1" : "0"} data-w4-star={s.id}>
              <button type="button" aria-expanded={isOpen} aria-controls={`w4-s-${s.id}`} onClick={() => setOpen(isOpen ? null : s.id)}>
                <span className="w4-star-dot" aria-hidden="true" />
                <span className="w4-star-num" data-count>{s.display}</span>
                <span className="w4-star-cap">{s.caption}</span>
                <span className="w4-chip" data-label={s.label}>{s.label}</span>
              </button>
              <div id={`w4-s-${s.id}`} className="w4-star-more" hidden={!isOpen}>
                <p><b>{s.label}.</b> {proof.labels[s.label as keyof typeof proof.labels]}</p>
                <p><b>Source.</b> {s.source}</p>
                <p><b>Date.</b> {s.date}</p>
                <p><b>Method.</b> {s.method}</p>
              </div>
            </li>
          );
        })}
      </ul>
      </InView>
      <span data-w4-end="proof-wall" hidden />
    </section>
  );
}
