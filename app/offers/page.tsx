import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import Link from "next/link";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { Bluf } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import type { Flex } from "@/lib/flex";
import { ALL_OFFERS, offersByGroup, availability, AVAILABILITY_TEXT } from "@/lib/offers";
import { formatAUD } from "@/lib/pricing";
import { GROUP_LABELS, formatOfferPrice, type Offer, type OfferGroup } from "@/lib/offers/types";

const TITLE = "Offers: An Offer for Every Business | TITANOS";
const DESC =
  "Pick who you are, see what TITANOS would do for you, start free or buy online. Prices in AUD, no GST charged.";

const baseMetadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://titanos.tech/offers" },
  openGraph: { title: TITLE, description: DESC, type: "website", url: "https://titanos.tech/offers" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/offers", baseMetadata);

const NEEDS: { id: string; label: string; groups: OfferGroup[] }[] = [
  { id: "need-work", label: "More work", groups: ["tradies", "sales"] },
  { id: "need-protect", label: "Protect my business", groups: ["selfserve", "specialist"] },
  { id: "need-gov", label: "Win government work", groups: ["government"] },
  { id: "need-partners", label: "Grow my partners' clients", groups: ["multipliers"] },
  { id: "need-board", label: "Investor and board", groups: ["enterprise"] },
];

function monthlyEquivalent(o: Offer): number | null {
  if (o.priceAud === null || o.cadence === "quote") return null;
  return o.priceAud;
}

const BUDGETS: { id: string; label: string; test: (o: Offer) => boolean }[] = [
  { id: "budget-free", label: "Free", test: (o) => o.priceAud === 0 },
  {
    id: "budget-under-100",
    label: `Under ${formatAUD(100)}`,
    test: (o) => { const p = monthlyEquivalent(o); return p !== null && p > 0 && p < 100; },
  },
  {
    id: "budget-100-499",
    label: `${formatAUD(100)} to 499`,
    test: (o) => { const p = monthlyEquivalent(o); return p !== null && p >= 100 && p < 500; },
  },
  {
    id: "budget-500-plus",
    label: `${formatAUD(500)} and up`,
    test: (o) => { const p = monthlyEquivalent(o); return p !== null && p >= 500 && o.group !== "enterprise"; },
  },
  { id: "budget-enterprise", label: "Enterprise", test: (o) => o.group === "enterprise" || o.priceAud === null || o.cadence === "quote" },
];

function Card({ o }: { o: Offer }) {
  const av = availability(o);
  const open = av !== "SOON";
  return (
    <Link
      href={`/offers/${o.slug}`}
      style={{
        display: "block",
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "20px 22px",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <strong style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif" }}>{o.name}</strong>
        <span
          style={{
            fontSize: "var(--fs-xs)",
            color: open ? "var(--ok)" : "var(--dim)",
            border: `1px solid ${open ? "var(--ok)" : "var(--border)"}`,
            borderRadius: 999,
            padding: "2px 10px",
            whiteSpace: "nowrap",
          }}
        >
          {AVAILABILITY_TEXT[av].pill}
        </span>
      </div>
      <p style={{ color: "var(--text)", fontSize: "var(--fs-sm)", lineHeight: 1.6, margin: "10px 0" }}>{o.bluf}</p>
      <div style={{ color: "var(--ice)", fontSize: "var(--fs-sm)" }}>{formatOfferPrice(o)}</div>
    </Link>
  );
}

function Grid({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) {
    return <p style={{ color: "var(--dim)", textAlign: "center" }}>Offers in this section are being added.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {offers.map((o) => <Card key={o.slug} o={o} />)}
    </div>
  );
}

function LinkList({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return <p style={{ color: "var(--dim)" }}>Nothing in this list yet.</p>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
      {offers.map((o) => (
        <li key={o.slug}>
          <Link href={`/offers/${o.slug}`} style={{ color: "var(--ice)", fontSize: "var(--fs-sm)", textDecoration: "underline" }}>{o.name}</Link>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: { id: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 28 }}>
      {items.map((i) => (
        <a
          key={i.id}
          href={`#${i.id}`}
          className="offer-chip"
        >
          {i.label}
        </a>
      ))}
    </div>
  );
}

export default function OffersHub() {
  const byGroup = offersByGroup();
  // The biggest true number for this page: how many offers are listed, counted from the catalogue itself.
  const catalogueFlex: Flex = {
    big: `${ALL_OFFERS.length} offers`,
    label: "listed below, each with its price in plain sight",
    kind: "RECORDED",
    analogy: "A menu with the prices printed on it, so nobody has to ask the waiter what things cost.",
    source: "Counted from the TITANOS offer catalogue (lib/offers) when this page is built.",
  };
  const groups = Object.keys(GROUP_LABELS) as OfferGroup[];
  const section = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 } as const;
  return (
    <>
      <PageHero
        badge="TITANOS · OFFERS"
        title="An offer for every business."
        tagline="Pick who you are, see what we would do for you, and start free or buy online."
        sub="Prices are in AUD and no GST is charged. Nothing is touched without your say, nobody is replaced, and your IT provider stays in charge."
      >
        <AnimatedButton href="/scan#request">START WITH THE FREE CHECK →</AnimatedButton>
        <AnimatedButton href="/find" variant="secondary" ariaLabel="Find my offer in 30 seconds">FIND MY OFFER IN 30 SECONDS →</AnimatedButton>
      </PageHero>
      <Bluf>
        Every TITANOS offer has a plain price, a free first step and a way to say no. {ALL_OFFERS.length} listed.
      </Bluf>

      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <FlexNumber f={catalogueFlex} />
          <p style={{ color: "var(--ice)", lineHeight: 1.75, margin: "18px 0 0", textAlign: "center" }}>
            Before you ask. I am Kyle Deligny, a sole trader (ABN 34 318 502 254), and the checks here read public
            records only. Anything that needs access to your accounts happens on a call, with you watching.
          </p>
        </div>
      </SectionReveal>
      <OpenLoop>Not sure where you fit? There are three ways to look below, and the finder up top takes about 30 seconds.</OpenLoop>

      <SectionReveal style={section}>
        <div className="container-vault">
          <SectionHeading title="By who you are" lead="Start with the line that sounds most like you." />
          <Chips items={groups.map((g) => ({ id: `group-${g}`, label: GROUP_LABELS[g] }))} />
          {groups.map((g) => (
            <div key={g} id={`group-${g}`} style={{ marginBottom: 40 }}>
              <h3 style={{ color: "var(--ice)", marginBottom: 14 }}>{GROUP_LABELS[g]}</h3>
              <Grid offers={byGroup[g]} />
            </div>
          ))}
        </div>
      </SectionReveal>

      <OpenLoop>What if you know the problem but not the product?</OpenLoop>

      <div className="divider-gold" />

      <SectionReveal style={section}>
        <div className="container-vault">
          <SectionHeading title="By what you need" lead="Start with the job you want done." />
          <Chips items={NEEDS} />
          {NEEDS.map((n) => (
            <div key={n.id} id={n.id} style={{ marginBottom: 28 }}>
              <h3 style={{ color: "var(--ice)", marginBottom: 10 }}>{n.label}</h3>
              <LinkList offers={ALL_OFFERS.filter((o) => n.groups.includes(o.group))} />
            </div>
          ))}
        </div>
      </SectionReveal>

      <OpenLoop>And if the number on the invoice is what you care about most?</OpenLoop>

      <div className="divider-gold" />

      <SectionReveal style={section}>
        <div className="container-vault">
          <SectionHeading title="By budget" lead="Free first, then upwards. Every price is the price." />
          <Chips items={BUDGETS} />
          {BUDGETS.map((b) => (
            <div key={b.id} id={b.id} style={{ marginBottom: 28 }}>
              <h3 style={{ color: "var(--ice)", marginBottom: 10 }}>{b.label}</h3>
              <LinkList offers={ALL_OFFERS.filter(b.test)} />
            </div>
          ))}
        </div>
      </SectionReveal>

      <SectionReveal style={{ ...section, textAlign: "center" }}>
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto", lineHeight: 1.7 }}>
          Not sure which one fits? Would it be okay to start with the free check, look at what it finds, and
          decide from there? A no is completely welcome.
        </p>
      </SectionReveal>
    </>
  );
}
