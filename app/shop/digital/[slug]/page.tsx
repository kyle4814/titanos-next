import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import { Bento } from "@/components/offers/Bento";
import FaqItem from "@/components/FaqItem";
import DigitalBuyButton from "@/components/DigitalBuyButton";
import { DIGITAL_SHELVES, getDigital } from "@/lib/shop/digital";
import { formatAUD } from "@/lib/pricing";

export const dynamicParams = false;

export function generateStaticParams() {
  return DIGITAL_SHELVES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getDigital(slug);
  if (!p) return {};
  const url = `https://titanos.tech/shop/digital/${p.slug}`;
  return withSeo(`/shop/digital/${p.slug}`, {
    title: `${p.name} | TITANOS`,
    description: p.bluf,
    alternates: { canonical: url },
    openGraph: { title: p.name, description: p.bluf, type: "website", url },
    robots: { index: true, follow: true },
  });
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

export default async function DigitalProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getDigital(slug);
  if (!p) notFound();
  const f = p.digital;
  return (
    <>
      <PageHero
        badge="TITANOS · DIGITAL PRODUCT"
        title={p.name}
        tagline={p.bluf}
        sub={`${formatAUD(p.priceAud ?? 0)} one-off. No GST is charged. Instant download by email after payment.`}
      >
        <DigitalBuyButton slug={p.slug} name={p.name} />
      </PageHero>

      <Block title="What it is"><p style={{ color: "var(--text)", lineHeight: 1.75, margin: 0 }}>{f.description}</p></Block>
      <div className="divider-gold" />
      {f.whatsIncluded.length > 0 && (<><Block title="What you get"><Bento items={f.whatsIncluded} mark="✓" tone="ok" /></Block><div className="divider-gold" /></>)}
      {f.requirements.length > 0 && (<><Block title="What you need"><Bento items={f.requirements} mark="•" tone="plain" /></Block><div className="divider-gold" /></>)}

      <Block title="Delivery">
        <p style={{ color: "var(--text)", lineHeight: 1.75, margin: 0 }}>
          After payment a private download link for <strong>{f.filename}</strong> ({f.fileSize}) is emailed to the address you pay with. The link works for 7 days and for up to 5 downloads, so save the file once you have it.
          If a payment is refunded or disputed the link stops working.
        </p>
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-xs)", margin: "12px 0 0", overflowWrap: "anywhere" }}>File checksum (SHA-256): {f.sha256}</p>
      </Block>
      <div className="divider-gold" />

      <Block title="Straight answers">
        {p.faq.map((q) => <FaqItem key={q.q} question={q.q}>{q.a}</FaqItem>)}
        {f.disclaimers.length > 0 && (
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 14, lineHeight: 1.6 }}>{f.disclaimers.join(" ")}</p>
        )}
      </Block>

      <SectionReveal style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto 22px", lineHeight: 1.7 }}>
          If it fits what you are doing, would it be okay to go ahead? A no is welcome too. Terms: <Link href="/terms" style={{ color: "var(--gold)" }}>/terms</Link>. More on the <Link href="/shop" style={{ color: "var(--gold)" }}>shop</Link>.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}><DigitalBuyButton slug={p.slug} name={p.name} /></div>
      </SectionReveal>
    </>
  );
}
