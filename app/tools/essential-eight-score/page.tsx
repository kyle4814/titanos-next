import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { faqPage, breadcrumbs, ORG_ID } from "@/lib/jsonld";
import JsonLd from "@/components/JsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import "@/components/home-redesign/home-redesign.css";
import "./e8.css";
import Tool from "./Tool";
import { ACSC_MODEL_URL, ACSC_HUB_URL, TOTAL_QUESTIONS, STRATEGIES } from "./questions";

const PATH = "/tools/essential-eight-score";
const TITLE = "Essential Eight Self Assessment for Small Business | TITANOS";
const DESC = "Free Essential Eight self assessment for small business: 38 plain-English Maturity Level One questions, an instant score and gap list. Runs in your browser.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  robots: { index: true, follow: true },
});

const FAQ = [
  { q: "What is the Essential Eight?", a: "The Essential Eight is a set of eight baseline cyber security mitigation strategies published by the Australian Signals Directorate (ASD) through the Australian Cyber Security Centre (ACSC): patch applications, patch operating systems, multi-factor authentication, restrict administrative privileges, application control, restrict Microsoft Office macros, user application hardening and regular backups." },
  { q: "Does a small business have to follow the Essential Eight?", a: "For most private small businesses it is guidance, not a law. ASD recommends it as a baseline, and Australian Government entities are expected to follow it under the Protective Security Policy Framework. Larger customers, government buyers and some insurers may ask about it, so it is worth knowing where you stand before they do." },
  { q: "How long does this self assessment take?", a: `Most people finish the ${TOTAL_QUESTIONS} questions in 10 to 15 minutes. Some answers need your IT provider, so it works well as a shared checklist. Choose No when you do not know, because an unknown control cannot be counted as in place.` },
  { q: "Is this score an official Essential Eight assessment?", a: "No. It is an estimate based on ASD's Maturity Level One requirements, written in plain language. It does not test your systems, and it does not certify anything. A formal assessment follows ASD's assessment process and looks at real evidence." },
  { q: "What is the difference between Maturity Level One and higher levels?", a: "Maturity Level One is aimed at opportunistic attackers using widely available tools. Levels Two and Three assume more capable and more selective attackers and ask for stricter timeframes, more logging and stronger multi-factor authentication. ASD describes each level in its maturity model." },
  { q: "Does my data get stored or sent anywhere?", a: "No. The scoring runs in your browser with JavaScript. Your answers are not sent to us, saved or logged, and they disappear when you close or refresh the page." },
];

