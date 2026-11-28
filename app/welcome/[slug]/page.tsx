import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import WelcomeForm from "@/components/WelcomeForm";
import { ALL_OFFERS, getOffer } from "@/lib/offers";
import W2d from "@/components/w2d/W2d";
import { getProduct } from "@/lib/products";
import downloads from "@/lib/products/downloads.json";

type Dl = { dir: string; files: { name: string; label: string; bytes: number }[] };
const DL = downloads as Record<string, Dl>;
const sizeLabel = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export const dynamicParams = false;

export function generateStaticParams() {
  const ready = ALL_OFFERS.filter((o) => o.status === "READY").map((o) => ({ slug: o.slug }));
  const products = Object.keys(DL).filter((s) => getProduct(s)).map((slug) => ({ slug }));
  const all = [...ready, ...products.filter((p) => !ready.some((r) => r.slug === p.slug))];
  if (all.length === 0) return [{ slug: "_none" }];
  return all;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = getOffer(slug);
  const prod = getProduct(slug);
  if (prod && DL[slug]) return { title: `Your download: ${prod.name} | TITANOS`, robots: { index: false, follow: false } };
  return { title: o ? `Welcome: ${o.name} | TITANOS` : "Welcome | TITANOS", robots: { index: false, follow: false } };
}

export default async function WelcomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const prod = getProduct(slug);
  const dl = prod ? DL[slug] : undefined;
  if (prod && dl) {
    return (
      <W2d>
        <PageHero
          badge="TITANOS · YOUR DOWNLOAD"
          title="Thank you. Your files are ready."
          tagline={prod.name}
          sub="Save the files now. This page is for you, so please do not share the links."
        />
        <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
          <div className="container-vault pe-card pe-card--pad" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", color: "var(--text)", lineHeight: 1.75 }}>
            <h3 style={{ marginTop: 0 }}>Download</h3>
            <ul style={{ paddingLeft: 22 }}>
              {dl.files.map((f) => (
                <li key={f.name}>
                  <a href={`/dl/${dl.dir}/${f.name}`} download style={{ color: "var(--pe-gold-hi)" }}>{f.label}</a>
                  {" "}<span style={{ color: "var(--dim)" }}>({f.name}, {sizeLabel(f.bytes)})</span>
                </li>
              ))}
            </ul>
            <p>{prod.delivery.note}</p>
            <p>Something not opening, or not what the page promised? Email kyle@titanos.tech and we will sort it out in plain terms. No GST is charged. See our <Link href="/terms" style={{ color: "var(--pe-gold-hi)" }}>terms</Link>.</p>
          </div>
        </SectionReveal>
      </W2d>
    );
  }
  const o = getOffer(slug);
  if (!o || o.status !== "READY") notFound();
  return (
    <W2d>
      <PageHero
        badge="TITANOS · WELCOME"
        title="Welcome. Tell us about your business."
        tagline="Once you send this, Kyle confirms the setup within one business day."
        sub={`Service: ${o.name}.`}
      />
      <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading title="Tell us about your business" lead="It opens an email to Kyle with your answers. Nothing is stored on this site." />
          <WelcomeForm offerName={o.name} />
          <p style={{ maxWidth: "var(--maxw-prose)", margin: "18px auto 0", color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.6 }}>
            We use these details only to set up this service. They arrive in Kyle&apos;s email inbox; this site stores nothing. See our{" "}
            <Link href="/privacy" style={{ color: "var(--pe-gold-hi)" }}>privacy policy</Link>.
          </p>
        </div>
      </SectionReveal>
      <SectionReveal style={{ padding: "var(--space-8) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <div className="container-vault pe-card pe-card--pad" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", color: "var(--text)", lineHeight: 1.75 }}>
          <h3 style={{ marginTop: 0 }}>What happens next</h3>
          <ol style={{ paddingLeft: 22 }}>
            <li>You send the details. Public records only; nothing on your systems is touched.</li>
            <li>Kyle reviews and confirms within one business day.</li>
            <li>You get a plain-English note on what happens first and when. Your IT provider stays in the loop if you want.</li>
          </ol>
          <p>Questions first? Email kyle@titanos.tech. No GST is charged.</p>
        </div>
      </SectionReveal>
    </W2d>
  );
}
