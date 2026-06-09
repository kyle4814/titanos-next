"use client";

/**
 * GoldThread — the signature scroll-driven motion of /compliance.
 *
 * Renders numbered steps stacked vertically, connected by 2px gold-line
 * connectors. Each connector draws via GSAP ScrollTrigger animating
 * stroke-dashoffset as it enters viewport. On complete, the next step's
 * badge pulses briefly.
 *
 * MOT-01: under prefers-reduced-motion the GSAP timeline + ScrollTrigger
 *   are NOT registered. All connector paths render with strokeDashoffset:0
 *   (drawn) immediately. Step badges render settled, no pulse.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "framer-motion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type ThreadStep = {
  num: string;
  title: string;
  body: string;
};

export default function GoldThread({ steps }: { steps: ThreadStep[] }) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // MOT-01 — under reduce, settle every connector to drawn state and
    // skip the GSAP context entirely. No ScrollTriggers, no badge pulses.
    if (reduce) {
      const paths = root.querySelectorAll<SVGPathElement>("[data-thread-line]");
      paths.forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = "0";
      });
      return;
    }

    const ctx = gsap.context(() => {
      const paths = root.querySelectorAll<SVGPathElement>("[data-thread-line]");
      paths.forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len}`;
        p.style.strokeDashoffset = `${len}`;
      });

      paths.forEach((path, idx) => {
        const nextStepBadge = root.querySelector<HTMLElement>(
          `[data-thread-badge="${idx + 1}"]`
        );
        const trigger = root.querySelector<HTMLElement>(
          `[data-thread-step="${idx + 1}"]`
        );
        if (!trigger) return;

        gsap.to(path, {
          strokeDashoffset: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger,
            start: "top 80%",
            once: true,
          },
          onComplete: () => {
            if (nextStepBadge) {
              gsap.fromTo(
                nextStepBadge,
                { scale: 1, filter: "drop-shadow(0 0 0 rgb(var(--gold-rgb) / 0))" },
                {
                  scale: 1.08,
                  filter: "drop-shadow(0 0 12px rgb(245 213 117 / 0.85))",
                  duration: 0.2,
                  yoyo: true,
                  repeat: 1,
                  ease: "power2.inOut",
                }
              );
            }
          },
        });
      });
    }, root);

    return () => ctx.revert();
  }, [steps, reduce]);

  return (
    <div
      ref={rootRef}
      style={{
        maxWidth: "var(--maxw-prose)",
        margin: "0 auto",
        position: "relative",
      }}
    >
      {steps.map((s, i) => (
        <div key={s.num} style={{ position: "relative" }}>
          <ThreadStepCard step={s} index={i} />

          {i < steps.length - 1 && (
            <div
              aria-hidden="true"
              style={{
                position: "relative",
                height: 56,
                width: 2,
                margin: "0 auto",
              }}
            >
              <svg
                width="2"
                height="56"
                viewBox="0 0 2 56"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block", margin: "0 auto" }}
                aria-hidden="true"
              >
                <path d="M1 0 L1 56" stroke="var(--gold-dim)" strokeOpacity="0.25" strokeWidth="2" />
                <path
                  data-thread-line
                  d="M1 0 L1 56"
                  stroke="var(--gold)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ThreadStepCard({ step, index }: { step: ThreadStep; index: number }) {
  return (
    <article
      data-thread-step={index}
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "28px 28px 24px",
        position: "relative",
        display: "flex",
        gap: 22,
        alignItems: "flex-start",
      }}
    >
      <div
        data-thread-badge={index}
        style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "1.5px solid var(--gold)",
          color: "var(--gold)",
          background: "rgb(var(--gold-rgb) / 0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 700,
          fontSize: "var(--fs-lg)",
          letterSpacing: "0.04em",
          willChange: "transform, filter",
        }}
        aria-hidden="true"
      >
        {step.num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-body)",
            letterSpacing: "0.08em",
            marginBottom: 10,
            lineHeight: 1.4,
            textTransform: "uppercase",
          }}
        >
          {step.title}
        </h4>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>
          {step.body}
        </p>
      </div>
    </article>
  );
}
