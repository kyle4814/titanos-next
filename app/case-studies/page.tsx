import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import { CASES } from "@/lib/caseStudies";
import { ARIANCE, arianceVisible, ariancePath } from "@/lib/case-studies/ariance";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import CaseCard from "@/components/cases/CaseCard";
import SpeedStrip from "@/components/cases/SpeedStrip";
import s from "@/components/cases/cases.module.css";

const META_TITLE = "Case studies | TITANOS";
const META_DESC =
  "A library of real builds: what was made, how fast, what it cost, and how it was tested. Counts come from the git log, screenshots from the working product.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/case-studies" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/case-studies" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/case-studies", baseMetadata);

const SECTION: CSSProperties = { padding: "var(--space-16) 20px", position: "relative", zIndex: 2 };

export default function CaseStudies() {
  return (
    <div>
      <PageHero
        badge="Case studies"
        title="The receipts library."
        sub="Each case study is a real build, with its speed, its cost and how it was tested. Names stay private."
      />
      <section style={{ ...SECTION, paddingBottom: 0 }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <FlexNumber f={FLEX.fleetJobs} />
          <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "14px 0 0", maxWidth: "54ch" }}>
            Method: counted from our own job log over 24 hours. Every case below is built the same way, from our own work, on public
            information. Nothing of anyone&apos;s is touched, nobody is replaced, and the client&apos;s IT stays in charge.
          </p>
        </div>
      </section>
      <OpenLoop>That is the volume. What does one finished build look like up close?</OpenLoop>
      <section style={{ ...SECTION, paddingBottom: 0 }}>
        <SpeedStrip cases={CASES} />
      </section>
      <section style={SECTION}>
        <div className={`${s.bento} ${s.wide}`}>
          {arianceVisible && (
            <CaseCard
              feature
              href={ariancePath}
              cover={ARIANCE.cover.src}
              coverAlt={ARIANCE.cover.alt}
              kicker="Hero case study"
              sector={ARIANCE.sector}
              title={ARIANCE.title}
              teaser={ARIANCE.teaser}
            />
          )}
          {CASES.map((c, i) => (
            <CaseCard
              key={c.slug}
              feature={!arianceVisible && i === 0}
              href={`/case-studies/${c.slug}`}
              cover={c.cover}
              coverAlt={c.coverAlt}
              sector={c.sector}
              title={c.title}
              teaser={c.teaser}
              big={c.facts[0]}
            />
          ))}
        </div>
        <p style={{ color: "var(--ice)", textAlign: "center", marginTop: 36, fontSize: "var(--fs-body)" }}>
          Would it be okay if we looked at a build like this for your business?{" "}
          <a href="/audit" style={{ color: "var(--gold)" }}>
            Book a free consultation
          </a>
          , and a no is welcome.
        </p>
      </section>
    </div>
  );
}
