import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { PointCard, PointGrid, PointItem, StatBlock, StepBlock } from "@/components/w2e/Blocks";
import stats from "@/lib/stats.json";
import { Block } from "@/components/SiteBlocks";
import disclosure from "@/lib/site-data/disclosure.json";
import { longDate } from "@/lib/provenance";

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
      <StatBlock
        fact={{
          value: `${stats.scansLast30Days} scans`,
          label: "MEASURED",
          note: `Free scans run in the 30 days to ${stats.asOf}, each from public records only.`,
          source: "lib/stats.json",
        }}
      />
      <PointGrid>
        <PointItem span={4}>
          <PointCard point="We never ask for a password or a login to give you a first reading." />
        </PointItem>
        <PointItem span={4}>
          <PointCard point="We never scan or probe a system that has not agreed to it.">
            The first reading uses public DNS and public pages only.
          </PointCard>
        </PointItem>
        <PointItem span={4}>
          <PointCard point="Your private details stay private.">
            Read the full data handling terms on <a href="/privacy">the privacy page</a> and <a href="/your-data">your data</a>.
          </PointCard>
        </PointItem>
      </PointGrid>
      {disclosure.sections.map((s) => (
        <Block key={s.id} point={s.heading}>
          <p data-disclosure={s.id}>{s.body}</p>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}>Record: {s.source}</p>
        </Block>
      ))}
      <Block point="Machine readable contact">
        <p data-disclosure="securitytxt">
          Contact: <a href={disclosure.securityTxt.contact} style={{ color: "var(--gold)" }}>{disclosure.securityTxt.contact.replace("mailto:", "")}</a>. The same details are published at <a href="/.well-known/security.txt" style={{ color: "var(--gold)" }}>/.well-known/security.txt</a>, which expires {longDate(disclosure.securityTxt.expires.slice(0, 10))}.
        </p>
        <p data-provenance="/security" style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}>{disclosure.system}, read {longDate(disclosure.asOf)}.</p>
      </Block>
      <StepBlock text="Ask us anything about how we handle data before you start." href="/contact" label="Ask a question" />
    </>
  );
}
