import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import PageHero from "@/components/PageHero";
import ReferForm from "@/components/ReferForm";
import FaqItem from "@/components/FaqItem";
import { Inscription, SystemLabel, DepthIndex, OperatorNote } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const baseMetadata: Metadata = {
  title: "Refer & Earn: Partner Network · TITANOS",
  description:
    "Commission-only referral partner network. Introduce a business to Titanos, earn commission on real closed revenue. No joining fee, no exclusivity, your own ABN.",
  alternates: { canonical: "https://titanos.tech/refer" },
  openGraph: {
    title: "Refer & Earn: Titanos Partner Network",
    description:
      "Commission-only referrals. Introduce a business, earn on real closed revenue. No joining fee, ever.",
    type: "website",
    url: "https://titanos.tech/refer",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/refer", baseMetadata);

export default function ReferPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much can I earn?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Commission is a percentage of real revenue Titanos actually collects from a client you introduce, paid on closed, collected revenue, never on a quote or a maybe.",
        },
      },
      {
        "@type": "Question",
        name: "Is there a joining fee?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. No joining fee, no paid starter pack, no cost to apply or to stay in the network, ever.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to be exclusive to Titanos?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. You're an independent contractor with your own ABN, free to work with others, on your own schedule.",
        },
      },
      {
        "@type": "Question",
        name: "What if two partners introduce the same prospect?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "First genuine introduction wins, tracked by timestamp in Titanos's own attribution log, not a manual judgement call.",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <PageHero
        badge="PARTNER NETWORK"
        title="Know a business buried in manual work? Introduce us, and get paid when it closes."
        tagline="A commission-only referral network. No joining fee, no exclusivity, no minimum activity."
        sub="You make a warm introduction. If a deal closes and the money is collected, you earn commission. That is the whole model, and you are free to say no at any point."
      />
      <Bluf replaced>
        Know a business drowning in manual work? Introduce them, and when the deal closes you are paid. No joining fee. For your own business, you can book a free consultation with Kyle on the audit page.
      </Bluf>
      <Analogy k="healthcheck" />

      <SectionReveal style={{ padding: "var(--space-8) 20px 0" }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={FLEX.market} />
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "18px 0 0", textAlign: "center" }}>
            Before you ask. I am Kyle Deligny, a sole trader (ABN 34 318 502 254), and I review every application myself.
            Nothing is sent to anyone without your say. Nobody is replaced by what we build, and the business you
            introduce keeps its own IT person in charge. It costs you nothing to join.
          </p>
        </div>
      </SectionReveal>
      <OpenLoop>So how does an introduction turn into a payout, and who decides?</OpenLoop>

      <section aria-label="The invitation" style={{ padding: "var(--space-8) 20px var(--space-4)", position: "relative", zIndex: 2 }}>
        <Inscription label="The final stage" sub="You may already know a business that would be glad of an introduction. This is where you can make one.">
          You already know who&apos;s drowning in manual work.
          <br />
          <span style={{ color: "var(--gold)" }}>Point us at them. Get paid when it closes.</span>
        </Inscription>
      </section>

      <SectionReveal>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "40px auto 40px", textAlign: "center" }}>
          <DepthIndex index={1} total={3} style={{ textAlign: "center" }} />
          <SystemLabel style={{ marginBottom: 8 }}>Attribution log · timestamped, not judged</SystemLabel>
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h2)",
              letterSpacing: "0.06em",
              marginBottom: 18,
            }}
          >
            How it works, step by step
          </h2>
          <ol
            style={{
              textAlign: "left",
              color: "var(--text)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.8,
              maxWidth: 520,
              margin: "0 auto",
              paddingLeft: 20,
            }}
          >
            <li>Apply below, takes under a minute, no fee.</li>
            <li>Kyle reviews and approves your application personally.</li>
            <li>You get a private portal link. Submit warm introductions from there.</li>
            <li>Deal closes and gets paid → commission accrues automatically.</li>
            <li>Payouts are validated (ABN checked, RCTI agreement in place) before they run.</li>
          </ol>
          <OperatorNote style={{ margin: "var(--space-8) auto 0", textAlign: "left" }}>
            I review every application myself. Nobody else decides who&apos;s in the network,
            and nobody else signs off on a payout.
          </OperatorNote>
        </div>
      </SectionReveal>

      <OpenLoop>Ready to look at the form? It takes under a minute, and nothing is committed.</OpenLoop>

      <SectionReveal>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto 12px", textAlign: "center" }}>
          <DepthIndex index={2} total={3} style={{ textAlign: "center" }} />
        </div>
        <ReferForm />
      </SectionReveal>

      <OpenLoop>A few things people ask before they apply, answered up front.</OpenLoop>

      <SectionReveal>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "50px auto 0" }}>
          <DepthIndex index={3} total={3} style={{ textAlign: "center" }} />
          <h2
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              color: "var(--gold)",
              fontSize: "var(--fs-h2)",
              letterSpacing: "0.06em",
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            Questions before you apply
          </h2>
          <FaqItem question="How much can I earn?">
            Commission is a percentage of real revenue Titanos actually collects from a client
            you introduce, paid on closed, collected revenue, never on a quote or a maybe.
          </FaqItem>
          <FaqItem question="Is there a joining fee?">
            No. No joining fee, no paid starter pack, no cost to apply or to stay in the
            network, ever.
          </FaqItem>
          <FaqItem question="Do I need to be exclusive to Titanos?">
            No. You&apos;re an independent contractor with your own ABN, free to work with
            others, on your own schedule.
          </FaqItem>
          <FaqItem question="What if two partners introduce the same prospect?">
            First genuine introduction wins, tracked by timestamp in Titanos&apos;s own
            attribution log, not a manual judgement call.
          </FaqItem>
        </div>
      </SectionReveal>
      <SectionReveal style={{ textAlign: "center", padding: "var(--space-8) 20px var(--space-4)" }}>
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          Would it be okay if you had a look at the form when you have a quiet minute? If it is not for you, a no is
          completely welcome and we stay friends.
        </p>
      </SectionReveal>
      <FrontLoad/>
    </>
  );
}
