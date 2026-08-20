import type { Metadata } from "next";
import Link from "next/link";
import SectionReveal from "@/components/SectionReveal";
import { SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";

const META_TITLE = "You're Booked — Free AI Audit Call | Titanos";
const META_DESC = "Your free AI audit call is booked. Here's exactly what happens before we talk.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  robots: { index: false, follow: false },
};

const STEPS = [
  { label: "Confirmation", detail: "Sent from cal.com — time and video link" },
  { label: "Before the call", detail: "I look at your website and industry, if you gave one, and come with 2-3 starting ideas for what's worth automating" },
  { label: "On the call", detail: "Nothing scripted or generic — it adjusts to whatever you actually tell me" },
];

export default function AuditBookedPage() {
  return (
    <SectionReveal
      style={{ padding: "var(--space-30) 20px", position: "relative", zIndex: 2, textAlign: "center" }}
    >
      <OmegaSeal caption="A commitment recorded. A human will show up." />

      <h1
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          fontWeight: 400,
          color: "var(--ice)",
          fontSize: "var(--fs-h3)",
          marginTop: 28,
          marginBottom: 12,
        }}
      >
        You&apos;re in the calendar.
      </h1>
      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-body)",
          maxWidth: "var(--maxw-prose)",
          margin: "0 auto var(--space-8)",
          lineHeight: 1.7,
        }}
      >
        A confirmation email is on its way from cal.com with the time and the video link.
      </p>

      <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", textAlign: "left" }}>
        <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 16 }}>
          Before we talk, I will have
        </SystemLabel>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {STEPS.map((s) => (
            <li key={s.label} style={{ padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <span className="label-system" style={{ color: "var(--gold-dim)", display: "block", marginBottom: 4 }}>
                {s.label}
              </span>
              <span style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
                {s.detail}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <OperatorNote style={{ margin: "var(--space-8) auto 0", textAlign: "left" }}>
        The one thing to bring: the most repetitive, time-consuming part of running your
        business right now. That&apos;s the whole call.
      </OperatorNote>

      <p
        style={{
          color: "var(--dim)",
          fontSize: "var(--fs-sm)",
          marginTop: "var(--space-8)",
          maxWidth: "var(--maxw-prose)",
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.7,
        }}
      >
        Need to reschedule or cancel? Use the links in your confirmation email — or just email{" "}
        <a href="mailto:kyle@titanos.tech" style={{ color: "var(--gold)" }}>
          kyle@titanos.tech
        </a>{" "}
        directly.
      </p>

      <p style={{ marginTop: "var(--space-10)" }}>
        <Link
          href="/"
          aria-label="Return to titanos.tech home"
          style={{
            color: "var(--gold)",
            fontFamily: "var(--font-display), Georgia, serif",
            letterSpacing: "0.08em",
            fontSize: "var(--fs-sm)",
            padding: "14px 28px",
            border: "1px solid var(--gold)",
            borderRadius: "var(--radius-sm)",
            textDecoration: "none",
            textTransform: "uppercase",
            display: "inline-block",
          }}
        >
          Return to titanos.tech →
        </Link>
      </p>
    </SectionReveal>
  );
}
