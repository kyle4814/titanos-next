import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SITE } from "@/lib/seo";
import { article, faqPage, breadcrumbs } from "@/lib/jsonld";
import { TRADE_PROBLEMS, pagePath, computeExample, type TradeProblem } from "@/lib/tradeProblems";

// /shop/digital/* (build/digital-products-pipeline) and /d/* (build/prospect-demos) are not in the 2026-11-28 release.
// Flip to true once both lanes are merged, and flip LINK_UNMERGED_LANES in scripts/test_trade_problems.mjs with it.
const LINK_UNMERGED_LANES = false;

const AUTHOR = { "@type": "Person", name: "Kyle Deligny", url: `${SITE}/about` };

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function TradeProblemView({ p }: { p: TradeProblem }) {
  const path = pagePath(p);
  const ex = computeExample(p.example);
  const siblings = TRADE_PROBLEMS.filter((s) => s !== p).slice(0, 3);
  const ld = {
    ...article({ path, headline: p.h1, description: p.description, datePublished: p.published, dateModified: p.reviewed }),
    author: AUTHOR,
  };
  return (
    <main className="tp">
      <JsonLd data={ld} />
      <JsonLd data={faqPage(p.faq)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Automation guides for trades", path: "/automation" }, { name: `${p.tradeLabel}: ${p.problemLabel.toLowerCase()}`, path }])} />
      <div className="tp-wrap">
        <nav className="tp-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/automation">Automation guides for trades</Link> / <span aria-current="page">{p.tradeLabel}: {p.problemLabel.toLowerCase()}</span>
        </nav>
        <header>
          <p className="tp-eyebrow">{p.eyebrow}</p>
          <h1>{p.h1}</h1>
          <p className="tp-lede">{p.lede}</p>
          <p className="tp-by">By <Link href="/about">Kyle Deligny</Link>, Titanos, Brisbane. Last reviewed {longDate(p.reviewed)}. General information, not legal advice.</p>
        </header>

        <section className="tp-sec">
          <h2>Why this is different for {p.tradeLabel.toLowerCase()}</h2>
          {p.why.map((t) => <p key={t}>{t}</p>)}
        </section>

        <section className="tp-sec">
          <h2>{p.scenariosHeading}</h2>
          <ol>{p.scenarios.map((s) => <li key={s.t}><strong>{s.t}.</strong> {s.b}</li>)}</ol>
        </section>

        <section className="tp-sec">
          <h2>{p.messagesHeading}</h2>
          <p>{p.messagesIntro}</p>
          {p.messages.map((m) => (
            <div className="tp-msg" key={m.label}>
              <div className="tp-msg__head"><strong>{m.label}</strong><span>{m.when}</span></div>
              <span className="tp-msg__tag">{m.source === "kit" ? `From the ${p.kit.name}, word for word` : "Written for this page"}</span>
              <blockquote>{m.text}</blockquote>
            </div>
          ))}
          <ul>{p.messageNotes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>

        <section className="tp-sec">
          <h2>{p.exampleHeading}</h2>
          <p>{p.exampleIntro}</p>
          <div className="tp-ex">
            <span className="tp-ex__flag">Example numbers, not data</span>
            <dl>{ex.lines.map((l) => <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>)}</dl>
            <p className="tp-big">{ex.headline}<small>{ex.headlineLabel}</small></p>
            <p className="tp-small">{ex.note}</p>
          </div>
          {p.example.kind === "missed-calls" && (
            <p>To run this with your own figures, use the <Link href="/tools/missed-call-calculator">free missed call calculator</Link>. It multiplies your own call count, share missed, job value and close rate, in your browser, and saves nothing.</p>
          )}
        </section>

        <section className="tp-sec">
          <h2>{p.stepsHeading}</h2>
          <ol>{p.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>

        <section className="tp-sec">
          <h2>{p.consentHeading}</h2>
          {p.consent.map((t) => <p key={t}>{t}</p>)}
          <p>Primary sources: {p.sources.map((s, i) => <span key={s.href}>{i > 0 ? "; " : ""}<a href={s.href} rel="noopener">{s.label}</a></span>)}.</p>
        </section>

        <section className="tp-sec">
          <h2>Questions {p.tradeLabel.toLowerCase()} ask</h2>
          {p.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
        </section>

        <section className="tp-sec">
          <h2>The ready-made kit and where to go next</h2>
          <p>{p.kit.fit}</p>
          <div className="tp-links">
            {LINK_UNMERGED_LANES && <Link href={`/shop/digital/${p.kit.slug}`}>{p.kit.name}<small>The matching kit in the shop</small></Link>}
            <Link href="/tools/missed-call-calculator">Missed call calculator<small>Free, runs in your browser</small></Link>
            {LINK_UNMERGED_LANES && p.demo && <a href={p.demo.href}>{p.demo.label}<small>A demonstration with made-up details</small></a>}
            <Link href="/automation">All trade guides<small>Hub for this series</small></Link>
            {siblings.map((s) => (
              <Link key={pagePath(s)} href={pagePath(s)}>{s.tradeLabel}: {s.problemLabel.toLowerCase()}<small>{s.title}</small></Link>
            ))}
          </div>
        </section>

        <section className="tp-cta">
          <h2>Want this set up for your trade?</h2>
          <p>Book a free 15 minute call and we will look at how your calls, quotes and invoices flow today. Nobody is replaced, your own systems stay in your hands, and there is no obligation.</p>
          <div>
            <Link className="pe-btn pe-btn--gold pe-btn--lg" href="/book">Book a free call</Link>
            <Link className="pe-btn pe-btn--dark pe-btn--lg" href="/tradies">See what we do for trades</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
