"use client";

/**
 * Myth.tsx — the visual vocabulary of TITANOS.
 *
 * WHY THIS FILE EXISTS
 * Every previous pass at "make the myth visible" changed copy while the
 * design stayed pixel-identical, because each page improvised its own
 * markup from raw tokens. This file is the architecture that fixes that:
 * a small set of primitives, each one carrying a specific piece of the
 * myth, reused across every page so the whole site reads as one
 * civilisation rather than a set of similarly-coloured pages.
 *
 * THE MAPPING — every primitive answers "what part of the myth is this?"
 *
 *   OmegaSeal      THE Ω. A constitutional mark: the system has an edge,
 *                  it has rules, it knows where it ends. ONE per page,
 *                  never repeated, never decorative.
 *
 *   Inscription    THE TEMPLE. A statement set INTO the page — lintel
 *                  rules above and below, stone recess between. Used for
 *                  claims that should read as carved, not printed.
 *
 *   SystemLabel    THE MACHINE. Quiet instrumentation. Monospace, small,
 *                  letterspaced, dim — the register of something being
 *                  observed and reported by infrastructure rather than
 *                  announced by marketing.
 *
 *   MythSection    THE JOURNEY. A section that knows its own depth. The
 *                  index (03 / 09) makes scrolling read as descent
 *                  through layers instead of a flat list of panels.
 *
 *   TempleFrame    ANCIENT KNOWLEDGE × MODERN COMPUTATION. Column ticks
 *                  at the corners, symmetry, a recessed field. Ancient
 *                  proportion holding modern content.
 *
 *   OperatorNote   THE HUMAN. A first-person aside in the operator's own
 *                  voice, marked as such. The hero of the myth is the
 *                  person, so the person gets a distinct typographic
 *                  voice that no other element uses.
 *
 * CONSTRAINTS THESE ALL RESPECT
 * - Existing CSS custom properties only. No new colour values, no hex.
 * - No new dependencies. No web fonts. No canvas/WebGL.
 * - Mobile-first: everything works at 390px with no horizontal overflow.
 * - Motion is opt-in and always yields to prefers-reduced-motion.
 * - Semantic HTML: real headings, real landmarks, decorative marks
 *   carry aria-hidden.
 */

import { type ReactNode, type CSSProperties } from "react";

/* ─────────────────────────────────────────────────────────────
   THE Ω — the seal. One per page.
   ───────────────────────────────────────────────────────────── */
export function OmegaSeal({
  size = 54,
  withStem = true,
  caption,
  style,
}: {
  size?: number;
  /** The rule descending from the seal — reads as the mark being set into what follows. */
  withStem?: boolean;
  /** Optional line beneath, in the machine's voice. */
  caption?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          border: "1px solid rgb(var(--gold-rgb) / 0.45)",
          color: "var(--gold)",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: size * 0.42,
          lineHeight: 1,
          background: "rgb(var(--gold-rgb) / 0.04)",
        }}
      >
        Ω
      </span>
      {withStem && (
        <span
          aria-hidden="true"
          style={{
            width: 1,
            height: 32,
            background: "linear-gradient(180deg, rgb(var(--gold-rgb) / 0.5), transparent)",
          }}
        />
      )}
      {caption && (
        <span
          className="label-system"
          style={{ color: "var(--gold-dim)", textAlign: "center", maxWidth: "28ch" }}
        >
          {caption}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   THE TEMPLE — an inscription. Carved, not printed.
   ───────────────────────────────────────────────────────────── */
export function Inscription({
  label,
  children,
  sub,
  align = "center",
  style,
}: {
  /** Machine-voice line above the statement. */
  label?: string;
  /** The statement itself — keep it short. This is a lintel, not a paragraph. */
  children: ReactNode;
  /** Optional quieter line beneath. */
  sub?: ReactNode;
  align?: "center" | "left";
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        maxWidth: "var(--maxw-content)",
        margin: "0 auto",
        borderTop: "1px solid rgb(var(--gold-rgb) / 0.30)",
        borderBottom: "1px solid rgb(var(--gold-rgb) / 0.30)",
        background: "linear-gradient(180deg, rgb(var(--gold-rgb) / 0.05), transparent 60%)",
        padding: "var(--space-8) var(--space-6)",
        textAlign: align,
        ...style,
      }}
    >
      {label && (
        <div className="label-system" style={{ color: "var(--gold)", marginBottom: 16 }}>
          {label}
        </div>
      )}
      <p
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontWeight: 400,
          color: "var(--ice)",
          fontSize: "var(--fs-h3)",
          margin: align === "center" ? "0 auto" : 0,
          lineHeight: 1.45,
          maxWidth: "26ch",
        }}
      >
        {children}
      </p>
      {sub && (
        <p
          style={{
            color: "var(--dim)",
            fontSize: "var(--fs-sm)",
            lineHeight: 1.7,
            maxWidth: "var(--maxw-prose)",
            margin: align === "center" ? "20px auto 0" : "20px 0 0",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   THE MACHINE — instrumentation label.
   ───────────────────────────────────────────────────────────── */
export function SystemLabel({
  children,
  tone = "dim",
  style,
}: {
  children: ReactNode;
  tone?: "dim" | "gold" | "ice";
  style?: CSSProperties;
}) {
  const color = tone === "gold" ? "var(--gold)" : tone === "ice" ? "var(--ice)" : "var(--dim)";
  return (
    <div className="label-system" style={{ color, ...style }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   THE JOURNEY — a section that knows its own depth.
   ───────────────────────────────────────────────────────────── */
export function DepthIndex({
  index,
  total,
  style,
}: {
  index: number;
  total: number;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className="label-system"
      style={{ color: "var(--gold-dim)", marginBottom: 10, ...style }}
    >
      {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ANCIENT × COMPUTATION — column ticks holding a recessed field.
   Corner marks read as the top of columns; the field between them
   is where modern content sits.
   ───────────────────────────────────────────────────────────── */
export function TempleFrame({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  const tick: CSSProperties = {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: "rgb(var(--gold-rgb) / 0.42)",
    borderStyle: "solid",
  };
  return (
    <div
      style={{
        position: "relative",
        padding: "var(--space-8) var(--space-6)",
        background: "linear-gradient(180deg, rgb(255 255 255 / 0.012), transparent)",
        border: "1px solid var(--border)",
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ ...tick, top: -1, left: -1, borderWidth: "1px 0 0 1px" }} />
      <span aria-hidden="true" style={{ ...tick, top: -1, right: -1, borderWidth: "1px 1px 0 0" }} />
      <span aria-hidden="true" style={{ ...tick, bottom: -1, left: -1, borderWidth: "0 0 1px 1px" }} />
      <span aria-hidden="true" style={{ ...tick, bottom: -1, right: -1, borderWidth: "0 1px 1px 0" }} />
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   THE HUMAN — the operator's own voice, typographically distinct
   from every other element on the site.
   ───────────────────────────────────────────────────────────── */
export function OperatorNote({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <aside
      style={{
        borderLeft: "2px solid var(--gold)",
        paddingLeft: "var(--space-6)",
        margin: "var(--space-8) 0",
        maxWidth: "var(--maxw-prose)",
        ...style,
      }}
    >
      <div className="label-system" style={{ color: "var(--gold-dim)", marginBottom: 8 }}>
        Operator&apos;s note
      </div>
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          color: "var(--text)",
          fontSize: "var(--fs-lg)",
          lineHeight: 1.6,
        }}
      >
        {children}
      </div>
    </aside>
  );
}
