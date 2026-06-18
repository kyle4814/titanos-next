"use client";

/**
 * ProcessSteps — five numbered process cards. Stagger reveal (100ms apart)
 * + each number badge pulses on entry.
 *
 * MOT-01: under prefers-reduced-motion, cards render settled, no reveal,
 *   no badge pulse.
 */

import { motion, useInView, useReducedMotion } from "framer-motion";
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
        maxWidth: "var(--maxw-wide)",
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
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const delay = index * 0.1;
  const active = !reduce && inView;
  return (
    <motion.article
      ref={ref}
      initial={reduce ? false : { opacity: 0, y: 30 }}
      animate={reduce || inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: reduce ? 0 : 0.55, ease: [0, 0, 0.2, 1], delay: reduce ? 0 : delay }}
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "28px 22px",
        position: "relative",
      }}
    >
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { scale: 1 }}
        animate={active ? { scale: [1, 1.08, 1] } : {}}
        transition={{
          duration: reduce ? 0 : 0.4,
          ease: [0.4, 0, 0.2, 1],
          delay: reduce ? 0 : delay + 0.2,
        }}
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h3)",
          letterSpacing: "0.05em",
          marginBottom: 8,
          lineHeight: 1,
          display: "inline-block",
          transformOrigin: "left center",
        }}
      >
        {step.num}
      </motion.div>
      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-sm)",
          letterSpacing: "0.08em",
          marginBottom: 10,
          lineHeight: 1.4,
        }}
      >
        {step.title}
      </h3>
      <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.65 }}>
        {step.body}
      </p>
    </motion.article>
  );
}
