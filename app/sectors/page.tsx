import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block, NextStep } from "@/components/SiteBlocks";
import SectionReveal from "@/components/SectionReveal";
import { GlowCard } from "@/components/house";
import s from "@/components/w2b/w2b.module.css";
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
      <SectionReveal>
        <ul className={s.sectors}>
          {SECTORS.map((x) => (
            <li key={x.slug}>
              <GlowCard as="a" href={`/sectors/${x.slug}`} className={s.sector}>
                <h3>{x.name}</h3>
                <p>{x.point}</p>
              </GlowCard>
            </li>
          ))}
        </ul>
      </SectionReveal>
      <NextStep text="Start with the free scan on your own domain." href="/scan" label="Run the free scan" />
    </>
  );
}
