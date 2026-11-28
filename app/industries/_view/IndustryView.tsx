import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SITE } from "@/lib/seo";
import { article, faqPage, breadcrumbs } from "@/lib/jsonld";
import { INDUSTRY_PAGES, pagePath, type IndustryPage } from "@/lib/industryPages";

const AUTHOR = { "@type": "Person", name: "Kyle Deligny", url: `${SITE}/about` };

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function IndustryView({ p }: { p: IndustryPage }) {
  const path = pagePath(p);
  const siblings = INDUSTRY_PAGES.filter((s) => s !== p).slice(0, 3);
  const ld = { ...article({ path, headline: p.h1, description: p.description, datePublished: p.published, dateModified: p.reviewed }), author: AUTHOR };
  return (
    <main className="tp">
      <JsonLd data={ld} />
      <JsonLd data={faqPage(p.faq)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Industries", path: "/industries" }, { name: p.label, path }])} />
      <div className="tp-wrap">
        <nav className="tp-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/industries">Industries</Link> / <span aria-current="page">{p.label}</span>
        </nav>
        <header>
          <p className="tp-eyebrow">{p.eyebrow}</p>
          <h1>{p.h1}</h1>
          <p className="tp-lede">{p.lede}</p>
          <p className="tp-by">By <Link href="/about">Kyle Deligny</Link>, Titanos, Brisbane. Last reviewed {longDate(p.reviewed)}. General information, not legal advice.</p>
        </header>

        <section className="tp-sec">
          <h2>Why this is different for {p.label.toLowerCase()}</h2>
          {p.why.map((t) => <p key={t}>{t}</p>)}
        </section>

        <section className="tp-sec">
          <h2>{p.risksHeading}</h2>
          <ol>{p.risks.map((r) => <li key={r.t}><strong>{r.t}.</strong> {r.b}</li>)}</ol>
        </section>

        <section className="tp-sec">
          <h2>{p.domainHeading}</h2>
          <p>{p.domainIntro}</p>
          <ul>{p.domainChecks.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>

        <section className="tp-sec">
          <h2>{p.privacyHeading}</h2>
          {p.privacy.map((t) => <p key={t}>{t}</p>)}
        </section>

        <section className="tp-sec">
          <h2>{p.automationHeading}</h2>
          {p.automation.map((t) => <p key={t}>{t}</p>)}
          <p>Primary sources: {p.sources.map((s, i) => <span key={s.label}>{i > 0 ? "; " : ""}{s.href ? <a href={s.href} rel="noopener">{s.label}</a> : s.label}</span>)}.</p>
        </section>

        <section className="tp-sec">
          <h2>Questions {p.label.toLowerCase()} ask</h2>
          {p.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>

        <section className="tp-sec">
          <h2>Free tools and where to go next</h2>
          <div className="tp-links">
            {p.links.map((l) => <Link key={l.href} href={l.href}>{l.label}<small>{l.note}</small></Link>)}
            <Link href="/industries">All industries<small>Hub for this series</small></Link>
            {siblings.map((s) => <Link key={s.slug} href={pagePath(s)}>{s.label}<small>{s.title}</small></Link>)}
          </div>
        </section>

        <section className="tp-cta">
          <h2>See what your domain shows, free</h2>
          <p>The free scan reads only public records about your domain, the way a customer or a supplier would. Nothing is touched, nobody is replaced and your IT provider stays in charge. Would it be okay if we showed you what it finds? A no is welcome.</p>
          <div>
            <Link className="pe-btn pe-btn--gold pe-btn--lg" href="/scan">Start the free scan</Link>
            <Link className="pe-btn pe-btn--dark pe-btn--lg" href="/book">Book a free call</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
