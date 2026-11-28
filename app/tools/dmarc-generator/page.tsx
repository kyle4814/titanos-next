import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { ORG_ID, breadcrumbs, faqPage, serialise } from "@/lib/jsonld";
import Generator from "./Generator";
import RelatedLinks from "@/components/seo/RelatedLinks";
import "@/components/home-redesign/home-redesign.css";
import "../email-spoofing-check/spoofcheck.css";
import "./dmarcgen.css";

const PATH = "/tools/dmarc-generator";
const TITLE = "DMARC Record Generator Australia: Free, In Your Browser | TITANOS";
const DESC =
  "Free DMARC record generator for Australian businesses. Pick a policy, report mailbox and alignment, and copy the exact TXT record with a plain-English explanation.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
  robots: { index: true, follow: true },
});

const FAQ = [
  {
    q: "What is a DMARC record?",
    a: "A DMARC record is a single line of text published in your domain's DNS at the name _dmarc.yourdomain. It tells receiving mail systems what to do with email that claims to be from your domain but fails both SPF and DKIM checks that line up with the From address: nothing (none), the spam folder (quarantine) or refuse it (reject). It also asks receivers to send you reports. It is defined in RFC 7489.",
  },
  {
    q: "Which policy should I start with?",
    a: "Start with p=none and a report address. It blocks nothing, so it cannot stop your own mail, and the reports show you every system that sends as your domain. Move to quarantine and then reject only once the reports show each legitimate sender passing.",
  },
  {
    q: "What does pct do?",
    a: "The pct tag applies your policy to only that percentage of failing mail. Under RFC 7489, mail outside the percentage is handled one step softer: a quarantine policy falls back to none, and a reject policy falls back to quarantine. It lets you move up in steps, for example quarantine at 10, then 25, then 50, then 100. Leaving pct out means 100.",
  },
  {
    q: "What is the rua address for?",
    a: "The rua tag lists where receivers send daily aggregate reports, which are XML files that count mail by sending server and whether it passed. They contain no message content. Most small businesses use a report service or a shared mailbox, because the files are not easy to read by eye.",
  },
  {
    q: "What do relaxed and strict alignment mean?",
    a: "Alignment decides how closely the domain that passed SPF or DKIM must match the domain in the visible From line. Relaxed lets a subdomain match its parent, for example mail.example.com.au for example.com.au. Strict needs an exact match. Relaxed is the default and suits most small businesses. Strict can break mail from services that send from a subdomain.",
  },
  {
    q: "Where do I publish the record?",
    a: "In the DNS settings for your domain, usually at your domain registrar or DNS host. Add a TXT record with the name _dmarc (some providers want the full _dmarc.yourdomain) and paste the value. Our DMARC setup pages have a step-by-step page for each major mail provider.",
  },
  {
    q: "Is this generator free, and does it send my details anywhere?",
    a: "It is free and runs in your browser. The record is built on your device, nothing you type is sent to titanos.tech and nothing is stored. After you publish the record, use the free email spoofing check to confirm the public internet can see it.",
  },
  {
    q: "Will a DMARC record stop all scam emails?",
    a: "No. At reject it helps stop people sending email that uses your exact domain. Look-alike domains, hacked mailboxes and phone scams are separate problems. The Australian Government's Scamwatch site lists current scams and how to report them.",
  },
];

const webApp = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE}${PATH}#tool`,
  name: "DMARC record generator",
  url: `${SITE}${PATH}`,
  description: DESC,
  applicationCategory: "SecurityApplication",
  operatingSystem: "Any (runs in the browser)",
  browserRequirements: "Requires JavaScript",
  inLanguage: "en-AU",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
  publisher: { "@id": ORG_ID },
  audience: { "@type": "Audience", audienceType: "Small business owners in Australia", geographicArea: { "@type": "Country", name: "Australia" } },
};

const ld = [
  webApp,
  faqPage(FAQ),
  breadcrumbs([
    { name: "Home", path: "/" },
    { name: "Free tools", path: "/tools" },
    { name: "DMARC record generator", path: PATH },
  ]),
].filter(Boolean) as Record<string, unknown>[];

