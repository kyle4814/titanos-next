"use client";

/**
 * FaqItem — CSS-only collapse via grid-template-rows.
 * Answer prose is ALWAYS in the DOM (SSR-visible, SEO-indexable).
 * Open/close animation driven by CSS transition on grid-template-rows + opacity.
 * The `+` icon rotation uses a lightweight inline motion.span (no AnimatePresence).
 */

import { motion, useReducedMotion } from "framer-motion";
import { useState, type ReactNode } from "react";

export default function FaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "var(--card)",
        border: `1px solid ${open ? "var(--gold-dim)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        marginBottom: 12,
        transition: "border-color 0.2s",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          padding: "18px 22px",
          color: "var(--ice)",
          fontWeight: 500,
          fontSize: "var(--fs-body)",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "'Inter', sans-serif",
          letterSpacing: 0,
        }}
      >
        <span>{question}</span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          style={{
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h4)",
            marginLeft: 14,
            flexShrink: 0,
            display: "inline-block",
          }}
        >
          +
        </motion.span>
      </button>

      {/* CSS-only collapse: answer always in DOM for SSR/SEO */}
      <div
        className="faq-collapse"
        data-open={open ? "true" : "false"}
        aria-hidden={!open}
      >
        <div className="faq-collapse-inner">
          <div
            style={{
              padding: "0 22px 22px",
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.75,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