export default function Page() {
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Essential Eight quick score",
    url: `${SITE}${PATH}`,
    description: DESC,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en-AU",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: 0, priceCurrency: "AUD" },
    audience: { "@type": "Audience", audienceType: "Australian small business owners and their IT providers", geographicArea: { "@type": "Country", name: "Australia" } },
    isBasedOn: ACSC_MODEL_URL,
    publisher: { "@id": ORG_ID },
  };
  const crumbs = breadcrumbs([
    { name: "Home", path: "/" },
    { name: "Compliance", path: "/compliance" },
    { name: "Essential Eight quick score", path: PATH },
  ]);

  return (
    <>
    <main className="e8">
      <JsonLd data={webApp} />
      <JsonLd data={crumbs} />
      <JsonLd data={faqPage(FAQ)} />
      <div className="e8-wrap">
        <nav className="e8-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/compliance">Compliance</Link> / Essential Eight quick score
        </nav>
        <p className="e8-eyebrow">Free tool, no sign-up</p>
        <h1>Essential Eight self assessment for small business</h1>
        <p className="e8-lede">Answer {TOTAL_QUESTIONS} plain-English questions and see roughly how close your business is to Maturity Level One of the Essential Eight, with a list of gaps to close and what to ask your IT provider for.</p>
        <p className="e8-lede">Every question is taken from the Maturity Level One requirements in the <a href={ACSC_MODEL_URL} rel="noopener">ASD Essential Eight maturity model</a> on cyber.gov.au, reworded so an owner can answer it.</p>
        <p className="e8-note"><strong>What this is and is not.</strong> A quick estimate to plan your next steps. It does not scan or test anything, and it is not an ASD assessment, an audit or a certification. Your answers stay in your browser.</p>

        <Tool />

        <div className="e8-prose">
          <h2>How the Essential Eight quick score works</h2>
          <p>Each answer earns points: Yes is 1, Partly is half a point and No is zero. A question marked Does not apply, such as a customer login portal you do not run, is left out of both your points and the total. The overall percentage is points earned divided by points available, and each of the eight strategies gets its own percentage so you can see where the weakness sits.</p>
          <p>The gap list puts every No ahead of every Partly. Inside each group the order follows the eight strategies, which is a reading order, not a risk ranking. For where to begin when everything is a gap, see the suggested starting order below.</p>
          <p>The questions cover these {STRATEGIES.length} strategies: {STRATEGIES.map((s) => s.name.toLowerCase()).join(", ")}.</p>

          <h2>Essential Eight for small business: what Maturity Level One means</h2>
          <p>ASD defines three maturity levels. Maturity Level One is aimed at attackers who use commodity tools and opportunity: an unpatched online service, a stolen or reused password, a malicious document. It describes attackers who are looking for any victim, not your business in particular. That is the realistic threat for most small Australian businesses, and it is why Maturity Level One is the usual first target.</p>
          <p>Reaching it is not only a technology job. Several requirements, such as removing unsupported software, keeping a restore tested and limiting who has admin rights, need a decision from the owner. Several others, such as application control and macro policy, are settings your IT provider applies once and checks on a schedule.</p>

          <h2>Does your small business need to meet the Essential Eight?</h2>
          <p>For most private businesses the Essential Eight is guidance rather than a legal rule. ASD recommends that all organisations implement it as a baseline, and Australian Government entities are expected to follow it under the <a href="https://www.protectivesecurity.gov.au" rel="noopener">Protective Security Policy Framework</a>. Where it bites for a small business is the supply chain: a government agency, a larger customer or a cyber insurer may ask whether you meet it. Having a documented answer ready saves time and can save a contract.</p>
          <p>The Essential Eight does not cover everything. It targets a specific set of common attacks. Privacy obligations, staff training and incident response are separate jobs, covered on our <Link href="/compliance">compliance page</Link> and in our guide to the <Link href="/blog/essential-eight-small-trade-business">Essential Eight for a one-van trade business</Link>.</p>

          <h2>Where to start if your score is low</h2>
          <p>This order is our judgement from the questions above, not an ASD ranking:</p>
          <ul>
            <li><strong>Multi-factor authentication on email and finance logins first.</strong> It is quick and removes the most common way in: a guessed or reused password.</li>
            <li><strong>Test a restore from backup.</strong> It tells you in an afternoon whether your backups work, and whether an attacker could delete them.</li>
            <li><strong>Remove unsupported software and operating systems.</strong> Nothing else protects a machine that no longer receives fixes.</li>
            <li><strong>Set update timeframes and get a report.</strong> Two weeks for everyday software, 48 hours for critical fixes on anything facing the internet.</li>
            <li><strong>Hand the settings strategies to your IT provider as one job:</strong> macros, browser hardening, application control and admin accounts.</li>
          </ul>

          <h2>Turn the score into evidence</h2>
          <p>A score is a starting point. A customer, insurer or tender will want proof: screenshots of policy settings, patch reports, a restore test record. The <Link href="/products/essential-eight-ml1-checklist">Essential Eight Maturity Level One Checklist</Link> in our <Link href="/shop">shop</Link> follows the same eight strategies, with the evidence to keep for each and a gap sheet for your IT provider. If you would rather have it done with you, the <Link href="/compliance">fixed-price Privacy Act and Essential Eight pack</Link> covers it, and our <Link href="/scan">free email security scan</Link> checks one of the most common gaps from the outside, using public records only.</p>
        </div>

        <div className="e8-faq">
          <h2>Essential Eight self assessment: common questions</h2>
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </div>

        <div className="e8-prose">
          <h2>Sources</h2>
          <ul className="e8-src">
            <li><a href={ACSC_MODEL_URL} rel="noopener">Essential Eight maturity model</a>, ASD / ACSC, cyber.gov.au. Appendix A lists the Maturity Level One requirements used here. The page showed a last reviewed date of 27 November 2023 when we read it on 28 November 2026. ASD updates the model from time to time, so check the current version.</li>
            <li><a href={ACSC_HUB_URL} rel="noopener">Essential Eight hub</a>, ASD / ACSC, cyber.gov.au.</li>
            <li><a href="https://www.protectivesecurity.gov.au" rel="noopener">Protective Security Policy Framework</a>, Australian Government.</li>
          </ul>
          <p>Questions are our plain-English restatement and several related ACSC lines are merged into one question. For the exact wording and for formal assessment, use ASD's documents. This page is general information, not professional advice. Written by Kyle Deligny, Brisbane. ABN 34 318 502 254.</p>
        </div>

        <h2>Related</h2>
        <div className="e8-rel">
          <Link href="/compliance">Privacy Act and Essential Eight pack<small>Fixed price, done with you</small></Link>
          <Link href="/blog/essential-eight-small-trade-business">Essential Eight for a trade business<small>Each control in everyday words</small></Link>
          <Link href="/scan">Free email security scan<small>Public records only</small></Link>
          <Link href="/shop">Shop<small>Checklists, templates and packs</small></Link>
        </div>
      </div>
      <RelatedLinks path={PATH} />
    </main>
    </>
  );
}