export default function DmarcGeneratorPage() {
  return (
    <div className="dmc">
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialise(d) }} />
      ))}
      <div className="dmc-wrap">
        <nav className="dmc-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <Link href="/tools">Free tools</Link> / <span aria-current="page">DMARC record generator</span>
        </nav>

        <header className="dmc-head">
          <p className="pe-kicker">Free tool &middot; DMARC</p>
          <h1>
            DMARC record generator for Australian businesses: <em>build the exact TXT record in a minute.</em>
          </h1>
          <p className="dmc-lede">
            Choose a policy, a report mailbox and how closely the domains must line up. You get the exact record to paste into your DNS, with each part explained in plain English.
          </p>
          <ul className="dmc-trust">
            <li>Runs in your browser</li>
            <li>No sign-up, nothing stored</li>
            <li>Nothing you type is sent to us</li>
            <li>Safe starting point: monitor only</li>
          </ul>
        </header>

        <Generator />

        <section className="dmc-section" aria-labelledby="h-where">
          <h2 id="h-where">How to publish the record</h2>
          <ol>
            <li>Sign in to wherever your domain&rsquo;s DNS is managed. That is usually your registrar or your DNS host.</li>
            <li>Add a new <strong>TXT</strong> record.</li>
            <li>For the name, enter <code>_dmarc</code>. Some providers want the full <code>_dmarc.yourdomain.com.au</code>. If an old DMARC record already exists, edit it, because a domain must have only one.</li>
            <li>Paste the value from the box above and save.</li>
            <li>Wait a few minutes, then run the <Link href="/tools/email-spoofing-check">free email spoofing check</Link> to confirm the record is visible.</li>
          </ol>
          <p>
            We have written a page for each major mail provider: see the <Link href="/email-security/setup">DMARC setup guides</Link>.
          </p>
        </section>

        <section className="dmc-section" aria-labelledby="h-tags">
          <h2 id="h-tags">The tags, in plain English</h2>
          <div className="dmc-terms">
            <div>
              <h3>p: policy</h3>
              <p><code>none</code> watches, <code>quarantine</code> sends failing mail to junk, <code>reject</code> refuses it. Defined in <a href="https://www.rfc-editor.org/rfc/rfc7489#section-6.3" rel="noopener">RFC 7489 section 6.3</a>.</p>
            </div>
            <div>
              <h3>rua: reports</h3>
              <p>A <code>mailto:</code> address that receives daily summaries of who sent mail as your domain and whether it passed.</p>
            </div>
            <div>
              <h3>pct: percentage</h3>
              <p>Applies the policy to part of the failing mail, so you can tighten in steps. Left out, it means 100.</p>
            </div>
            <div>
              <h3>adkim and aspf</h3>
              <p>Relaxed (<code>r</code>, the default) or strict (<code>s</code>) matching between the From domain and the domain that passed DKIM or SPF.</p>
            </div>
            <div>
              <h3>sp: subdomains</h3>
              <p>An optional separate policy for subdomains. Without it, subdomains follow <code>p</code>.</p>
            </div>
          </div>
        </section>

        <section className="dmc-section" aria-labelledby="h-order">
          <h2 id="h-order">The safe order: watch, then tighten</h2>
          <p>
            A new record usually starts at <code>p=none</code> with a report address. Once the reports show every legitimate sender passing, move to <code>p=quarantine</code> with a small <code>pct</code>, raise it in steps, then finish at <code>p=reject</code>. Microsoft, Google and Cloudflare all describe starting at none and moving up slowly. Our <Link href="/email-security/setup">setup pages</Link> set out a four-stage rhythm with the exact record for each stage.
          </p>
          <p>
            DMARC only passes when SPF or DKIM passes and lines up with your From address, so confirm each service that sends as you has one of them set up before you tighten.
          </p>
        </section>

        <section className="dmc-section dmc-faq" aria-labelledby="h-faq">
          <h2 id="h-faq">Questions people ask</h2>
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="dmc-cta" aria-labelledby="h-cta">
          <h2 id="h-cta">Want it set up properly, without learning DNS?</h2>
          <p>
            The DMARC and SPF Setup Guide walks through every step for your mail provider, with a one-page summary for your IT provider. Prices are in AUD and no GST is charged. Or run the free full security check first and see where your domain stands.
          </p>
          <div className="dmc-ctarow">
            <Link href="/products/dmarc-setup-guide" className="pe-btn pe-btn--gold pe-btn--lg">See the DMARC setup guide</Link>
            <Link href="/scan" className="pe-btn pe-btn--dark pe-btn--lg">Free full security check</Link>
            <Link href="/tools/email-spoofing-check" className="pe-btn pe-btn--dark pe-btn--lg">Check my DMARC record</Link>
          </div>
        </section>

        <section className="dmc-section dmc-sources" aria-labelledby="h-src">
          <h2 id="h-src">Sources</h2>
          <ul>
            <li><a href="https://www.rfc-editor.org/rfc/rfc7489" rel="noopener">RFC 7489: Domain-based Message Authentication, Reporting and Conformance (DMARC)</a></li>
            <li><a href="https://www.rfc-editor.org/rfc/rfc7208" rel="noopener">RFC 7208: Sender Policy Framework (SPF)</a></li>
            <li><a href="https://www.rfc-editor.org/rfc/rfc6376" rel="noopener">RFC 6376: DomainKeys Identified Mail (DKIM) Signatures</a></li>
            <li><a href="https://www.scamwatch.gov.au/" rel="noopener">Scamwatch, Australian Government: report and learn about scams</a></li>
          </ul>
        </section>

        <p className="dmc-note">
          Built and maintained by Kyle Deligny, Brisbane (ABN 34 318 502 254). General information, not legal or security advice for your specific systems. Last reviewed 29 November 2026.
        </p>
      </div>
      <RelatedLinks path={PATH} />
    </div>
  );
}
