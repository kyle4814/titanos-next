import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import Link from "next/link";
import SectionReveal from "@/components/SectionReveal";
import ContactButtons from "@/components/ContactButtons";
import { SystemLabel, OperatorNote, OmegaSeal } from "@/components/Myth";
import { SITE } from "@/lib/config";
import "@/components/g4/g4.css";

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
    <div className="g4">
    <SectionReveal className="pe-section g4-center">
      <div className="pe-page--narrow">
        <OmegaSeal caption="A human will answer." />

        <h1 style={{ fontSize: "var(--pe-fs-h1)", fontWeight: 800, marginTop: 28, marginBottom: 12 }}>
          Message Kyle directly.
        </h1>
        <p className="pe-lead pe-muted" style={{ margin: "0 auto var(--pe-sp-6, 32px)" }}>
          Book a call, or pick whichever way is easiest for you. Kyle replies himself.
        </p>

        <div style={{ margin: "0 auto var(--pe-sp-7, 48px)" }}>
          <ContactButtons />
        </div>

        <div className="pe-card pe-card--pad">
          <SystemLabel tone="gold" style={{ textAlign: "center", marginBottom: 8 }}>
            What happens next
          </SystemLabel>
          <ul className="g4-list">
            {STEPS.map((s) => (
              <li key={s.label}>
                <strong>{s.label}</strong>
                <span>{s.detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <OperatorNote style={{ margin: "var(--pe-sp-6, 32px) auto 0", textAlign: "left" }}>
          The one thing to bring: the most repetitive, time-consuming part of running your
          business right now. That&apos;s the whole conversation.
        </OperatorNote>

        <p className="g4-note">
          Prefer email? Write to <a href={`mailto:${SITE.KYLE_EMAIL}`}>{SITE.KYLE_EMAIL}</a> instead.
        </p>

        <p style={{ marginTop: "var(--pe-sp-6, 32px)" }}>
          <Link href="/" aria-label="Return to titanos.tech home" className="pe-btn pe-btn--dark">
            Return to titanos.tech →
          </Link>
        </p>
      </div>
    </SectionReveal>
    </div>
  );
}
