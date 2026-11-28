"use client";

/**
 * ProcessSteps — five numbered process cards. Stagger reveal (100ms apart)
 * + each number badge pulses on entry.
 *
 * MOT-01: under prefers-reduced-motion, cards render settled, no reveal,
 *   no badge pulse.
 */

import { m as motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

export type ProcStep = {
  num: string;
  title: string;
  body: string;
};

export default function ProcessSteps({ steps }: { steps: ProcStep[] }) {
  return (
    <div className="pe-grid g17-steps">
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
      className="pe-card pe-card--pad g17-card"
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
        className="g17-num"
        style={{ display: "inline-block", transformOrigin: "left center" }}
      >
        {step.num}
      </motion.div>
      <h3 className="g17-h3">
        {step.title}
      </h3>
      <p className="g17-body">
        {step.body}
      </p>
    </motion.article>
  );
}
