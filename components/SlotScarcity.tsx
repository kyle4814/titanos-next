/**
 * SlotScarcity — capacity-based scarcity copy.
 *
 * Replaces the live "X days remaining" countdown framing wherever
 * urgency is needed. Driven by SITE.MONTHLY_COMPLIANCE_SLOTS and
 * SITE.CURRENT_BOOKING_MONTH (lib/config.ts). Values render at build
 * time — no client-side JS, no broken "—remaining" bare state, no
 * fake real-time counter.
 *
 * Two variants:
 *   variant="pill" — small inline pill (homepage Offer 02 sub-line,
 *     /compliance hero badge). Mirrors the DeadlineCounter footprint
 *     so it slots cleanly into both surfaces.
 *   variant="block" — full sentence in card form (under /compliance
 *     hero CTAs). Carries the operator-cap context.
 */

import { SITE } from "@/lib/config";

type Props = { variant?: "pill" | "block" };

export default function SlotScarcity({ variant = "pill" }: Props) {
  // 2026-06-30 — scarcity chip retired. The "Booking July · 4/month" pill
  // read as pressure copy from a stale month. Reassurance beats scarcity
  // for the deadline audience; the deadline itself is the urgency.
  if (variant === "pill") return null;
  return null;
  if (variant === "pill") {
    return (
      <span
        style={{
          display: "inline-block",
          marginLeft: 10,
          padding: "3px 10px",
          background: "rgb(var(--gold-rgb) / 0.08)",
          border: "1px solid var(--gold-dim)",
          color: "var(--gold)",
          fontFamily: "var(--font-display), Georgia, serif",
          fontSize: "var(--fs-sm)",
          letterSpacing: "0.06em",
          borderRadius: "var(--radius-lg)",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
        }}
      >
        Booking {SITE.CURRENT_BOOKING_MONTH} · {SITE.MONTHLY_COMPLIANCE_SLOTS}/month
      </span>
    );
  }

  return (
    <div
      data-analytics="slot-scarcity"
      style={{
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-md)",
        padding: "22px 26px",
        color: "var(--text)",
        fontSize: "var(--fs-body)",
        lineHeight: 1.75,
        margin: "32px auto",
        maxWidth: "var(--maxw-prose)",
      }}
    >
      I&apos;m one operator. I run{" "}
      <strong style={{ color: "var(--gold)" }}>
        {SITE.MONTHLY_COMPLIANCE_SLOTS} compliance engagements per month
      </strong>
      , and that doesn&apos;t scale. Currently booking{" "}
      <strong style={{ color: "var(--gold)" }}>{SITE.CURRENT_BOOKING_MONTH}</strong>
      . The closer 11 December gets, the more compressed the queue — and DNS
      propagation, host escalations, and the 30-day review call don&apos;t
      compress.
    </div>
  );
}
