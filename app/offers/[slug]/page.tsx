import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { ALL_OFFERS, getOffer, buyHref, availability, AVAILABILITY_TEXT, LADDER_ROUTES } from "@/lib/offers";
import { formatOfferPrice, type Offer } from "@/lib/offers/types";
import { OpenLoop } from "@/components/FlexBlock";

export const dynamicParams = false;

export function generateStaticParams() {
  // Next export rejects an empty list; a placeholder (renders notFound) keeps the build valid until offers exist.
  if (ALL_OFFERS.length === 0) return [{ slug: "_none" }];
  return ALL_OFFERS.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = getOffer(slug);
  if (!o) return {};
  const url = `https://titanos.tech/offers/${o.slug}`;
  return {
    title: `${o.name} | TITANOS`,
    description: o.bluf,
    alternates: { canonical: url },
    openGraph: { title: o.name, description: o.bluf, type: "website", url },
    robots: { index: true, follow: true },
  };
}

function List({ items, mark }: { items: string[]; mark: string }) {
  return (
    <ul style={{ listStyle: "none", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "22px 26px", margin: 0 }}>
      {items.map((it) => (
        <li key={it} style={{ color: "var(--text)", lineHeight: 1.7, padding: "8px 0 8px 26px", position: "relative" }}>
          <span aria-hidden="true" style={{ position: "absolute", left: 0, color: "var(--ok)", fontWeight: 700 }}>{mark}</span>
          {it}
        </li>
      ))}
    </ul>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading title={title} />
        <div style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>{children}</div>
      </div>
    </SectionReveal>
  );
}

function Cta({ o }: { o: Offer }) {
  const href = buyHref(o);
  const av = availability(o);
  const interest = `mailto:kyle@titanos.tech?subject=${encodeURIComponent(`Interest: ${o.name}`)}`;
  const hook = o.freeHook.replace(/[.]+$/, "");
  if (av === "BUYABLE" && href) {
    return (
      <>
        <AnimatedButton href={href}>BUY NOW →</AnimatedButton>
        <AnimatedButton href="/scan#request" variant="secondary">START WITH THE FREE STEP</AnimatedButton>
      </>
    );
  }
  if (av === "OPENING") {
    return (
      <>
        <AnimatedButton href="/scan#request">START WITH THE FREE STEP →</AnimatedButton>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
          Free first step open now: {hook}. Online checkout opening soon.
        </p>
      </>
    );
  }
  return (
    <>
      <AnimatedButton href={interest} external>REGISTER INTEREST →</AnimatedButton>
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
        Launching soon. Registering is free and commits you to nothing. Planned free step (when it launches): {hook}.
      </p>
    </>
  );
}

function refundLine(o: Offer): string {
  if (o.cadence === "month" || o.cadence === "per-seat-month") return "Cancel any time by email. No refund for the current month.";
  if (o.cadence === "quote") return "Scope, price and terms are confirmed in writing before you start.";
  return "Refund terms are in our terms and confirmed in writing before you pay.";
}

const PRIVACY_RE = /privacy/i;

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = getOffer(slug);
  if (!o) notFound();
  const ladder = o.ladderUp
    ? o.ladderUp.startsWith("/")
      ? { href: o.ladderUp, label: LADDER_ROUTES[o.ladderUp] ?? "See the next step" }
      : { href: `/offers/${o.ladderUp}`, label: getOffer(o.ladderUp)?.name ?? "See the next step" }
    : null;
  const av = availability(o);
  const privacyRelated = PRIVACY_RE.test([o.name, o.bluf, ...o.youGet].join(" "));
  const buyer = o.buyer.charAt(0).toLowerCase() + o.buyer.slice(1);
  return (
    <>
      <PageHero
        badge={`TITANOS · ${AVAILABILITY_TEXT[av].badge}`}
        title={o.name}
        tagline={o.bluf}
        sub={`Built for ${buyer}. ${formatOfferPrice(o)}. No GST is charged. ${AVAILABILITY_TEXT[av].line}`}
      >
        <Cta o={o} />
      </PageHero>

      <SectionReveal style={{ padding: "var(--space-8) 20px 0", position: "relative", zIndex: 2 }}>
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto", lineHeight: 1.75, textAlign: "center" }}>
          The price is {formatOfferPrice(o)}, and no GST is charged. Before you ask: I am Kyle Deligny, a sole trader
          (ABN 34 318 502 254). Public records only unless you invite us further in, nobody is replaced, and your IT
          provider stays in charge.
        </p>
      </SectionReveal>
      <OpenLoop>Is this one actually for you? The next bit is a short, honest list.</OpenLoop>
      <Block title="Who it's for"><List items={o.forWho} mark="•" /></Block>
      <div className="divider-gold" />
      <Block title="What you get"><List items={o.youGet} mark="✓" /></Block>
      <OpenLoop>And how does it go from a yes to a finished job?</OpenLoop>
      <div className="divider-gold" />
      <Block title="How it works">
        <ol style={{ color: "var(--text)", lineHeight: 1.8, paddingLeft: 22, margin: 0 }}>
          {o.howItWorks.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </Block>
      <div className="divider-gold" />
      <Block title="Why TITANOS does it differently">
        <p style={{ color: "var(--text)", lineHeight: 1.75, margin: 0 }}>{o.edge}</p>
      </Block>
      <OpenLoop>Now the part everyone scrolls to first.</OpenLoop>
      <div className="divider-gold" />
      <Block title="Price">
        <div style={{ background: "var(--card)", border: "1px solid var(--gold-dim)", borderRadius: "var(--radius-md)", padding: "26px 28px", textAlign: "center" }}>
          <div style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif", fontSize: "var(--fs-h2)", fontWeight: 700 }}>
            {formatOfferPrice(o)}
          </div>
          {o.priceNote && o.priceNote.replace(/\s*No GST is charged\.?/gi, "").trim() && (
            <p style={{ color: "var(--ice)", margin: "10px 0 0" }}>{o.priceNote.replace(/\s*No GST is charged\.?/gi, "").trim()}</p>
          )}
          <p style={{ color: "var(--text)", lineHeight: 1.7, margin: "14px 0 0" }}>
            No GST is charged. {refundLine(o)} Full terms: <Link href="/terms" style={{ color: "var(--gold)" }}>/terms</Link>
          </p>
        </div>
      </Block>
      <div className="divider-gold" />
      <Block title="Questions before you decide">
        <FaqItem question="Can I buy this today?">{AVAILABILITY_TEXT[av].line}</FaqItem>
        {o.faq.map((f) => <FaqItem key={f.q} question={f.q}>{f.a}</FaqItem>)}
        {privacyRelated && (
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 14 }}>General information, not legal advice.</p>
        )}
      </Block>

      <SectionReveal style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        {ladder && (
          <p style={{ color: "var(--ice)", marginBottom: 18 }}>
            Want more later? See <Link href={ladder.href} style={{ color: "var(--gold)" }}>{ladder.label}</Link>.
          </p>
        )}
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto 22px", lineHeight: 1.7 }}>
          If you have read this far and it feels like a fit, would it be okay to go ahead? And if it does not, a no is completely welcome.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}><Cta o={o} /></div>
      </SectionReveal>
    </>
  );
}
