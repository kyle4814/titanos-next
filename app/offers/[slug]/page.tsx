import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { ALL_OFFERS, getOffer, buyHref } from "@/lib/offers";
import { formatOfferPrice, type Offer } from "@/lib/offers/types";

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
  const interest = `mailto:kyle@titanos.tech?subject=${encodeURIComponent(`Interest: ${o.name}`)}`;
  if (href) {
    return (
      <>
        <AnimatedButton href={href}>BUY NOW →</AnimatedButton>
        <AnimatedButton href="/scan#request" variant="secondary">{o.freeHook.toUpperCase()}</AnimatedButton>
      </>
    );
  }
  if (o.status === "READY") {
    return (
      <>
        <AnimatedButton href="/scan#request">START WITH THE FREE STEP →</AnimatedButton>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
          Free step: {o.freeHook.replace(/[.]+$/, "")}. Online checkout opens shortly.
        </p>
      </>
    );
  }
  return (
    <>
      <AnimatedButton href={interest} external>REGISTER INTEREST →</AnimatedButton>
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
        Launching soon. Registering is free and commits you to nothing. Free step in the meantime: {o.freeHook.replace(/[.]+$/, "")}.
      </p>
    </>
  );
}

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = getOffer(slug);
  if (!o) notFound();
  const ladder = o.ladderUp
    ? o.ladderUp.startsWith("/") ? { href: o.ladderUp, label: o.ladderUp } : { href: `/offers/${o.ladderUp}`, label: getOffer(o.ladderUp)?.name ?? o.ladderUp }
    : null;
  const available = o.status === "READY";
  return (
    <>
      <PageHero
        badge={`TITANOS · ${available ? "AVAILABLE NOW" : "LAUNCHING SOON"}`}
        title={o.name}
        tagline={o.bluf}
        sub={`For ${o.buyer}. ${formatOfferPrice(o)}. No GST is charged.`}
      >
        <Cta o={o} />
      </PageHero>

      <Block title="Who it's for"><List items={o.forWho} mark="•" /></Block>
      <div className="divider-gold" />
      <Block title="What you get"><List items={o.youGet} mark="✓" /></Block>
      <div className="divider-gold" />
      <Block title="How it works">
        <ol style={{ color: "var(--text)", lineHeight: 1.8, paddingLeft: 22, margin: 0 }}>
          {o.howItWorks.map((s) => <li key={s}>{s}</li>)}
        </ol>
      </Block>
      <div className="divider-gold" />
      <Block title="The TITANOS edge">
        <p style={{ color: "var(--text)", lineHeight: 1.75, margin: 0 }}>{o.edge}</p>
      </Block>
      <div className="divider-gold" />
      <Block title="Price">
        <div style={{ background: "var(--card)", border: "1px solid var(--gold-dim)", borderRadius: "var(--radius-md)", padding: "26px 28px", textAlign: "center" }}>
          <div style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif", fontSize: "var(--fs-h2)", fontWeight: 700 }}>
            {formatOfferPrice(o)}
          </div>
          {o.priceNote && <p style={{ color: "var(--ice)", margin: "10px 0 0" }}>{o.priceNote}</p>}
          <p style={{ color: "var(--text)", lineHeight: 1.7, margin: "14px 0 0" }}>
            No GST is charged. Cancel any time, or ask for a refund if it is not what we said it would be.
          </p>
        </div>
      </Block>
      <div className="divider-gold" />
      <Block title="Straight answers">
        {o.faq.map((f) => <FaqItem key={f.q} question={f.q}>{f.a}</FaqItem>)}
      </Block>

      <SectionReveal style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        {ladder && (
          <p style={{ color: "var(--ice)", marginBottom: 18 }}>
            Want more later? See <Link href={ladder.href} style={{ color: "var(--gold)" }}>{ladder.label}</Link>.
          </p>
        )}
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto 22px", lineHeight: 1.7 }}>
          If you like what you have read and it fits, would it be okay to go ahead? A no is welcome too.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}><Cta o={o} /></div>
      </SectionReveal>
    </>
  );
}
