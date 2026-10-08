import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block, NextStep } from "@/components/SiteBlocks";
import { CREDITS } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Credits · TITANOS",
  description: "Every third party image used on titanos.tech, with its creator and licence.",
  alternates: { canonical: "https://titanos.tech/credits" },
  robots: { index: true, follow: true },
};

export default function CreditsPage() {
  return (
    <>
      <PageHero badge="CREDITS" title="Every image is listed with its creator and licence" tagline="Only public domain and credited open licences, nothing else." />
      {CREDITS.length === 0 ? (
        <Block point="No third party images are in use yet.">
          When deep space imagery is added, each file will be listed here with its creator, licence and source link.
        </Block>
      ) : (
        <Block point={`${CREDITS.length} images, each with its licence`}>
          <ul style={{ paddingLeft: 18 }}>
            {CREDITS.map((c) => (
              <li key={c.file}>
                {c.title}, {c.creator}, {c.licence}. <a href={c.sourceUrl} rel="noopener noreferrer">Source</a>
              </li>
            ))}
          </ul>
        </Block>
      )}
      <NextStep text="Questions about a licence? Ask us." href="/contact" label="Get in touch" />
    </>
  );
}
