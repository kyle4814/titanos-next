import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import WelcomeForm from "@/components/WelcomeForm";
import { ALL_OFFERS, getOffer } from "@/lib/offers";

export const dynamicParams = false;

export function generateStaticParams() {
  const ready = ALL_OFFERS.filter((o) => o.status === "READY");
  if (ready.length === 0) return [{ slug: "_none" }];
  return ready.map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = getOffer(slug);
  return { title: o ? `Welcome: ${o.name} | TITANOS` : "Welcome | TITANOS", robots: { index: false, follow: false } };
}

export default async function WelcomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = getOffer(slug);
  if (!o || o.status !== "READY") notFound();
  return (
    <>
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
            <Link href="/privacy" style={{ color: "var(--gold)" }}>privacy policy</Link>.
          </p>
        </div>
      </SectionReveal>
      <SectionReveal style={{ padding: "var(--space-8) 20px var(--space-20)", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto", color: "var(--text)", lineHeight: 1.75 }}>
          <h3 style={{ color: "var(--ice)" }}>What happens next</h3>
          <ol style={{ paddingLeft: 22 }}>
            <li>You send the details. Public records only; nothing on your systems is touched.</li>
            <li>Kyle reviews and confirms within one business day.</li>
            <li>You get a plain-English note on what happens first and when. Your IT provider stays in the loop if you want.</li>
          </ol>
          <p>Questions first? Email kyle@titanos.tech. No GST is charged.</p>
        </div>
      </SectionReveal>
    </>
  );
}
