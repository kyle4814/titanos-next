import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { breadcrumbs, faqPage, ORG_ID } from "@/lib/jsonld";
import JsonLd from "@/components/JsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import "@/components/home-redesign/home-redesign.css";
import "./privacy-checker.css";
import Checker from "./Checker";

const PATH = "/tools/privacy-act-checker";
const TITLE = "Am I Covered by the Privacy Act? Small Business Checker";
const DESC =
  "Free checker: does the Privacy Act apply to your small business? Seven questions on the AU$3 million exemption, its exceptions and the 10 December 2026 changes.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: "website" },
  robots: { index: true, follow: true },
});

const FAQ = [
  {
    q: "Does the Privacy Act apply to small businesses?",
    a: "Not automatically. A small business operator with annual turnover of AU$3 million or less is generally exempt from the Australian Privacy Principles. The exemption has exceptions, including health service providers, businesses that trade in personal information, Commonwealth contracted service providers and AML/CTF reporting entities.",
  },
  {
    q: "What is the Privacy Act small business exemption threshold?",
    a: "AU$3 million in annual turnover, tested against the previous financial year. It is set out in section 6D of the Privacy Act 1988.",
  },
  {
    q: "Am I covered by the Privacy Act if I am a sole trader?",
    a: "A sole trader is a small business operator if turnover is AU$3 million or less, so most are exempt. A sole trader who provides a health service, trades in personal information or does Commonwealth contract work is not protected by the exemption.",
  },
  {
    q: "What changes on 10 December 2026?",
    a: "Under the Privacy and Other Legislation Amendment Act 2024, businesses covered by the Act must describe in their privacy policy the kinds of personal information used in automated decisions that could significantly affect a person, and how those decisions are made. A small business that is exempt is not caught by this obligation.",
  },
  {
    q: "Is this checker legal advice?",
    a: "No. It is general information built on a simplified reading of the Act and the OAIC guidance. For a firm answer, contact the OAIC or a privacy lawyer.",
  },
];

const APP_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Privacy Act coverage checker for Australian small business",
  url: `${SITE}${PATH}`,
  description: DESC,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any (runs in the browser)",
  inLanguage: "en-AU",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: 0, priceCurrency: "AUD" },
  publisher: { "@id": ORG_ID },
  dateModified: "2026-11-28",
};

