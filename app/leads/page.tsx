import type { Metadata } from "next";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { SITE } from "@/lib/config";
import { LEADS, DISPLAY, formatAUD } from "@/lib/pricing";

// Fourth door — verified AU lead lists, sold by the compliance practice.
// Deploy of this page is HELD until the DataForSEO fulfilment pipeline
// has produced one end-to-end test list. A pricing page for a service
// that can't be delivered yet is a credibility hole the brand can't take.

const BOOK_CALL = SITE.CAL_15MIN_URL;

const META_TITLE = "Titanos Leads & Intelligence — Verified AU Business Contacts";
const META_DESC = `Verified Australian business contact lists, built by a Privacy Act compliance practice. ${DISPLAY.LEADS_STARTER_FROM}. Bounce guarantee. You own the data.`;

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/leads" },
  openGraph: {
    title: META_TITLE,
    description: META_DESC,
    url: "https://titanos.tech/leads",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: META_TITLE,
    description: META_DESC,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const PROBLEMS = [
  {
    title: "Scraped lists bounce.",
    body: "Most cheap AU contact lists are scraped once, never verified, and commonly bounce on first send — often 30–50% — torching your sender reputation before you've made a single pitch.",
  },
  {
    title: "Agencies charge $5–10K and lock you in.",
    body: "Lead-gen agencies bundle the list into a retainer you can't leave, and you never actually own the data.",
  },
  {
    title: "The big tools barely cover Australia.",
    body: "Apollo, ZoomInfo and the rest are built on US/EU density. Coverage on a 14-person regional AU business is thin to nonexistent.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "Verified before delivery.",
    body: "Every email is checked deliverable before it reaches you. Anything that bounces in the first 30 days, I replace free.",
  },
  {
    title: "Named where I can find them.",
    body: "Where a business publicly lists an owner or manager's contact, you get it. Where it doesn't, you get the verified main business contact — every row reachable, none invented. I'd rather give you a real info@ that works than a 'decision maker' address I made up.",
  },
  {
    title: "Legal by design.",
    body: "I sell Privacy Act compliance for a living. This data is public business information, handled the way the Privacy Act expects: suppression on request, no sensitive personal data, transparent sourcing. You're buying from someone who does compliance, not someone who'll make you the subject of a complaint.",
  },
  {
    title: "AU-native coverage.",
    body: "Built specifically for Australian SMBs across every metro — including the regional businesses the big tools miss.",
  },
];

const STEPS = [
  {
    num: "I",
    title: "SCOPE",
    body: "A short call (or intake form) where you tell me the industry, region, and what a good contact looks like for you. I tell you honestly whether I can hit the volume at the quality you need.",
  },
  {
    num: "II",
    title: "BUILD + VERIFY",
    body: "I source from public AU business listings, extract the named owner or manager wherever they're publicly listed, and use the verified main business contact otherwise. Every email is checked deliverable before it goes anywhere near your CSV.",
  },
  {
    num: "III",
    title: "DELIVER",
    body: "You get a clean CSV (or your format of choice), every field labelled, every email verified. Anything that bounces in 30 days, I replace free.",
  },
];

const LEGAL_PILLARS = [
  {
    title: "Public business information only.",
    body: "Sourced from publicly listed business data — the same information any customer sees searching for that business.",
  },
  {
    title: "No sensitive personal data.",
    body: "No data about individuals beyond business-role contact details that are already public.",
  },
  {
    title: "Suppression honoured immediately.",
    body: "Anyone who asks to be removed is suppressed across every future list, permanently. Reply STOP and you're gone.",
  },
  {
    title: "Transparent on request.",
    body: "I'll tell any contact exactly where their business details came from.",
  },
  {
    title: "You inherit clean data.",
    body: "Because I handle it compliantly, the list you receive doesn't hand you a Privacy Act problem the moment you import it.",
  },
];

export default function LeadsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Titanos Leads & Intelligence",
    provider: { "@type": "Organization", name: "Titanos" },
    serviceType: "Verified business contact lists",
    description:
      "Verified Australian business contact lists — sourced from public business information, with named owner or decision-maker where publicly available and the verified main business contact otherwise. Every email checked deliverable before delivery. Built by a Privacy Act compliance practice.",
    areaServed: ["AU", "NZ", "SG"],
    offers: [
      {
        "@type": "Offer",
        name: "Leads Starter",
        price: String(LEADS.STARTER.price),
        priceCurrency: "AUD",
        description: `${LEADS.STARTER.contacts} verified contacts, one industry, one region. Delivered within ${LEADS.STARTER.turnaround}. 30-day bounce replacement.`,
      },
      {
        "@type": "Offer",
        name: "Leads Growth",
        price: String(LEADS.GROWTH.price),
        priceCurrency: "AUD",
        description: `${LEADS.GROWTH.contacts} verified contacts, up to ${LEADS.GROWTH.industries} industries or regions. Delivered within ${LEADS.GROWTH.turnaround}. 30-day bounce replacement.`,
      },
      {
        "@type": "Offer",
        name: "Leads Campaign",
        price: String(LEADS.CAMPAIGN.price),
        priceCurrency: "AUD",
        description: `${LEADS.CAMPAIGN.contacts} verified contacts on a custom ICP, with company-size signals and a segmentation breakdown. Delivered within ${LEADS.CAMPAIGN.turnaround}.`,
      },
      {
        "@type": "Offer",
        name: "Intelligence Retainer",
        price: String(LEADS.RETAINER.price),
        priceCurrency: "AUD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          valueAddedTaxIncluded: false,
          referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
          description: `${LEADS.RETAINER.contactsPerMonth} fresh verified contacts every month plus market-movement notes.`,
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge="TITANOS · LEADS & INTELLIGENCE"
        title="Verified Australian business contacts, built by the compliance practice that knows which data is legal to hold."
        sub="Reach real Australian businesses without bouncing — with the named owner or decision-maker where publicly available, and the verified main business contact otherwise. Sourced from public business information, suppression honoured on request. Not a scraper dump. A research outcome I stand behind with a 30-day bounce guarantee."
        trustLine="Public business information · Privacy Act-aware · every email verified before delivery · reply STOP and you're suppressed forever."
      >
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href="#pricing" variant="primary">
            SEE PRICING ↓
          </AnimatedButton>
          <AnimatedButton href={BOOK_CALL} external variant="secondary">
            BOOK A 15-MIN FIT CALL →
          </AnimatedButton>
        </div>
        <p
          style={{
            marginTop: 18,
            color: "var(--dim)",
            fontSize: "var(--fs-xs)",
            letterSpacing: "0.04em",
          }}
        >
          ABN 34 318 502 254 · Australian-owned · built by the Titanos compliance practice
        </p>
      </PageHero>

      <div className="divider-gold" />

      {/* ═══ 1.2 — The problem ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="THE LIST YOU BUY IS USUALLY GARBAGE" />
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            {PROBLEMS.map((p) => (
              <article
                key={p.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 28,
                }}
              >
                <h4
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-body)",
                    letterSpacing: "0.04em",
                    marginBottom: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {p.title}
                </h4>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ 1.3 — Differentiators ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="WHAT MAKES THIS DIFFERENT" />
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            {DIFFERENTIATORS.map((d) => (
              <article
                key={d.title}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: 28,
                }}
              >
                <h3
                  style={{
                    color: "var(--ice)",
                    fontSize: "var(--fs-body)",
                    fontWeight: 600,
                    marginBottom: 10,
                    lineHeight: 1.35,
                    fontFamily: "var(--font-body), system-ui, sans-serif",
                  }}
                >
                  <span style={{ color: "var(--ok)", marginRight: 8, fontWeight: 400 }}>✓</span>
                  {d.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {d.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ 1.4 — Pricing tiers ═══ */}
      <SectionReveal
        id="pricing"
        style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}
      >
        <div className="container-vault">
          <SectionHeading
            title="PRICING"
            lead="Reach real Australian businesses without bouncing. One-off lists or an ongoing feed — every tier verified at delivery, every tier covered by the 30-day bounce replacement."
          />
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            <LeadsTier
              tag="THE TRY-IT TIER"
              title="Starter"
              price={DISPLAY.LEADS_STARTER}
              priceUnit={`${LEADS.STARTER.contacts} verified contacts · ${LEADS.STARTER.turnaround}`}
              bullets={[
                `One industry, one region of your choice`,
                `Business name, website, email (verified deliverable), phone, category`,
                `CSV delivered within ${LEADS.STARTER.turnaround}`,
                `30-day bounce replacement`,
              ]}
              ctaLabel="START WITH 250 →"
              ctaHref={BOOK_CALL}
            />
            <LeadsTier
              tag="MOST POPULAR"
              highlight
              title="Growth"
              price={DISPLAY.LEADS_GROWTH}
              priceUnit={`${LEADS.GROWTH.contacts} verified contacts · ${LEADS.GROWTH.turnaround}`}
              bullets={[
                `Up to ${LEADS.GROWTH.industries} industries or regions`,
                `Everything in Starter, plus named owner or decision-maker contact where publicly available, and the verified business email otherwise`,
                `LinkedIn URL where found, plus a quality score per row`,
                `30-day bounce replacement`,
              ]}
              ctaLabel="GET 1,000 →"
              ctaHref={BOOK_CALL}
            />
            <LeadsTier
              tag="CAMPAIGN"
              title="Campaign"
              price={DISPLAY.LEADS_CAMPAIGN}
              priceUnit={`${LEADS.CAMPAIGN.contacts} verified contacts · ${LEADS.CAMPAIGN.turnaround}`}
              bullets={[
                `Custom ICP — we scope it together on a call`,
                `Everything in Growth, plus company-size signals + segmentation breakdown`,
                `30-minute targeting strategy call included`,
                `30-day bounce replacement`,
              ]}
              ctaLabel="SCOPE A CAMPAIGN →"
              ctaHref={BOOK_CALL}
            />
            <LeadsTier
              tag="RECURRING · THE INTELLIGENCE FEED"
              title="Intelligence Retainer"
              price={DISPLAY.LEADS_RETAINER}
              priceUnit={`${LEADS.RETAINER.contactsPerMonth} fresh verified contacts every month`}
              bullets={[
                `Ongoing feed in your defined ICP, delivered monthly`,
                `Market-movement notes: new businesses entering your category, signals that changed`,
                `Everything verified, every month · 30-day bounce replacement applies`,
                `Cancel any time — one email, no retention dance`,
              ]}
              ctaLabel="START THE RETAINER →"
              ctaHref={BOOK_CALL}
            />
          </div>

          <p
            style={{
              textAlign: "center",
              color: "var(--ice)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.7,
              maxWidth: "var(--maxw-prose)",
              margin: "32px auto 8px",
            }}
          >
            Bigger volume or a vertical I haven&apos;t listed?{" "}
            <a href={BOOK_CALL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>
              Tell me what you need →
            </a>
          </p>
          <p
            style={{
              textAlign: "center",
              color: "var(--dim)",
              fontSize: "var(--fs-sm)",
              lineHeight: 1.7,
              maxWidth: "var(--maxw-prose)",
              margin: "0 auto",
            }}
          >
            Not sure which? Start with a 15-minute fit call — I&apos;ll tell you honestly
            whether I can deliver what you need before you pay a cent.
          </p>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ 1.5 — How it works ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="HOW IT WORKS" lead="Three steps, no surprises." />
          <div
            className="grid-auto-cards"
            style={{ gap: 22, maxWidth: "var(--maxw-wide)", margin: "0 auto" }}
          >
            {STEPS.map((s) => (
              <article
                key={s.num}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "var(--radius-md)",
                  padding: "32px 26px 26px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-h3)",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    lineHeight: 1,
                  }}
                  aria-hidden="true"
                >
                  {s.num}
                </div>
                <h3
                  style={{
                    fontFamily: "var(--font-display), Georgia, serif",
                    color: "var(--gold)",
                    fontSize: "var(--fs-body)",
                    letterSpacing: "0.08em",
                    marginBottom: 14,
                    lineHeight: 1.4,
                  }}
                >
                  {s.title}
                </h3>
                <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
                  {s.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ 1.6 — Legal-by-design (load-bearing) ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="BUILT BY A COMPLIANCE PRACTICE — ON PURPOSE" />
          <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
            <p
              style={{
                color: "var(--text)",
                fontSize: "var(--fs-body)",
                lineHeight: 1.75,
                marginBottom: 24,
              }}
            >
              I run Titanos as a Privacy Act + Essential Eight compliance practice.
              Building a lead service that I&apos;d then have to be ashamed of would be
              absurd. So this one is built the way I tell my compliance clients to
              build theirs:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {LEGAL_PILLARS.map((l) => (
                <article
                  key={l.title}
                  style={{
                    background: "var(--card)",
                    border: "1px solid var(--gold-dim)",
                    borderLeft: "3px solid var(--gold)",
                    borderRadius: "var(--radius-sm)",
                    padding: "18px 22px",
                  }}
                >
                  <h4
                    style={{
                      fontFamily: "var(--font-display), Georgia, serif",
                      color: "var(--gold)",
                      fontSize: "var(--fs-body)",
                      letterSpacing: "0.04em",
                      marginBottom: 6,
                      lineHeight: 1.4,
                    }}
                  >
                    {l.title}
                  </h4>
                  <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.7, margin: 0 }}>
                    {l.body}
                  </p>
                </article>
              ))}
            </div>

            <p
              style={{
                color: "var(--ice)",
                fontSize: "var(--fs-body)",
                lineHeight: 1.75,
                marginTop: 28,
              }}
            >
              If you want the same compliance posture for your own business,
              that&apos;s literally the other thing I do →{" "}
              <a href="/compliance" style={{ color: "var(--gold)" }}>
                Privacy Act compliance
              </a>
              .
            </p>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ 1.7 — FAQ ═══ */}
      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="THE QUESTIONS EVERY BUYER ASKS FIRST" />
          <div style={{ maxWidth: "var(--maxw-content)", margin: "0 auto" }}>
            <FaqItem question="Where does the data come from?">
              Public Australian business listings and the businesses&apos; own public
              websites — the same information available to anyone searching for that
              business. I structure it, verify it, and deliver it; I don&apos;t pull
              anything that isn&apos;t already public.
            </FaqItem>
            <FaqItem question="Is this legal under the Privacy Act?">
              Yes — and I&apos;d know, since Privacy Act compliance is my main
              practice. Business contact details that are publicly listed are handled
              here the way the Act expects: no sensitive data, suppression on request,
              transparent sourcing.
            </FaqItem>
            <FaqItem question="What's the bounce guarantee?">
              Every email is verified deliverable before delivery. If anything bounces
              within 30 days of delivery, I replace it free. I&apos;d rather
              under-promise volume than pad a list with addresses that don&apos;t work.
            </FaqItem>
            <FaqItem question="Are these decision-maker contacts?">
              Where a business publicly lists the owner or a manager&apos;s direct contact,
              yes — you get it. Where they don&apos;t, you get the verified main business
              email. I never invent a &ldquo;decision maker&rdquo; address to pad the list.
              Every contact is real, verified deliverable, and reachable — that&apos;s the
              part I guarantee.
            </FaqItem>
            <FaqItem question="Do I own the data?">
              Yes. It&apos;s delivered to you as a file you keep. No platform lock-in,
              no access that expires.
            </FaqItem>
            <FaqItem question="Can you do industries / regions not listed?">
              Almost certainly — ask. The pricing tiers are about volume; the targeting
              is yours to define.
            </FaqItem>
            <FaqItem question="How is this different from Apollo or ZoomInfo?">
              Those are US-built subscription tools with thin AU coverage, especially
              regionally. This is AU-native, verified per-list, and delivered as a
              research product you own — not a seat you rent.
            </FaqItem>
            <FaqItem question="How fast?">
              Starter in {LEADS.STARTER.turnaround}, larger tiers {LEADS.CAMPAIGN.turnaround}.
              The retainer delivers monthly on a fixed date.
            </FaqItem>
            <FaqItem question="What format?">
              CSV by default. Tell me if you need something else.
            </FaqItem>
          </div>
        </div>
      </SectionReveal>

      <div className="divider-gold" />

      {/* ═══ 1.8 — Closing CTA ═══ */}
      <SectionReveal
        style={{
          textAlign: "center",
          padding: "var(--space-20) 20px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            color: "var(--gold)",
            fontSize: "var(--fs-h2)",
            fontWeight: 700,
            marginBottom: 14,
            letterSpacing: "0.05em",
          }}
        >
          TELL ME WHO YOU&apos;RE TRYING TO REACH
        </h2>
        <p
          style={{
            color: "var(--ice)",
            fontSize: "var(--fs-lg)",
            marginBottom: 32,
            maxWidth: "var(--maxw-prose)",
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          A 15-minute fit call. I&apos;ll tell you honestly whether I can deliver the
          volume and quality you need — before you pay anything.
        </p>
        <div style={{ display: "inline-flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          <AnimatedButton href={BOOK_CALL} external variant="primary">
            BOOK A 15-MIN FIT CALL →
          </AnimatedButton>
          <AnimatedButton href="#pricing" variant="secondary">
            SEE PRICING ↑
          </AnimatedButton>
        </div>
      </SectionReveal>
    </>
  );
}

/* ─── LeadsTier card ─────────────────────────────────────── */
function LeadsTier({
  tag,
  title,
  price,
  priceUnit,
  bullets,
  ctaLabel,
  ctaHref,
  highlight = false,
}: {
  tag: string;
  title: string;
  price: string;
  priceUnit: string;
  bullets: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <article
      style={{
        background: "var(--card)",
        border: highlight ? "1px solid var(--gold)" : "1px solid var(--gold-dim)",
        boxShadow: highlight ? "0 0 0 1px rgb(var(--gold-rgb) / 0.35)" : undefined,
        borderRadius: "var(--radius-md)",
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          color: highlight ? "var(--gold)" : "var(--ice)",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.16em",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {tag}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h3)",
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1.25,
          marginBottom: 10,
        }}
      >
        {title}
      </h3>
      <div
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: "var(--gold)",
          fontSize: "var(--fs-h3)",
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        {price}
        <span
          style={{
            color: "var(--text)",
            fontSize: "var(--fs-xs)",
            fontWeight: 400,
            display: "block",
            marginTop: 4,
            letterSpacing: "0.02em",
          }}
        >
          {priceUnit}
        </span>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "20px 0 22px",
          flexGrow: 1,
          color: "var(--text)",
          fontSize: "var(--fs-sm)",
          lineHeight: 1.6,
        }}
      >
        {bullets.map((b) => (
          <li key={b} style={{ marginBottom: 10, paddingLeft: 18, position: "relative" }}>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 0,
                top: 1,
                color: "var(--ok)",
              }}
            >
              ✓
            </span>
            {b}
          </li>
        ))}
      </ul>
      <AnimatedButton href={ctaHref} external variant={highlight ? "primary" : "secondary"}>
        {ctaLabel}
      </AnimatedButton>
    </article>
  );
}
