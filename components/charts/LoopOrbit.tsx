"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { proof } from "@/lib/site-data/proofLive";
import "./charts.css";

const GoldenSpiralField = dynamic(() => import("@/components/hero/GoldenSpiralField"), { ssr: false });
const STARS = new Map(proof.stars.map((s) => [s.id, s]));

export default function LoopOrbit() {
  const [open, setOpen] = useState(0);
  const n = proof.loop.length;
  const node = proof.loop[open];
  const rc = STARS.get(node.receipt)!;
  return (
    <section id="loop" className="w4-wrap w4-loop" aria-labelledby="w4-loop-h" style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <div className="w4-spiral-bg" aria-hidden="true"><GoldenSpiralField /></div>
      <p className="w4-eyebrow">THE LEARNING LOOP</p>
      <h2 id="w4-loop-h" className="w4-h2">Every turn of the loop leaves a receipt.</h2>
      <div className="w4-loop-grid">
        <div className="w4-orbit" role="group" aria-label="The learning loop, select a step to open its receipt">
          <div className="w4-orbit-ring" aria-hidden="true" />
          <div className="w4-orbit-spin" aria-hidden="true"><i /></div>
          <div className="w4-orbit-core" aria-hidden="true">LOOP</div>
          {proof.loop.map((s, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const left = 50 + Math.cos(a) * 38;
            const top = 50 + Math.sin(a) * 38;
            return (
              <button
                key={s.name}
                type="button"
                className="w4-node"
                aria-pressed={i === open}
                aria-controls="w4-loop-panel"
                style={{ left: `${left}%`, top: `${top}%` }}
                onClick={() => setOpen(i)}
              >
                <b>{s.n}</b>
                <span>{s.name}</span>
              </button>
            );
          })}
        </div>
        <div id="w4-loop-panel" className="w4-panel" aria-live="polite">
          <h3>{node.name}</h3>
          <p>{node.text}</p>
          <div className="w4-receipt" data-w4-star={rc.id}>
            <p className="w4-eyebrow">RECEIPT</p>
            <p className="w4-receipt-num">{rc.display}</p>
            <p>{rc.caption}</p>
            <p className="w4-meta">
              <span className="w4-chip" data-label={rc.label}>{rc.label}</span> {rc.date} · {rc.source}
            </p>
          </div>
        </div>
      </div>
      <ol className="w4-sr-only">
        {proof.loop.map((s) => (
          <li key={s.name}>{s.name}: {s.text} Receipt: {STARS.get(s.receipt)!.display}, {STARS.get(s.receipt)!.label}.</li>
        ))}
      </ol>
      <span data-w4-end="loop" hidden />
    </section>
  );
}
