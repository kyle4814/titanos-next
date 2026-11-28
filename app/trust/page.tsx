import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import "../proof/proof-page.css";
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
      <div className="pe-trustpage">
        <div className="pe-page pe-page--narrow pe-trust__list">
          {sections.map((s) => (
            <section key={s.id} className="pe-card pe-card--pad pe-trust__card" aria-labelledby={`${s.anchor}-h`}>
              <span id={s.anchor} className="pe-trust__anchor" aria-hidden="true" />
              <h2 id={`${s.anchor}-h`}>{s.heading}</h2>
              <p data-trust={s.id}>{s.body}</p>
              {s.links && (
                <p className="pe-trust__links">
                  {s.links.map(([href, text]) => (
                    <a key={href} href={href}>{text}</a>
                  ))}
                </p>
              )}
              <p className="pe-trust__rec">Record: {s.source}</p>
            </section>
          ))}
          <section className="pe-card pe-card--pad pe-trust__card pe-card--gold">
            <h2>Where this page comes from</h2>
            <p data-provenance="/trust">{trust.system}, read {longDate(trust.asOf)}. Each section names the file it rests on.</p>
          </section>
        </div>
      </div>
    </>
  );
}
