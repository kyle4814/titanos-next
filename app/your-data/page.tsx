import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { AUDIT_BOOK_HREF } from "@/lib/config";

export const metadata: Metadata = {
  title: "What happens to your data — quote audit · TITANOS",
  description:
    "If you send me your old quotes for a free audit: exactly what I receive, where it's stored, how long I keep it, and what I never do with it. Plain English, no legal padding.",
  alternates: { canonical: "https://titanos.tech/your-data" },
  robots: { index: true, follow: true },
};

const headingStyle = {
  fontFamily: "var(--font-display), Georgia, serif",
  color: "var(--gold)",
  fontSize: "var(--fs-h3)",
  letterSpacing: "0.06em",
  marginBottom: 14,
  marginTop: 34,
} as const;

const bodyStyle = {
  color: "var(--text)",
  fontSize: "var(--fs-body)",
  lineHeight: 1.8,
  marginBottom: 14,
} as const;

export default function YourDataPage() {
  return (
    <>
      <PageHero
        badge="THE QUOTE AUDIT"
        title="What happens to your data"
        tagline="If you send me your old quotes so I can tell you what's still worth chasing, you're handing over your customers' details. Here's exactly what I do with them."
        sub="Written in plain English because you should be able to read it in two minutes and decide. No legal padding."
      >
        <AnimatedButton href={AUDIT_BOOK_HREF} variant="primary">
          BOOK 15 MINUTES
        </AnimatedButton>
      </PageHero>

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-16) 20px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <h2 style={{ ...headingStyle, marginTop: 0 }}>WHAT I ACTUALLY NEED</h2>
          <p style={bodyStyle}>
            Less than you&apos;d think. To tell you which old quotes are worth chasing, I need the
            job value, the date, and the status. I do <strong>not</strong> need your customers&apos;
            names, phone numbers, email addresses or street addresses to do the analysis.
          </p>
          <p style={bodyStyle}>
            So the best version of this: strip those columns out before you send it, or just send me
            the export as-is and I&apos;ll delete them on receipt. Your call — most people find it
            easier to send the raw export, and that&apos;s fine.
          </p>

          <h2 style={headingStyle}>WHAT I DO WITH IT</h2>
          <p style={bodyStyle}>
            I load it, count what went quiet, group it by value and age, and work out roughly what&apos;s
            realistically still live. Then I send you a short summary and we talk about whether
            it&apos;s worth doing anything about. That&apos;s the whole job.
          </p>

          <h2 style={headingStyle}>WHAT I NEVER DO</h2>
          <ul style={{ ...bodyStyle, paddingLeft: 22 }}>
            <li style={{ marginBottom: 8 }}>
              I never contact your customers. Not to verify anything, not to test a system, not
              ever. They&apos;re your relationships.
            </li>
            <li style={{ marginBottom: 8 }}>
              I never add them to any list of mine, or anyone else&apos;s.
            </li>
            <li style={{ marginBottom: 8 }}>
              I never sell, share, or pass the file to a third party.
            </li>
            <li style={{ marginBottom: 8 }}>
              I never use it to train anything, or feed it into a public AI tool.
            </li>
          </ul>

          <h2 style={headingStyle}>HOW LONG I KEEP IT</h2>
          <p style={bodyStyle}>
            30 days from when you send it, then it&apos;s deleted — the file and any working copies.
            If you want it gone sooner, email me and it&apos;s done same day, no questions and no
            &quot;are you sure?&quot; sequence.
          </p>

          <h2 style={headingStyle}>WHERE IT LIVES</h2>
          <p style={bodyStyle}>
            On my own machine, in Australia. Not in a shared drive, not in a CRM, not in a tool
            some other company runs. One person has access, and it&apos;s me.
          </p>

          <h2 style={headingStyle}>IF YOU&apos;D RATHER NOT SEND IT AT ALL</h2>
          <p style={bodyStyle}>
            Completely reasonable. Tell me roughly how many quotes you send a month and what your
            average job is worth, and I can give you a rough answer on a call without touching your
            data at all. It&apos;s less precise, but it&apos;s free and it costs you nothing but the
            15 minutes.
          </p>

          <h2 style={headingStyle}>WHY I BOTHER WRITING THIS DOWN</h2>
          <p style={bodyStyle}>
            Privacy compliance is half of what I do for a living. It would be a poor look to ask for
            a few hundred of your customers&apos; details and say nothing about how I handle them —
            and if I&apos;m sloppy with your data at the free stage, you&apos;d be right not to trust
            me with anything after it.
          </p>
          <p style={{ ...bodyStyle, color: "var(--dim)" }}>
            Kyle Deligny · Titanos · ABN 34 318 502 254 · Brisbane QLD ·{" "}
            <a href="mailto:kyle@titanos.tech" style={{ color: "var(--ice)" }}>
              kyle@titanos.tech
            </a>
          </p>
        </div>
      </SectionReveal>
    </>
  );
}