export default function PrivacyActChecker() {
  return (
    <div className="pt-page">
      <JsonLd data={APP_LD} />
      <JsonLd data={faqPage(FAQ)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Privacy Act checker", path: PATH }])} />
      <div className="pt-wrap">
        <header className="pt-hero">
          <p className="pt-crumbs"><Link href="/">Home</Link> / Free tools / Privacy Act checker</p>
          <p className="pt-kicker">Free tool, Australian Privacy Act 1988</p>
          <h1>Am I covered by the Privacy Act? <em>Small business exemption checker</em></h1>
          <p className="pt-lede">Most Australian small businesses are exempt from the Privacy Act, until they are not. Answer seven questions about your business and get a plain result, with the sources behind each question.</p>
          <p className="pt-meta">Written by Kyle Deligny, Brisbane. Last checked 28 November 2026 against the Act and OAIC guidance. General information, not legal advice.</p>
        </header>

        <Checker />

        <section className="pt-section" aria-labelledby="how">
          <h2 id="how">How the small business exemption works</h2>
          <p>The Privacy Act 1988 binds Australian Government agencies and &quot;organisations&quot;. A business whose annual turnover is AU$3 million or less is a small business operator, and the Act does not treat it as an organisation. In practice that means the Australian Privacy Principles (APPs), including the duty to have a privacy policy, mostly do not apply to it. The test is set in section 6D of the Act and looks at the previous financial year, so a business can move in and out of the exemption as it grows or shrinks.</p>
          <p>The exemption is about the Act, not about good practice. A small business still answers to its customers, to contracts that require privacy terms, and to other laws such as the Spam Act 2003 and state surveillance laws.</p>

          <h2 id="exceptions" style={{ marginTop: 28 }}>The exceptions that matter</h2>
          <p>A turnover under AU$3 million does not protect you if any of these apply:</p>
          <ul className="pt-list">
            <li><strong>Health service providers.</strong> A private sector business that provides a health service and holds health information is covered whatever its size. The definition is wide and takes in many allied health, wellness, counselling and gym style businesses.</li>
            <li><strong>Trading in personal information.</strong> Disclosing personal information to someone else for a benefit, service or advantage, or collecting it from someone else for one. Selling a customer list is the clear case.</li>
            <li><strong>Commonwealth contracted service providers.</strong> If you handle personal information to deliver services under a contract with an Australian Government agency, the Act applies to that work.</li>
            <li><strong>AML/CTF reporting entities.</strong> Businesses regulated under the Anti-Money Laundering and Counter-Terrorism Financing Act 2006 are covered for their AML/CTF activities.</li>
            <li><strong>Related companies.</strong> Group structures and related bodies corporate have their own rules in the Act, so a company inside a larger group should not assume it is exempt on its own turnover.</li>
            <li><strong>Special regimes.</strong> Tax file number handling, credit reporting, My Health Record, the Consumer Data Right, and businesses that have chosen to opt in to the Act.</li>
          </ul>

          <h2 id="reforms" style={{ marginTop: 28 }}>The 2024 reforms and the 10 December 2026 start date</h2>
          <p>The Privacy and Other Legislation Amendment Act 2024 received Royal Assent on 10 December 2024. It added new enforcement powers for the OAIC, a statutory tort for serious invasions of privacy, and a new transparency duty for automated decisions. That duty starts on 10 December 2026: a business covered by the Act has to say in its privacy policy what kinds of personal information it uses in decisions made or substantially assisted by a computer program, where those decisions could significantly affect someone&apos;s rights or interests.</p>
          <p>Two points for a small business. First, the automated decision duty is an APP duty, so it only reaches you if you are covered under the checker above. Second, the 2024 Act did not remove the AU$3 million exemption. Removal was agreed in principle by the Government in 2023 as a later stage of reform, and any change would have to pass Parliament. Check the current compilation of the Act on legislation.gov.au before relying on this page, because the law can move.</p>
          <p>If you are covered and use software to quote, screen, schedule or rank people, our <Link href="/products/privacy-adm-wording-guide">automated decision wording guide</Link> and the <Link href="/blog/privacy-act-small-business-deadline">small business deadline explainer</Link> go through what to write.</p>

          <h2 id="next" style={{ marginTop: 28 }}>What to do with your result</h2>
          <ol className="pt-list">
            <li>If the checker says covered or needs a closer look, write down which question drove it and read the matching OAIC guidance below.</li>
            <li>Get a privacy policy and collection notices in place. The <Link href="/products/privacy-policy-template-pack">Privacy Policy Template Pack</Link> and the rest of the <Link href="/shop">TITANOS shop</Link> are built for small Australian businesses.</li>
            <li>If you want help beyond templates, <Link href="/compliance">our Privacy Act compliance service</Link> and the <Link href="/blog/sole-trader-privacy-policy-threshold">sole trader privacy policy guide</Link> cover the next steps.</li>
          </ol>

          <h2 id="faq" style={{ marginTop: 28 }}>Questions people ask</h2>
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}

          <h2 id="sources" style={{ marginTop: 28 }}>Sources</h2>
          <ul className="pt-list pt-sources">
            <li>Privacy Act 1988 (Cth), including section 6D, on <a href="https://www.legislation.gov.au/C2004A03712/latest/text" rel="noopener noreferrer">legislation.gov.au</a>.</li>
            <li>Privacy and Other Legislation Amendment Act 2024 (Act No. 128 of 2024), on <a href="https://www.legislation.gov.au/C2024A00128/asmade" rel="noopener noreferrer">legislation.gov.au</a>.</li>
            <li>Office of the Australian Information Commissioner (OAIC), <a href="https://www.oaic.gov.au/privacy" rel="noopener noreferrer">privacy guidance for businesses</a>, including its pages on the small business exemption and on the Privacy Act reforms.</li>
            <li>AUSTRAC, <a href="https://www.austrac.gov.au" rel="noopener noreferrer">AML/CTF reporting entity guidance</a>.</li>
          </ul>
          <p style={{ marginTop: 14 }}>General information, not legal advice. Titanos is a sole trader practice (ABN 34 318 502 254), not a law firm.</p>
        </section>

        <aside className="pt-card pt-cta" aria-label="Next step">
          <p className="pt-kicker">Next step</p>
          <h2>Get your privacy paperwork sorted</h2>
          <p>Templates written in everyday words for small Australian businesses, plus a compliance service if you want it done with you.</p>
          <div className="pt-answers">
            <Link className="pt-btn pt-btn--gold" href="/shop">Privacy templates in the shop</Link>
            <Link className="pt-btn" href="/compliance">Privacy Act compliance</Link>
          </div>
        </aside>
      </div>
      <RelatedLinks path={PATH} />
    </div>
  );
}
