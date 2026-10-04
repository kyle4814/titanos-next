/**
 * SalesKit: the shared plain-language sales blocks (copy overhaul 2026-10-05).
 *
 * Source of every line: ocean/SALES_LANGUAGE.md (five pillars, analogy library,
 * honesty rails). Reuses FaqItem, SectionReveal, SectionHeading, ContactButtons.
 *
 *  - Bluf:       one plain first line, plus the "nobody gets replaced" line.
 *  - Analogy:    a picture in one line, with its truth anchor one click away.
 *  - Pillars:    the five pillars in buyer words, in Kyle's close order.
 *  - FrontLoad:  the concerns answered before they are asked.
 *  - FreeStart:  the one next step: free consultation + free report.
 *
 * No urgency, no scarcity, no countdowns. A "no" is welcome.
 */

import type { ReactNode } from "react";
import FaqItem from "@/components/FaqItem";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import ContactButtons from "@/components/ContactButtons";
import AnimatedButton from "@/components/AnimatedButton";
import { DISPLAY } from "@/lib/pricing";
import { AUDIT_MESSAGE_HREF } from "@/lib/config";

const SECTION = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 } as const;

export type AnalogyKey =
  | "department"
  | "preflight"
  | "powersteering"
  | "healthcheck"
  | "smokealarm"
  | "flightrecorder"
  | "twokeys"
  | "nightshift"
  | "spare"
  | "pitcrew"
  | "receipt"
  | "scouts";

const ANALOGIES: Record<AnalogyKey, { line: string; anchor: string }> = {
  department: {
    line: "A whole engineering department, for the price of one person.",
    anchor:
      "The industry-standard COCOMO model sizes the TITANOS build at about 20 engineers for about 27 months. One person built it in about 4 months. Method on the Engineering page.",
  },
  preflight: {
    line: "Like a pilot's pre-flight checklist: thousands of checks before every take-off, not just the first one.",
    anchor:
      "More than 8,000 automated checks run on every change, and a full run takes under 2.5 minutes. Nothing goes live until they pass.",
  },
  powersteering: {
    line: "Power steering, not a self-driving car. You still drive. It just takes the strain off your arms.",
    anchor:
      "The machine carries the repetitive work. A person decides, and a person taps to approve anything important: money, legal, anything sent out, anything that cannot be undone.",
  },
  healthcheck: {
    line: "A free health check before any treatment, so you see exactly what needs work.",
    anchor:
      "The first conversation and your report are free. You know the price before anything starts, and a no is completely fine.",
  },
  smokealarm: {
    line: "Smoke alarms in every room: an alarm goes off before a problem becomes a fire.",
    anchor: "50 problems were stopped before shipping in 4.5 days of building.",
  },
  flightrecorder: {
    line: "A black-box flight recorder: every action is recorded, so you can always see what happened and when.",
    anchor: "Every action the system takes is written to a receipts ledger. You get a receipt, not a 'trust me'.",
  },
  twokeys: {
    line: "Two keys to launch: nothing important happens without a human turning the key.",
    anchor:
      "Money, legal commitments, anything sent to a third party and anything irreversible each need a person's tap. A chat 'yes' alone did not open the website deploy.",
  },
  nightshift: {
    line: "A night shift that never gets tired: it researches and checks while you sleep, and hands you the results at breakfast.",
    anchor: "166+ research passes have run on their own.",
  },
  spare: {
    line: "A spare tyre and a full service history: if anything breaks, we roll back to yesterday in one command.",
    anchor: "Backups run every 5 minutes, and every website publish keeps a backup and a rollback.",
  },
  pitcrew: {
    line: "A pit crew, not a repair shop: back on the track fast, not parked for a week.",
    anchor:
      "In one evening on 4 October 2026 the system researched and checked 34 organisations, built a full call system and put a new website live. A first, scoped fix is the aim for the first week.",
  },
  receipt: {
    line: "You pay for the result at a price you know before we start, not an open taxi meter.",
    anchor: "Prices are published on this site and are known before any work begins.",
  },
  scouts: {
    line: "Scouts go out first, so you only walk into ground that has already been checked.",
    anchor: "Every finding is checked against live public records, with a control check first.",
  },
};

