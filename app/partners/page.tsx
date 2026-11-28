import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import "./partners.css";
import { longDate } from "@/lib/provenance";

const META_TITLE = "Partners: introduce a business, get paid when it closes | TITANOS";
const META_DESC = "How partners work with TITANOS today: commission-only referrals on collected revenue, with revenue share and white-label still to come.";
const AS_OF = "2026-11-07";

export const metadata: Metadata = withSeo("/partners", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/partners" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/partners" },
  robots: { index: true, follow: true },
});

export default function Partners() {
  return (
    <>
      <PageHero badge="PARTNERS" title="Introduce a business. Get paid when it closes." tagline="Commission-only, no joining fee, no exclusivity. Nobody is replaced by what we build." />
      <div className="pe-page pe-page--narrow">
        <section className="pe-section">
          <p className="pe-eyebrow-line">The arrangement</p>
          <h2>How it works today</h2>
          <p className="pe-prose">
            You make a warm introduction. If a deal closes and the money is collected, you earn commission on that collected revenue. Nothing is paid on a quote or a maybe. The full terms, the questions people ask first and the application are on the{" "}
            <a href="/refer">referral page</a>.
          </p>
        </section>
        <span id="revenue-share" aria-hidden="true" />
        <section className="pe-section">
          <p className="pe-eyebrow-line">Later</p>
          <h2>Revenue share</h2>
          <p className="pe-prose" data-partners="revenue-share">
            Revenue share means a percentage of what a business you introduced keeps paying, for as long as it stays. Today the live arrangement is the commission-only referral above. A recurring revenue share and a tiered rate are designed but not switched on, so we are not publishing a percentage: a rate with nothing behind it would only be a guess. When the engine is live and tested, the rates appear here with their source.
          </p>
        </section>
        <section className="pe-section">
          <p className="pe-eyebrow-line">Planned</p>
          <h2>White-label for agencies</h2>
          <p className="pe-prose">
            Running the owner portal under your own brand is planned for a later release, after the first portal is proven. There is nothing to sign up for yet.
          </p>
        </section>
        <section className="pe-section">
          <p className="pe-eyebrow-line">Trust</p>
          <h2>Before you ask</h2>
          <div className="pe-card pe-card--pad">
            <p className="pe-prose" style={{ margin: 0 }}>
              Kyle Deligny, sole trader, Brisbane, ABN 34 318 502 254. Public records only, nothing touched, your IT provider stays in charge. More on the <a href="/trust">trust page</a>.
            </p>
            <p className="pe-muted" data-provenance="/partners" style={{ fontSize: 13, margin: "14px 0 0" }}>Read {longDate(AS_OF)}. Source: app/refer/page.tsx.</p>
          </div>
        </section>
      </div>
    </>
  );
}
