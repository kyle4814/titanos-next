import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import { article, breadcrumbs, faqPage } from "@/lib/jsonld";
import { OBLIGATIONS, HUB, LAST_REVIEWED, ACT_URL, POLA_URL } from "@/lib/privacyObligations";
import { Hero, Section, Ld, NextSteps, CHECKER_HREF } from "@/components/privacy-act/Shell";

const PATH = "/privacy-act";

export const metadata: Metadata = withSeo(PATH, {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `https://titanos.tech${PATH}` },
  openGraph: { title: HUB.title, description: HUB.description, type: "article", url: `https://titanos.tech${PATH}` },
  robots: { index: true, follow: true },
});

const FAQ = [
  {
    q: "What is the next Privacy Act deadline for a small business?",
    a: "10 December 2026, when the automated decision transparency duty in APP 1.7 to 1.9 starts. It applies to decisions made after that date, and only to businesses the Act covers.",
  },
  {
    q: "Does the Privacy Act apply to my business if I turn over less than AU$3 million?",
    a: "Often not, but it can. Providing a health service, trading in personal information, holding a Commonwealth contract or having earlier exceeded AU$3 million are examples that bring a business within the Act. The small business exemption explainer lists them.",
  },
  {
    q: "Which of these obligations reach a business that is exempt from the APPs?",
    a: "On the OAIC's description, the statutory tort for serious invasions of privacy extends beyond APP entities. The other five depend on the business being covered by the Act.",
  },
];

export default function PrivacyActHub() {
  const art = {
    ...article({ path: PATH, headline: HUB.h1, description: HUB.description, datePublished: LAST_REVIEWED, dateModified: LAST_REVIEWED }),
    author: { "@type": "Person", name: "Kyle Deligny", url: "https://titanos.tech/about" },
    inLanguage: "en-AU",
  };
  return (
    <>
      <Ld items={[art, breadcrumbs([{ name: "Home", path: "/" }, { name: "Privacy Act", path: PATH }]), faqPage(FAQ)]} />
      <Hero
        crumbs={[{ name: "Home", href: "/" }, { name: "Privacy Act" }]}
        h1={HUB.h1}
        answer="Six parts of the Privacy Act matter most to a 5 to 20 person business: the privacy policy and the new automated decision duty, collection notices, sending data overseas, data breach reporting, the small business exemption and the new privacy tort. Each page below says who it applies to, what it requires, shows a worked example and gives a checklist, with the primary source beside it."
      />

      <Section id="first" title="Start with the one question that decides everything">
        <p>
          Most of the Privacy Act binds an <em>APP entity</em>: an organisation the Act covers. A business with annual turnover of AU$3 million or less is generally a small business operator and sits outside the Australian Privacy Principles, but section 6D then lists exceptions that pull a business back in, and a single year over the line can end the exemption for good. So the first job is not to write a policy. It is to work out whether you are covered. The <Link href="/privacy-act/small-business-exemption">small business exemption explainer</Link> walks through the test, and the <Link href={CHECKER_HREF}>free Privacy Act checker</Link> asks the same questions in a few minutes.
        </p>
        <p>
          If you are covered, the next four pages are your working set. If you are exempt, you can still be sued under the statutory tort, and larger customers often write privacy duties into their contracts, so the sixth page and the data breach page are worth reading either way.
        </p>
      </Section>

      <Section id="obligations" title="The six obligations">
        <ul className="po-grid">
          {OBLIGATIONS.map((o) => (
            <li key={o.slug}>
              <Link href={`/privacy-act/${o.slug}`} className="pe-card">
                <h3>{o.short}</h3>
                <p>{o.answer.split(". ")[0]}.</p>
                <span className="pe-textlink">Read the explainer</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="table" title="Dates and reach at a glance">
        <p>One row per obligation. Dates come from section 2 of the amending Act and the OAIC pages cited on each explainer.</p>
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr><th scope="col">Obligation</th><th scope="col">When</th><th scope="col">Reaches a small business?</th></tr>
            </thead>
            <tbody>
              {OBLIGATIONS.map((o) => (
                <tr key={o.slug}>
                  <th scope="row"><Link href={`/privacy-act/${o.slug}`}>{o.short}</Link></th>
                  <td>{o.commences}</td>
                  <td>{o.smallBusiness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="timeline" title="What changed, and what is still coming">
        <ul className="po-list">
          <li><strong>10 December 2024.</strong> The Privacy and Other Legislation Amendment Act 2024 received Royal Assent. Most of Schedule 1 started the next day, 11 December 2024.</li>
          <li><strong>10 June 2025.</strong> Schedule 2, the statutory tort for serious invasions of privacy, commenced. The OAIC confirms that date.</li>
          <li><strong>10 December 2026.</strong> Part 15 of Schedule 1 starts, adding APP 1.7 to 1.9 on automated decisions to privacy policies. At the time of review, the Federal Register showed that date as the start of the next version of the Act.</li>
        </ul>
        <p>
          That is the whole of the dated change for small business this year. Everything else on the six pages has been in force already, so the practical risk for most businesses is an old privacy policy, a missing collection notice, an untracked AI tool or a breach plan that has never been written.
        </p>
      </Section>

      <Section id="how" title="How to use these pages">
        <ol className="po-steps">
          <li>Work out whether the Act covers you using the exemption explainer or the free checker. Write the answer and the date down.</li>
          <li>If covered, list your data: what you collect, where it is stored, which tools touch it and which of those are overseas or use AI.</li>
          <li>Fix in order of exposure: privacy policy and collection notices, vendor register for overseas tools, breach response plan, then the automated decision paragraph before 10 December 2026.</li>
          <li>Whether or not you are covered, set staff rules on sharing customer information, because the tort turns on conduct.</li>
        </ol>
        <p>
          The <Link href="/shop">privacy template pack in the shop</Link> gives you fill-in documents for steps 2 and 3, and <Link href="/compliance">Privacy Act compliance with Titanos</Link> is the done-with-you route.
        </p>
      </Section>

      <Section id="faq" title="Questions people ask">
        <div className="po-faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <Section id="sources" title="Primary sources">
        <ul className="po-src">
          <li><a href={ACT_URL} rel="noopener">Privacy Act 1988 (Cth), current compilation</a><span>Federal Register of Legislation. Compilation No. 104, dated 4 June 2026, when reviewed.</span></li>
          <li><a href={POLA_URL} rel="noopener">Privacy and Other Legislation Amendment Act 2024</a><span>Section 2 gives the commencement dates; Schedule 1 Part 15 is the automated decision duty.</span></li>
          <li><a href="https://www.oaic.gov.au/privacy/privacy-for-organisations/small-business" rel="noopener">OAIC: small business</a><span>Who is covered regardless of turnover.</span></li>
        </ul>
        <p>Written by <Link href="/about">Kyle Deligny</Link>. General information, not legal advice.</p>
      </Section>

      <NextSteps lead="Run the free checker for a quick read on your position, pick up the template pack for the documents, or have Titanos do the work with you." />
    </>
  );
}