/** One plain first line. `replaced` adds the line that matters most on any AI page. */
export function Bluf({
  children,
  replaced = false,
}: {
  children: ReactNode;
  replaced?: boolean;
}) {
  return (
    <SectionReveal style={{ ...SECTION, paddingBottom: 0 }}>
      <div
        className="container-vault"
        style={{
          maxWidth: "var(--maxw-prose)",
          margin: "0 auto",
          background: "var(--card)",
          border: "1px solid var(--gold-dim)",
          borderRadius: "var(--radius-md)",
          padding: "24px 26px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-lg)",
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 500,
          }}
        >
          {children}
        </p>
        {replaced && (
          <p style={{ color: "var(--gold)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: "14px 0 0" }}>
            Nobody gets replaced. Your people stay. They stop doing the boring parts and get their hours back.
          </p>
        )}
      </div>
    </SectionReveal>
  );
}

/** A picture in one line; the truth anchor sits one click away. */
export function Analogy({ k }: { k: AnalogyKey }) {
  const a = ANALOGIES[k];
  return (
    <div
      style={{
        maxWidth: "var(--maxw-prose)",
        margin: "0 auto",
        textAlign: "center",
        padding: "var(--space-8) 20px 0",
        position: "relative",
        zIndex: 2,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontStyle: "italic",
          color: "var(--gold)",
          fontSize: "var(--fs-h4)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {a.line}
      </p>
      <details style={{ marginTop: 10 }}>
        <summary style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", cursor: "pointer" }}>
          Where that comes from
        </summary>
        <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7, margin: "8px 0 0" }}>
          {a.anchor}
        </p>
      </details>
    </div>
  );
}

const PILLARS: { head: string; body: string }[] = [
  {
    head: "The team you would never afford",
    body: "You get the output of a 20-person engineering team, for the price of one.",
  },
  {
    head: "Speed you can feel",
    body: "Tell me on Monday what is slowing you down. The aim is to have the first fix working by the end of the week.",
  },
  {
    head: "Safe the way pilots are safe",
    body: "Nothing we build goes live until it passes thousands of automated checks, every single time.",
  },
  {
    head: "Nobody loses their job",
    body: "Your people stay. They stop doing the boring parts and get their hours back.",
  },
  {
    head: "The no-brainer",
    body: "The first conversation and your report are free. You know the price before anything starts, and if it is not for you, that is completely fine.",
  },
];

export function Pillars({ title = "What changes for you" }: { title?: string }) {
  return (
    <SectionReveal style={SECTION}>
      <div className="container-vault">
        <SectionHeading title={title} showKeyhole={false} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
            maxWidth: "var(--maxw-wide)",
            margin: "0 auto",
          }}
        >
          {PILLARS.map((p, i) => (
            <div
              key={p.head}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "20px 22px",
              }}
            >
              <p
                className="font-mono"
                style={{ color: "var(--gold-dim)", fontSize: "var(--fs-xs)", letterSpacing: "0.14em", margin: "0 0 6px" }}
              >
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3
                style={{
                  color: "var(--ice)",
                  fontSize: "var(--fs-lg)",
                  fontWeight: 600,
                  margin: "0 0 8px",
                  lineHeight: 1.35,
                }}
              >
                {p.head}
              </h3>
              <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.7, margin: 0 }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}

export type QA = { q: string; a: ReactNode };

/** The concerns, answered before they are raised. `extra` goes first, page-specific. */
export function FrontLoad({
  extra = [],
  title = "Straight answers, before you ask",
}: {
  extra?: QA[];
  title?: string;
}) {
  const base: QA[] = [
    {
      q: "Is this safe?",
      a: (
        <>
          Yes, and here is how. Nothing we build goes live until it passes thousands of automated checks, like a
          pilot&apos;s pre-flight checklist, every single time. Anything important (money, legal, anything sent out,
          anything that cannot be undone) needs a person&apos;s tap first. Everything the system does is recorded.
        </>
      ),
    },
    {
      q: "Will it replace my staff?",
      a: (
        <>
          No. Nobody gets replaced. Think power steering, not a self-driving car: you still drive, it takes the strain
          off your arms. Your people stay and get their hours back from the repetitive parts.
        </>
      ),
    },
    {
      q: "How do you know it works?",
      a: (
        <>
          The industry-standard COCOMO model sizes the TITANOS build at about 20 engineers for about 27 months. One
          person built it in about 4 months, with more than 8,000 automated checks guarding it. The method is shown in
          full on the <a href="/engineering" style={{ color: "var(--gold)" }}>Engineering page</a>, so you can check it
          yourself.
        </>
      ),
    },
    {
      q: "What does it cost?",
      a: (
        <>
          The first conversation and your report are free. After that the prices are published and you know yours before
          anything starts: Titanos Monitor {DISPLAY.MONITOR_MONTHLY}, the Privacy Act compliance pack {DISPLAY.PACK_PRICE}
          , and AI retainers from {DISPLAY.AI_GROWTH_PARTNER} ({DISPLAY.AI_RETAINER_MIN}). You pay for the result, not an
          open taxi meter.
        </>
      ),
    },
    {
      q: "We already have an IT provider. Where does that leave them?",
      a: (
        <>
          Right beside you. This sits next to your IT provider, nothing goes live without passing the checks, and you
          keep control of every change. If it helps, I am happy to talk to them directly.
        </>
      ),
    },
    {
      q: "What happens next?",
      a: (
        <>
          1. You message or call me. 2. We have a free half-hour where you tell me what is slowing you down. 3. I send
          you a free report on your business, so you can see what I see. 4. If you like it, you get a price before
          anything starts. If it is not for you, that is completely fine and the report is still yours.
        </>
      ),
    },
  ];
  return (
    <SectionReveal style={SECTION}>
      <div className="container-vault" style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
        <SectionHeading title={title} showKeyhole={false} />
        {[...extra, ...base].map((x) => (
          <FaqItem key={x.q} question={x.q}>
            {x.a}
          </FaqItem>
        ))}
      </div>
    </SectionReveal>
  );
}

/** The one next step behind every door. */
export function FreeStart({
  title = "Start with a free consultation and a free report on your business",
}: {
  title?: string;
}) {
  return (
    <SectionReveal style={{ ...SECTION, paddingBottom: "var(--space-20)", textAlign: "center" }}>
      <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 400,
            fontStyle: "italic",
            marginBottom: 14,
            letterSpacing: "0.01em",
          }}
        >
          {title}
        </h2>
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 22px" }}>
          I am Kyle, the founder of TITANOS. If you like me, you like the business and you like the offer, or we can
          shape it into something that works for you, would you be happy to start with a free half-hour? You leave with
          a clear picture of what you could do next and a report of your own. A no is welcome.
        </p>
        <ContactButtons heading={null} />
        <div style={{ marginTop: 18 }}>
          <AnimatedButton href={AUDIT_MESSAGE_HREF} variant="secondary">
            Or send a message first
          </AnimatedButton>
        </div>
      </div>
    </SectionReveal>
  );
}
