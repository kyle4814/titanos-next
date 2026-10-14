import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import Link from "next/link";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import OfferTile from "@/components/offers/OfferTile";
import { PRODUCTS, formatProductPrice, productBuyHref } from "@/lib/products";
import type { Product } from "@/lib/products/types";

const TITLE = "Digital Products and Courses | TITANOS";
const DESC =
  "Guides, checklists, templates and short courses built from the methods we use ourselves. Download, apply, and keep. Prices in AUD, no GST charged.";

export const metadata: Metadata = withSeo("/products", {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://titanos.tech/products" },
  openGraph: { title: TITLE, description: DESC, type: "website", url: "https://titanos.tech/products" },
  robots: { index: true, follow: true },
});

function Card({ p }: { p: Product }) {
  const live = productBuyHref(p) !== null;
  return (
    <OfferTile
      href={`/products/${p.slug}`}
      kicker={<>{p.kind} · {live ? "Available now" : "Opening soon"}</>}
      name={p.name}
      headingLevel="h3"
      body={p.bluf}
      price={<>{formatProductPrice(p)} · {p.delivery.file}</>}
      open={live}
      feature={live}
    />
  );
}

function Grid({ items }: { items: Product[] }) {
  return (
    <div className="ox-grid ox-grid--wide">
      {items.map((p) => <Card key={p.slug} p={p} />)}
    </div>
  );
}

export default function ProductsPage() {
  const courses = PRODUCTS.filter((p) => p.kind === "course");
  const others = PRODUCTS.filter((p) => p.kind !== "course");
  return (
    <>
      <PageHero
        badge="TITANOS · DIGITAL PRODUCTS"
        title="Digital products and courses"
        tagline="The methods we use on our own work, packaged so you can use them on yours."
        sub="Each product is a download you keep. Public information only, nothing replaced, no GST charged."
      />
      <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Courses" />
          <Grid items={courses} />
        </div>
      </SectionReveal>
      <div className="divider-gold" />
      <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Guides, checklists, templates and playbooks" />
          <Grid items={others} />
        </div>
      </SectionReveal>
      <SectionReveal style={{ textAlign: "center", padding: "var(--space-12) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <p style={{ color: "var(--ice)", maxWidth: "var(--maxw-prose)", margin: "0 auto 18px", lineHeight: 1.7 }}>
          Not sure where to start? <Link href="/scan" style={{ color: "var(--gold)" }}>Run the free scan</Link> or{" "}
          <Link href="/audit" style={{ color: "var(--gold)" }}>book a free audit call</Link>. Prices marked to be confirmed will be set before checkout opens.
        </p>
      </SectionReveal>
    </>
  );
}
