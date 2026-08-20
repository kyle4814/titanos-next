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
import { SystemLabel } from "@/components/Myth";

type Props = { variant?: "pill" | "block" };

// RED-TEAM NOTE (see brief).
//
// variant="pill" — retired 2026-06-30 and stays retired here. It showed
// "Booking {CURRENT_BOOKING_MONTH} · {MONTHLY_COMPLIANCE_SLOTS}/month",
// a value only Kyle updates by hand (lib/config.ts). It is currently
// "July" while the real date is past that — a false, checkable claim
// sitting on the page. A number that goes stale the moment nobody
// remembers to bump it is a manufactured-pressure device by
// construction, not a fact. Renders nothing.
//
// variant="block" — the underlying fact (one operator, a real monthly
// capacity ceiling) is true and doesn't need a calendar to stay true,
// so it's kept — but rewritten to drop the same stale "currently
// booking {month}" claim, and to drop the "queue compresses as the
// deadline nears" framing, which reads as urgency even though the
// deadline itself is real (see DeadlineCountdown.tsx). What's left is
// the plain, evergreen fact: a solo operator has a fixed number of
// hours, stated once, quietly.
export default function SlotScarcity({ variant = "pill" }: Props) {
  if (variant === "pill") return null;

  return (
    <div
      data-analytics="slot-scarcity"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "22px 26px",
        margin: "32px auto",
        maxWidth: "var(--maxw-prose)",
      }}
    >
      <SystemLabel tone="gold" style={{ marginBottom: 10 }}>
        Capacity, not a countdown
      </SystemLabel>
      <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: 0 }}>
        I&apos;m one operator. I run{" "}
        <strong style={{ color: "var(--gold)" }}>
          {SITE.MONTHLY_COMPLIANCE_SLOTS} compliance engagements a month
        </strong>{" "}
        — DNS propagation, host escalations, and the 30-day review call each
        take the time they take, and one person can only run so many at
        once. That&apos;s a real constraint, not a sales device.
      </p>
    </div>
  );
}
