import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Block } from "@/components/SiteBlocks";
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
      <Block point="How it works today">
        <p>
          You make a warm introduction. If a deal closes and the money is collected, you earn commission on that collected revenue. Nothing is paid on a quote or a maybe. The full terms, the questions people ask first and the application are on the{" "}
          <a href="/refer" style={{ color: "var(--gold)" }}>referral page</a>.
        </p>
      </Block>
      <span id="revenue-share" aria-hidden="true" />
      <Block point="Revenue share">
        <p data-partners="revenue-share">
          Revenue share means a percentage of what a business you introduced keeps paying, for as long as it stays. Today the live arrangement is the commission-only referral above. A recurring revenue share and a tiered rate are designed but not switched on, so we are not publishing a percentage: a rate with nothing behind it would only be a guess. When the engine is live and tested, the rates appear here with their source.
        </p>
      </Block>
      <Block point="White-label for agencies">
        <p>
          Running the owner portal under your own brand is planned for a later release, after the first portal is proven. There is nothing to sign up for yet.
        </p>
      </Block>
      <Block point="Before you ask">
        <p>
          Kyle Deligny, sole trader, Brisbane, ABN 34 318 502 254. Public records only, nothing touched, your IT provider stays in charge. More on the <a href="/trust" style={{ color: "var(--gold)" }}>trust page</a>.
        </p>
        <p data-provenance="/partners" style={{ color: "var(--dim)", fontSize: "var(--fs-sm)" }}>Read {longDate(AS_OF)}. Source: app/refer/page.tsx.</p>
      </Block>
    </>
  );
}
