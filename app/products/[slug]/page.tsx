import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import FaqItem from "@/components/FaqItem";
import { PRODUCTS, getProduct, formatProductPrice, productBuyHref } from "@/lib/products";
import type { Product } from "@/lib/products/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) return {};
  const url = `https://titanos.tech/products/${p.slug}`;
  return withSeo(`/products/${p.slug}`, {
    title: `${p.name} (digital product) | TITANOS`,
    description: p.bluf,
    alternates: { canonical: url },
    openGraph: { title: p.name, description: p.bluf, type: "website", url },
    robots: { index: true, follow: true },
  });
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

function Cta({ p }: { p: Product }) {
  const href = productBuyHref(p);
  if (href) return <AnimatedButton href={href}>BUY NOW →</AnimatedButton>;
  const interest = `mailto:kyle@titanos.tech?subject=${encodeURIComponent(`Interest: ${p.name}`)}`;
  return (
    <>
      <AnimatedButton href={interest} external>TELL ME WHEN IT OPENS →</AnimatedButton>
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 10 }}>
        Checkout is opening soon. Registering is free and commits you to nothing.
      </p>
    </>
  );
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();
  const live = productBuyHref(p) !== null;
  const privacyRelated = /privacy|breach/i.test([p.name, p.bluf].join(" "));
  return (
    <>
      <PageHero
        badge={`TITANOS · ${live ? "AVAILABLE NOW" : "OPENING SOON"}`}
        title={p.name}
        tagline={p.bluf}
        sub={`${formatProductPrice(p)}. No GST is charged. Delivered as ${p.delivery.file}.`}
      >
        <Cta p={p} />
      </PageHero>

      <Block title="Who it's for"><List items={p.forWho} mark="•" /></Block>
      <div className="divider-gold" />
      <Block title="What you get"><List items={p.youGet} mark="✓" /></Block>
      <div className="divider-gold" />

      {p.outline && (
        <>
          <Block title="Course outline">
            {p.outline.map((m) => (
              <div key={m.title} style={{ marginBottom: 20 }}>
                <h3 style={{ color: "var(--gold)", margin: "0 0 8px" }}>{m.title}</h3>
                <ol style={{ color: "var(--text)", lineHeight: 1.7, paddingLeft: 22, margin: 0 }}>
                  {m.lessons.map((l) => <li key={l.title}><strong>{l.title}.</strong> {l.outcome}</li>)}
                </ol>
              </div>
            ))}
          </Block>
          <div className="divider-gold" />
        </>
      )}
      {p.bundle && (
        <>
          <Block title="What is in the download bundle"><List items={p.bundle} mark="✓" /></Block>
          <div className="divider-gold" />
        </>
      )}

      <Block title="Delivery">
        <p style={{ color: "var(--text)", lineHeight: 1.75, margin: 0 }}>
          You receive <strong>{p.delivery.file}</strong> ({p.delivery.format}) after payment. {p.delivery.note}
        </p>
      </Block>
      <div className="divider-gold" />
      <Block title="Price">
        <div style={{ background: "var(--card)", border: "1px solid var(--gold-dim)", borderRadius: "var(--radius-md)", padding: "26px 28px", textAlign: "center" }}>
          <div style={{ color: "var(--gold)", fontFamily: "var(--font-display), Georgia, serif", fontSize: "var(--fs-h2)", fontWeight: 700 }}>
            {formatProductPrice(p)}
          </div>
          <p style={{ color: "var(--text)", lineHeight: 1.7, margin: "14px 0 0" }}>
            No GST is charged. One payment, yours to keep. Full terms: <Link href="/terms" style={{ color: "var(--gold)" }}>/terms</Link>
          </p>
        </div>
      </Block>
      <div className="divider-gold" />
      <Block title="Straight answers">
        {p.faq.map((f) => <FaqItem key={f.q} question={f.q}>{f.a}</FaqItem>)}
        {privacyRelated && (
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 14 }}>General information, not legal advice.</p>
        )}
      </Block>

      <SectionReveal style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <p style={{ color: "var(--ice)", marginBottom: 18 }}>
          Want to start free? <Link href="/scan" style={{ color: "var(--gold)" }}>Run the free scan</Link> or see <Link href="/products" style={{ color: "var(--gold)" }}>all products</Link>.
        </p>
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto 22px", lineHeight: 1.7 }}>
          If you like what you have read and it fits, would it be okay to go ahead? A no is welcome too.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}><Cta p={p} /></div>
      </SectionReveal>
    </>
  );
}
