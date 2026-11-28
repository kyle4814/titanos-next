import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { breadcrumbs, organization } from "@/lib/jsonld";
import { GUIDES, guideWordCount } from "@/lib/guides";
import "@/components/home-redesign/home-redesign.css";
import "@/components/guides/guides.css";

const TITLE = "Guides for Australian Small Business | Titanos";
const DESC =
  "Six plain-English guides for Australian small business: tradie automation, AI receptionists, the Privacy Act, Essential Eight, email security and tenders.";

export const metadata: Metadata = withSeo("/guides", {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}/guides` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}/guides` },
  robots: { index: true, follow: true },
});

export default function GuidesHub() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Guides for Australian small business",
    url: `${SITE}/guides`,
    inLanguage: "en-AU",
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/guides/${g.slug}`, name: g.h1 })),
    },
  };
  return (
    <div className="gd-page" lang="en-AU">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])} />
      <JsonLd data={itemList} />
      <JsonLd data={organization()} />
      <div className="gd-wrap">
        <nav className="gd-crumbs" aria-label="Breadcrumb">
          <ol><li><Link href="/">Home</Link></li><li aria-current="page">Guides</li></ol>
        </nav>
        <header className="gd-hero">
          <p className="gd-kicker">Guides</p>
          <h1>Guides for Australian <em>small business</em></h1>
          <p className="gd-lede">
            Six long guides on the jobs that eat a small business owner&apos;s week or put it at risk: missed calls and quotes, AI phone answering, privacy law, cyber security, email scams and government work. Each one names its sources, says what is uncertain and links to the free tool or product that fits.
          </p>
          <p className="gd-by">Written by <strong>Kyle Deligny</strong>, Brisbane. General information, not legal advice. See <Link href="/about">about</Link> and <Link href="/methodology">how figures are sourced</Link>.</p>
        </header>
        <ul className="gd-hub">
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="gd-hubcard">
                <p className="gd-kicker">{g.cluster}</p>
                <h2>{g.h1}</h2>
                <p>{g.description}</p>
                <span className="gd-more">Read the guide, about {Math.round(guideWordCount(g) / 230)} minutes &rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="gd-hubnote">
          Looking for shorter reads? The <Link href="/blog">blog</Link> carries one-question posts that these guides link down to. Want a free check of your email domain first? Run the <Link href="/scan">free security scan</Link>.
        </p>
      </div>
    </div>
  );
}
