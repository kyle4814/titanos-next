"use client";

/**
 * FaqItem — animated <details> wrapper.
 * Open/close via height animation with framer-motion AnimatePresence.
 * Falls back gracefully without JS via standard <details> if hydration delays.
 */

import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";

export default function FaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "var(--card)",
        border: `1px solid ${open ? "var(--gold-dim)" : "var(--border)"}`,
        borderRadius: 5,
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
          fontSize: "0.98rem",
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
          transition={{ duration: 0.2 }}
          style={{
            fontFamily: "'Cinzel', serif",
            color: "var(--gold)",
            fontSize: "1.3rem",
            marginLeft: 14,
            flexShrink: 0,
            display: "inline-block",
          }}
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                padding: "0 22px 22px",
                color: "var(--text)",
                fontSize: "0.92rem",
                lineHeight: 1.75,
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
