import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block, NumberBlock, NextStep } from "@/components/SiteBlocks";
import stats from "@/lib/stats.json";

export const metadata: Metadata = {
  title: "Security and privacy · TITANOS",
  description: "Public records only, nothing touched, nobody replaced. How we handle your data and what we never do.",
  alternates: { canonical: "https://titanos.tech/security" },
  robots: { index: true, follow: true },
};

export default function SecurityPage() {
  return (
    <>
      <PageHero badge="SECURITY AND PRIVACY" title="We only read what is already public" tagline="Nothing touched, nobody replaced, your IT stays in charge." />
      <NumberBlock
        fact={{
          value: `${stats.scansLast30Days} scans`,
          label: "MEASURED",
          note: `Free scans run in the 30 days to ${stats.asOf}, each from public records only.`,
          source: "lib/stats.json",
        }}
      />
      <Block point="We never ask for a password or a login to give you a first reading." />
      <Block point="We never scan or probe a system that has not agreed to it.">
        The first reading uses public DNS and public pages only.
      </Block>
      <Block point="Your private details stay private.">
        Read the full data handling terms on <a href="/privacy">the privacy page</a> and <a href="/your-data">your data</a>.
      </Block>
      <NextStep text="Ask us anything about how we handle data before you start." href="/contact" label="Ask a question" />
    </>
  );
}
