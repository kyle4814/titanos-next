import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import Link from "next/link";
import SectionReveal from "@/components/SectionReveal";
import ContactButtons from "@/components/ContactButtons";
import { SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { SITE } from "@/lib/config";

const META_TITLE = "Message Kyle: Free AI Audit | Titanos";
const META_DESC = "Message Kyle directly for your free AI audit. Here's what happens next.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  robots: { index: false, follow: false },
};

export const metadata: Metadata = withSeo("/audit/booked", baseMetadata);

const STEPS = [
  { label: "Your message", detail: "Send Kyle a line on Telegram, or call. Tell him what your business does and what eats your week" },
  { label: "Before we talk", detail: "I look at your website and industry and come with 2 or 3 starting ideas for what's worth automating" },
  { label: "The conversation", detail: "Nothing scripted or generic, it adjusts to whatever you actually tell me" },
];

export default function AuditBookedPage() {
  return (
    <SectionReveal
      style={{ padding: "var(--space-30) 20px", position: "relative", zIndex: 2, textAlign: "center" }}
    >
      <OmegaSeal caption="A human will answer." />

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
        Message Kyle directly.
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
        No booking, no forms. Pick whichever is easiest for you and Kyle replies himself.
      </p>

      <div style={{ margin: "0 auto var(--space-10)" }}>
        <ContactButtons />
      </div>

      <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", textAlign: "left" }}>
        <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 16 }}>
          What happens next
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
        business right now. That&apos;s the whole conversation.
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
        Prefer email? Write to{" "}
        <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--gold)" }}>
          {SITE.KYLE_EMAIL}
        </a>{" "}
        instead.
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
