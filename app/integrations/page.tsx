import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article, breadcrumbs, faqPage } from "@/lib/jsonld";
import { ByLine, Crumbs, Disclaimer, Faq } from "@/components/integrations/GuideView";
import "@/components/home-redesign/home-redesign.css";
import "@/components/integrations/integrations.css";
import { AS_AT, COMPLIANCE_SOURCES, GUIDES, HUB, REVIEWED, TASK_LABEL, type TaskKey } from "@/lib/integrations";


export const metadata: Metadata = withSeo("/integrations", {
  title: HUB.metaTitle,
  description: HUB.metaDescription,
  alternates: { canonical: "https://titanos.tech/integrations" },
  robots: { index: true, follow: true },
});

const KEYS: TaskKey[] = ["missed-call", "quote-follow-up", "reviews", "invoices"];

export default function IntegrationsHub() {
  const trail = [
    { name: "Home", path: "/" },
    { name: "Integrations", path: "/integrations" },
  ];
  return (
    <main>
      <JsonLd data={article({ path: "/integrations", headline: HUB.h1, description: HUB.metaDescription, datePublished: REVIEWED, dateModified: REVIEWED })} />
      <JsonLd data={faqPage(HUB.faq)} />
      <JsonLd data={breadcrumbs(trail)} />
      <div className="ig-page">
        <div className="ig-wrap">
          <Crumbs trail={trail} />
          <h1>{HUB.h1}</h1>
          <ByLine />
          <p>
            A small trades business loses work in four quiet places: the call nobody answered, the quote nobody chased, the happy customer nobody asked for a review, and the invoice nobody reminded. The job software you already pay for may do some of these itself. The rest usually needs a connector such as Zapier or Make, or the vendor&apos;s API.
          </p>
          <p>
            These five guides sort that out for ServiceM8, Tradify, simPRO, Fergus and Jobber. For each job they show what the software does natively, what needs Zapier, Make or the API, and the exact steps, with a link to the vendor&apos;s own page for every claim. Each also carries a worked example whose numbers are labelled as examples.
          </p>
          <Disclaimer />

          <h2>The comparison, from the vendors&apos; own pages</h2>
          <div className="ig-table-wrap">
            <table className="ig-table">
              <thead>
                <tr>
                  <th scope="col">Software</th>
                  {KEYS.map((k) => <th key={k} scope="col">{TASK_LABEL[k]}</th>)}
                </tr>
              </thead>
              <tbody>
                {GUIDES.map((g) => (
                  <tr key={g.slug}>
                    <td><Link href={`/integrations/${g.slug}`}>{g.name}</Link></td>
                    {KEYS.map((k) => <td key={k}>{g.tasks.find((t) => t.key === k)?.status}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ig-meta" style={{ marginTop: 12 }}>
            Status describes what we found in each vendor&apos;s documentation as at {AS_AT}. &quot;Not found in the documentation&quot; means we did not find it, not that it does not exist.
          </p>

          <h2>Pick your software</h2>
          <div className="ig-grid">
            {GUIDES.map((g) => (
              <Link key={g.slug} href={`/integrations/${g.slug}`} className="pe-card ig-tile">
                <strong>{g.name}</strong>
                <span>{g.targetTerms[0]}: {g.fit.split(". ")[0]}.</span>
              </Link>
            ))}
          </div>

          <h2>Three patterns that repeat across all five</h2>
          <p>
            First, the follow-up jobs (quotes, invoices, reviews) are the ones vendors most often build in, because they depend only on data the software already holds. Second, missed-call text-back is almost never built into job software. It depends on your phone system, so the connector's job is to log the caller in your software, not to send the text. Third, anything running through Zapier or Make adds a second place where messages can fail, so test every automation on your own phone and number before real customers see it.
          </p>

          <h2>Rules that apply whichever software you use</h2>
          <ul className="ig-list">
            <li>Commercial texts are covered by the Spam Act 2003. Check consent, identification and the way to opt out.</li>
            <li>Customer phone numbers are personal information. Collect them for a stated purpose and keep them where your team already keeps customer data.</li>
            <li>One owner for each automation. If nobody checks the list each morning, an automated lead is only a faster way to lose it.</li>
          </ul>
          <ul className="ig-list">
            {COMPLIANCE_SOURCES.map((s) => (
              <li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>
            ))}
          </ul>

          <h2>Frequently asked questions</h2>
          <Faq items={HUB.faq} />

          <h2>Where to go next</h2>
          <p>
            If you want the message wording and a repeatable routine before you build anything, start with the <Link href="/products/quote-follow-up-playbook">Quote Follow-Up Playbook</Link> or the <Link href="/products/invoice-chasing-playbook">Invoice Chasing Playbook</Link>. For a hand-built plan across your whole job flow, see <Link href="/tradies">Job Flow for tradies</Link> or ask for the free <Link href="/audit">AI audit</Link>.
          </p>
          <div className="ig-cta">
            <Link className="pe-btn pe-btn--gold" href="/shop">Browse the shop</Link>
            <Link className="pe-btn pe-btn--dark" href="/tradies">Job Flow for tradies</Link>
            <Link className="pe-btn pe-btn--dark" href="/audit">Free AI audit</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
