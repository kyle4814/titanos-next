import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block, NumberBlock, NextStep } from "@/components/SiteBlocks";
import stats from "@/lib/stats.json";

export const metadata: Metadata = {
  title: "How it works · TITANOS",
  description: "Three steps: we read public records, grade what a stranger can see, and hand back a plain list of changes.",
  alternates: { canonical: "https://titanos.tech/how-it-works" },
  robots: { index: true, follow: true },
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHero badge="HOW IT WORKS" title="We read what a stranger can see, then tell you what to change" tagline="Three steps, none of them touch your systems." />
      <NumberBlock
        fact={{
          value: `${stats.organisationsResearched} organisations`,
          label: "MEASURED",
          note: `Researched so far from public records, counted on ${stats.asOf}. A count of work done, not a promise about your results.`,
          source: "lib/stats.json",
        }}
      />
      <Block point="Step one: we read public records about your business.">
        The same records a customer, a supplier or a stranger can reach: your domain, your public website, official registers.
      </Block>
      <Block point="Step two: we grade what we found.">
        You get a plain reading, in order of effort, with the evidence beside each line.
      </Block>
      <Block point="Step three: we hand back a short list of changes.">
        Your IT provider stays in charge, nobody is replaced, and you decide what happens next.
      </Block>
      <NextStep text="See step one on your own domain, free." href="/scan" label="Run the free scan" />
    </>
  );
}
