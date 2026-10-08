import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { CardGrid, Block, NextStep } from "@/components/SiteBlocks";
import { SECTORS } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Sectors · TITANOS",
  description: "Ten sectors, one method: read public records, grade what a stranger can see, hand back a plain list of changes.",
  alternates: { canonical: "https://titanos.tech/sectors" },
  robots: { index: true, follow: true },
};

export default function SectorsPage() {
  return (
    <>
      <PageHero badge="SECTORS" title="Ten sectors, one method" tagline="We read public records about your business and tell you what a stranger could see." />
      <Block point="Every sector page shows one number with its label, or says plainly that we have none yet.">
        Where a number is not measured, we write UNKNOWN and say what would measure it.
      </Block>
      <CardGrid items={SECTORS.map((s) => ({ href: `/sectors/${s.slug}`, title: s.name, text: s.point }))} />
      <NextStep text="Start with the free scan on your own domain." href="/scan" label="Run the free scan" />
    </>
  );
}
