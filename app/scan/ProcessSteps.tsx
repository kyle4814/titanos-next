"use client";

/**
 * ProcessSteps — five numbered process cards. Stagger reveal (100ms apart)
 * + each number badge pulses (scale 1 -> 1.08 -> 1, 400ms) on entry.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export type ProcStep = {
  num: string;
  title: string;
  body: string;
};

export default function ProcessSteps({ steps }: { steps: ProcStep[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 18,
        maxWidth: 1020,
        margin: "0 auto",
      }}
    >
      {steps.map((s, i) => (
        <Card key={s.num} step={s} index={i} />
      ))}
    </div>
  );
}

function Card({ step, index }: { step: ProcStep; index: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const delay = index * 0.1;
  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0, 0, 0.2, 1], delay }}
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: 6,
        padding: "28px 22px",
        position: "relative",
      }}
    >
      <motion.div
        aria-hidden="true"
        initial={{ scale: 1 }}
        animate={inView ? { scale: [1, 1.08, 1] } : {}}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1],
          delay: delay + 0.2,
        }}
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "2rem",
          letterSpacing: "0.05em",
          marginBottom: 8,
          lineHeight: 1,
          display: "inline-block",
          transformOrigin: "left center",
        }}
      >
        {step.num}
      </motion.div>
      <h4
        style={{
          fontFamily: "'Cinzel', serif",
          color: "var(--gold)",
          fontSize: "0.88rem",
          letterSpacing: "0.08em",
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {step.title}
      </h4>
      <p style={{ color: "var(--text)", fontSize: "0.86rem", lineHeight: 1.65 }}>
        {step.body}
      </p>
    </motion.article>
  );
}
