import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Block } from "@/components/SiteBlocks";
import trust from "@/lib/site-data/trust.json";
import { longDate } from "@/lib/provenance";

const META_TITLE = "Trust: what we scan, what we never do, refunds | TITANOS";
const META_DESC = "Plain answers before you ask: public records only, nothing touched, nobody replaced, how AI is used, refunds, who is behind it.";

export const metadata: Metadata = withSeo("/trust", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/trust" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/trust" },
  robots: { index: true, follow: true },
});

type Section = { id: string; anchor: string; heading: string; body: string; links?: string[][]; source: string };

// Anchors on this page: #what-we-scan (passive, public records only), #security, #privacy, #ai-disclosure,
// #status. Each id comes from lib/site-data/trust.json, so the site map table and the page cannot drift apart.
export default function Trust() {
  const sections = trust.sections as Section[];
  return (
    <>
      <PageHero badge="TRUST" title="The answers, before you have to ask." tagline="What we scan, what we never do, how AI is used, and what happens if you change your mind." />
      {sections.map((s) => (
        <Block key={s.id} point={s.heading}>
          <span id={s.anchor} aria-hidden="true" />
          <p data-trust={s.id}>{s.body}</p>
          {s.links && (
            <p>
              {s.links.map(([href, text]) => (
                <a key={href} href={href} className="tap-pad" style={{ color: "var(--gold)", marginRight: 16 }}>{text}</a>
              ))}
            </p>
          )}
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}>Record: {s.source}</p>
        </Block>
      ))}
      <Block point="Where this page comes from">
        <p data-provenance="/trust">{trust.system}, read {longDate(trust.asOf)}. Each section names the file it rests on.</p>
      </Block>
    </>
  );
}
