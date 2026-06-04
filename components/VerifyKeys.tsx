"use client";

/**
 * VerifyKeys — the three-key vault interlock.
 *
 * Three verification "keys" slide up from below in sequence (200ms stagger).
 * Each card gets a brief gold flash overlay as it lands. After the third
 * card settles, a "VERIFIED" stamp draws in gold (SVG pathLength animation,
 * 600ms ease-out, opacity 0.85).
 */

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

export type VerifyKey = {
  num: string;
  title: ReactNode;
  body: ReactNode;
};

export default function VerifyKeys({ keys }: { keys: VerifyKey[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const finalDelay = (keys.length - 1) * 0.2 + 0.5;

  return (
    <div ref={ref} style={{ position: "relative", maxWidth: 1020, margin: "0 auto" }}>
      <style>{`
        @media (min-width: 760px) {
          .verify-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
      <div
        className="verify-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 18,
        }}
      >
        {keys.map((k, i) => (
          <motion.article
            key={k.num}
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.5,
              ease: [0, 0, 0.2, 1],
              delay: i * 0.2,
            }}
            style={{
              background: "var(--card)",
              border: "1px solid var(--gold-dim)",
              borderRadius: 6,
              padding: "28px 24px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Gold flash on land */}
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={inView ? { opacity: [0, 0.7, 0] } : {}}
              transition={{
                duration: 0.6,
                ease: "easeOut",
                delay: i * 0.2 + 0.45,
              }}
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 50% 40%, rgba(245,213,117,0.45) 0%, transparent 60%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                color: "var(--gold)",
                fontSize: "1.8rem",
                letterSpacing: "0.05em",
                marginBottom: 8,
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              {k.num}
            </div>
            <h4
              style={{
                fontFamily: "'Cinzel', serif",
                color: "var(--ice)",
                fontSize: "0.95rem",
                letterSpacing: "0.06em",
                marginBottom: 10,
                lineHeight: 1.4,
              }}
            >
              {k.title}
            </h4>
            <div
              style={{
                color: "var(--text)",
                fontSize: "0.9rem",
                lineHeight: 1.65,
              }}
            >
              {k.body}
            </div>
          </motion.article>
        ))}
      </div>

      {/* VERIFIED stamp draws after the third key lands */}
      <div
        aria-hidden="true"
        style={{
          textAlign: "center",
          marginTop: 36,
          position: "relative",
        }}
      >
        <motion.svg
          width="240"
          height="100"
          viewBox="0 0 240 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 0.85 } : {}}
          transition={{ duration: 0.2, delay: finalDelay }}
          style={{ display: "inline-block" }}
        >
          {/* Outer ring */}
          <motion.path
            d="M 20 50 a 100 100 0 1 1 200 0 a 100 100 0 1 1 -200 0"
            stroke="var(--gold)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: 0.6, ease: "easeOut", delay: finalDelay }}
          />
          {/* VERIFIED text drawn as path */}
          <motion.text
            x="120"
            y="58"
            textAnchor="middle"
            fontFamily="'Cinzel', serif"
            fontWeight="700"
            fontSize="22"
            letterSpacing="3"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="1"
            initial={{ pathLength: 0, fillOpacity: 0 }}
            animate={inView ? { pathLength: 1, fillOpacity: 0.9 } : {}}
            transition={{
              duration: 0.6,
              ease: "easeOut",
              delay: finalDelay + 0.15,
            }}
            style={{ fill: "var(--gold)" }}
          >
            VERIFIED
          </motion.text>
        </motion.svg>
      </div>
    </div>
  );
}
