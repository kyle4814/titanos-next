import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { withSeo, SITE } from "@/lib/seo";
import { breadcrumbs } from "@/lib/jsonld";
import { INDUSTRY_PAGES, pagePath } from "@/lib/industryPages";
import "@/components/home-redesign/home-redesign.css";
import "../automation/automation.css";

const PATH = "/industries";
const TITLE = "Email Security by Industry for Australian SMEs | TITANOS";
const DESC = "Email security, DMARC, spoofing and privacy guidance for accountants, law firms, real estate, clinics, plumbers, electricians, builders and cleaners.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
  robots: { index: true, follow: true },
});

export default function Page() {
  return (
    <main className="tp">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Industries", path: PATH }])} />
      <div className="tp-wrap">
        <nav className="tp-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span aria-current="page">Industries</span></nav>
        <header>
          <p className="tp-eyebrow">Guides by industry</p>
          <h1>Email security and privacy by industry</h1>
          <p className="tp-lede">Each page covers one kind of Australian business: the risks particular to it, what its public email records can show, where the Privacy Act does or does not apply and where simple automation helps. Every claim names its source, and the free scan reads only public records. For shorter sector summaries see <Link href="/sectors">sectors</Link>, and for trade guides see <Link href="/tradies">trades</Link>.</p>
          <p className="tp-by">By <Link href="/about">Kyle Deligny</Link>, Titanos, Brisbane. Last reviewed 29 November 2026.</p>
        </header>
        <div className="tp-hub">
          {INDUSTRY_PAGES.map((p) => (
            <Link key={p.slug} href={pagePath(p)}>
              <span>{p.eyebrow}</span>
              <h2>{p.label}</h2>
              <p>{p.description}</p>
            </Link>
          ))}
        </div>
        <section className="tp-cta">
          <h2>Not sure where you fit?</h2>
          <p>Run the free scan on your domain and read the one page it returns. Would it be okay if we showed you? A no is welcome.</p>
          <div><Link className="pe-btn pe-btn--gold pe-btn--lg" href="/scan">Start the free scan</Link></div>
        </section>
      </div>
    </main>
  );
}
