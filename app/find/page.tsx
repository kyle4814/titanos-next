import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import OfferFinder from "@/components/OfferFinder";

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
    <>
      <PageHero
        badge="TITANOS · OFFER FINDER"
        title="Find the right offer."
        tagline="Three questions, about 30 seconds."
        sub="Nothing you tap or type leaves your device. Most offers start with a free step, and your IT provider stays."
      />
      <SectionReveal style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <OfferFinder />
        </div>
      </SectionReveal>
    </>
  );
}
