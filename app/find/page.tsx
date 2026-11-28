import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import OfferFinder from "@/components/OfferFinderLazy";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import W2d from "@/components/w2d/W2d";

const TITLE = "Find the right TITANOS offer in 30 seconds";
const DESC =
  "Answer three quick questions and get the offers that fit you, with a link to each page. It runs on your device, nothing is sent anywhere, and a no is always fine.";

const baseMetadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://titanos.tech/find" },
  openGraph: { title: TITLE, description: DESC, type: "website", url: "https://titanos.tech/find" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/find", baseMetadata);

export default function FindPage() {
  return (
    <W2d>
      <PageHero
        badge="TITANOS · OFFER FINDER"
        title="Find the right offer."
        tagline="Three questions, about 30 seconds. Would it be okay if we pointed you to the right door?"
        sub="Nothing you tap or type leaves your device. Most offers start with a free step, and your IT provider stays."
      />
      <SectionReveal className="pe-section">
        <div className="pe-page pe-page--narrow">
          <FlexNumber f={FLEX.market} />
          <p className="pe-muted" style={{ lineHeight: 1.7, marginTop: 14 }}>
            Method: ABS count, June 2026. If you are one of them, the three questions below point you to the offers that fit. Nothing you
            tap leaves your device, nothing of yours is touched, nobody is replaced, and your IT provider stays in charge.
          </p>
        </div>
      </SectionReveal>
      <OpenLoop>Which of these offers is closest to the job eating your week?</OpenLoop>
      <SectionReveal className="pe-section">
        <div className="pe-page">
          <OfferFinder />
        </div>
      </SectionReveal>
    </W2d>
  );
}
