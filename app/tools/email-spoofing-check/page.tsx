import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { ORG_ID, breadcrumbs, faqPage, serialise } from "@/lib/jsonld";
import Checker from "./Checker";
import "@/components/home-redesign/home-redesign.css";
import "./spoofcheck.css";

const PATH = "/tools/email-spoofing-check";
const TITLE = "DMARC Checker Australia: Free Email Spoofing Check | TITANOS";
const DESC =
  "Free DMARC checker for Australian businesses. See in seconds whether someone can send email pretending to be you, with plain-English SPF, DKIM and DMARC fixes.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
  robots: { index: true, follow: true },
});

const FAQ = [
  {
    q: "Can someone send an email pretending to be my business?",
    a: "Yes, unless your domain publishes records that tell receiving mail systems to refuse it. Email was designed without a check on the From address, so anyone can type yours into a message. SPF, DKIM and DMARC are the three public records that add the check. Receivers that honour DMARC will quarantine or reject fake mail when your policy is quarantine or reject. With no DMARC record, or p=none, most fake mail is still delivered.",
  },
  {
    q: "Is this DMARC checker free, and does it store my domain?",
    a: "It is free, and it runs in your browser. Your browser asks Cloudflare's public DNS resolver (1.1.1.1) for the same public records anyone can look up. Nothing is saved, no account is needed, and the domain you type is not sent to titanos.tech. Cloudflare, as the resolver, does see the DNS question, under its own public resolver privacy policy.",
  },
  {
    q: "What is the difference between SPF, DKIM and DMARC?",
    a: "SPF lists the servers allowed to send for your domain. DKIM adds a signature to each message that proves it was not altered and came from a sender you authorised. DMARC ties the two to the address people actually see in the From line and tells receivers what to do when both fail: nothing (none), spam folder (quarantine) or refuse (reject).",
  },
  {
    q: "Why does the checker say no DKIM key was found when my email works?",
    a: "A DKIM key lives at a name the sender chooses, called a selector. The checker tries 18 common selectors (Google Workspace, Microsoft 365, Mailchimp, SendGrid and others). If your provider uses a different one, the key exists but this check cannot see it. Your email provider's admin console shows the selector. The result is shown as 'cannot confirm', never as a fail.",
  },
  {
    q: "Is p=none good enough?",
    a: "It is a good first step and a poor place to stay. p=none collects reports and blocks nothing. The usual path is to read the reports for two to four weeks, fix any legitimate sender that fails, then move to quarantine and finally reject.",
  },
  {
    q: "Will turning on DMARC reject stop my own email?",
    a: "It can, if a legitimate sender is not set up correctly: an invoicing system, a newsletter tool, a booking platform. That is why the order matters: monitor first, then quarantine, then reject. Never jump straight to reject without reading the reports.",
  },
  {
    q: "Does a passing result mean I am safe from scams?",
    a: "No. It closes one door: exact-domain spoofing. Scammers can still register a look-alike domain, compromise a real mailbox or phone you. The check is one layer. The Australian Government's Scamwatch site lists current scams and how to report them.",
  },
];

const webApp = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE}${PATH}#tool`,
  name: "Email spoofing check (SPF, DKIM and DMARC)",
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
    { name: "Email spoofing check", path: PATH },
  ]),
].filter(Boolean) as Record<string, unknown>[];

export default function EmailSpoofingCheckPage() {
  return (
    <div className="dmc">
      {ld.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialise(d) }} />
      ))}
      <div className="dmc-wrap">
        <nav className="dmc-crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link> / <span aria-current="page">Email spoofing check</span>
        </nav>

        <header className="dmc-head">
          <p className="pe-kicker">Free tool &middot; SPF &middot; DKIM &middot; DMARC</p>
          <h1>
            DMARC checker for Australian businesses: <em>can someone send email pretending to be you?</em>
          </h1>
          <p className="dmc-lede">
            Type your business domain and see what the public internet can see about it. In a few seconds you get a plain-English answer to the question, then a short fix list you can forward to whoever looks after your email.
          </p>
          <ul className="dmc-trust">
            <li>Public DNS records only</li>
            <li>Runs in your browser</li>
            <li>No sign-up, nothing stored</li>
            <li>Honest about what it cannot see</li>
          </ul>
        </header>

        <Checker />

        <section className="dmc-section" aria-labelledby="h-answer">
          <h2 id="h-answer">Can someone send email pretending to be my business?</h2>
          <p>
            Yes, unless your domain says otherwise. The From line of an email is just text the sender types, the same way anyone can write any return address on an envelope. Nothing in email stops a stranger writing your domain there.
          </p>
          <p>
            What stops it is three public records on your domain, which receiving mail systems read before deciding what to do with a message. They cost nothing to publish, and most small business domains have them missing, half set up or left on monitor only. That is the gap this checker looks for. It matters because the usual fake is not a technical attack. It is an invoice with changed bank details, or a note to a customer that looks like it came from you. Our post <Link href="/blog/can-someone-send-email-pretending-to-be-my-business">Can someone send email pretending to be my business?</Link> walks through how that plays out, and <Link href="/blog/anz-smb-email-security-double-gap-measured">our measured study of Australian and New Zealand small business domains</Link> shows how common the gap is, with the method published.
          </p>
        </section>

        <section className="dmc-section" aria-labelledby="h-records">
          <h2 id="h-records">The three records, in plain English</h2>
          <div className="dmc-terms">
            <div>
              <h3>SPF</h3>
              <p>A public list of the servers allowed to send email for your domain. Defined in <a href="https://www.rfc-editor.org/rfc/rfc7208" rel="noopener">RFC 7208</a>. It must be a single record, and it may trigger at most 10 further DNS lookups. The checker counts them.</p>
            </div>
            <div>
              <h3>DKIM</h3>
              <p>A digital signature added to each message by your email provider, checked against a public key in your DNS. Defined in <a href="https://www.rfc-editor.org/rfc/rfc6376" rel="noopener">RFC 6376</a>. Every service that sends as you (mailbox, newsletter, invoicing) needs its own.</p>
            </div>
            <div>
              <h3>DMARC</h3>
              <p>The rule that connects them. It tells receivers what to do with mail that claims to be from you and fails: <code>none</code>, <code>quarantine</code> or <code>reject</code>. Defined in <a href="https://www.rfc-editor.org/rfc/rfc7489" rel="noopener">RFC 7489</a>. This is the record that actually answers the question above.</p>
            </div>
          </div>
        </section>

        <section className="dmc-section" aria-labelledby="h-fix">
          <h2 id="h-fix">If the result says Open: the safe order to fix it</h2>
          <ol>
            <li><strong>List your real senders.</strong> Your mailbox provider, your newsletter tool, your invoicing and booking systems, anything that emails as your domain.</li>
            <li><strong>Publish one SPF record</strong> covering them, ending in <code>~all</code>.</li>
            <li><strong>Switch on DKIM</strong> in each sender&rsquo;s admin settings. Google Workspace and Microsoft 365 both have a DKIM setting.</li>
            <li><strong>Add DMARC in monitor mode:</strong> a TXT record at <code>_dmarc.yourdomain</code> with <code>v=DMARC1; p=none; rua=mailto:a mailbox you read</code>.</li>
            <li><strong>Read the reports for two to four weeks</strong> and fix any real sender that fails.</li>
            <li><strong>Move to <code>p=quarantine</code>, then <code>p=reject</code></strong>, re-running this check after each change.</li>
          </ol>
          <p>
            Do not skip to reject. A legitimate sender you forgot will start bouncing. The step-by-step version, with a checklist per mail provider and a one-page summary for your IT provider, is in our <Link href="/products/dmarc-setup-guide">DMARC and SPF Setup Guide</Link>. If you would rather do a first pass yourself, the <Link href="/products/spoofguard-self-check-checklist">Email Spoofing Self-Check Checklist</Link> is a four-page PDF.
          </p>
        </section>

        <section className="dmc-section" aria-labelledby="h-limits">
          <h2 id="h-limits">What this check can and cannot tell you</h2>
          <ul>
            <li>It reads public DNS only. It does not log in to anything, send any email, or touch your mail server.</li>
            <li>Receivers choose how to act on your policy. Reject is the strongest instruction, not a guarantee.</li>
            <li>DKIM selectors are chosen by the sender. If we cannot find yours we say we cannot confirm it, never that it is missing.</li>
            <li>If a DNS lookup fails or times out, the result says unknown. An unknown is never shown as a pass.</li>
            <li>It looks at one domain. Look-alike domains (yourbusiness.co instead of yourbusiness.com.au) and hacked mailboxes are separate problems.</li>
          </ul>
          <p>
            The lookups go from your browser to Cloudflare&rsquo;s DNS-over-HTTPS service, described in <a href="https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/" rel="noopener">Cloudflare&rsquo;s documentation</a>, using its <a href="https://developers.cloudflare.com/1.1.1.1/privacy/public-dns-resolver/" rel="noopener">public resolver</a>. We never receive the domain you type.
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
          <h2 id="h-cta">Want it fixed properly, without learning DNS?</h2>
          <p>
            The shop has two guides built from the same public-record method as this checker: a step-by-step DMARC and SPF setup guide and a short self-check checklist. Prices are in AUD and no GST is charged.
          </p>
          <div className="dmc-ctarow">
            <Link href="/products/dmarc-setup-guide" className="pe-btn pe-btn--gold pe-btn--lg">See the DMARC setup guide</Link>
            <Link href="/shop" className="pe-btn pe-btn--dark pe-btn--lg">Browse the shop</Link>
            <Link href="/scan" className="pe-btn pe-btn--dark pe-btn--lg">Free full security check</Link>
          </div>
          <p>
            Running a trade business? <Link href="/offers/scam-shield-for-tradies">Scam Shield for Tradies</Link> checks your domain every month and gives you a customer notice with your real bank details. For the wider privacy and compliance picture, see <Link href="/compliance">Privacy Act compliance</Link>.
          </p>
        </section>

        <section className="dmc-section dmc-sources" aria-labelledby="h-src">
          <h2 id="h-src">Sources</h2>
          <ul>
            <li><a href="https://www.rfc-editor.org/rfc/rfc7208" rel="noopener">RFC 7208: Sender Policy Framework (SPF)</a></li>
            <li><a href="https://www.rfc-editor.org/rfc/rfc6376" rel="noopener">RFC 6376: DomainKeys Identified Mail (DKIM) Signatures</a></li>
            <li><a href="https://www.rfc-editor.org/rfc/rfc7489" rel="noopener">RFC 7489: Domain-based Message Authentication, Reporting and Conformance (DMARC)</a></li>
            <li><a href="https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/" rel="noopener">Cloudflare: DNS over HTTPS, JSON format</a></li>
            <li><a href="https://support.google.com/a/answer/81126" rel="noopener">Google: email sender guidelines (SPF, DKIM and DMARC requirements for bulk senders)</a></li>
            <li><a href="https://www.scamwatch.gov.au/" rel="noopener">Scamwatch, Australian Government: report and learn about scams</a></li>
          </ul>
        </section>

        <p className="dmc-note">
          Built and maintained by Kyle Deligny, Brisbane (ABN 34 318 502 254). General information, not legal or security advice for your specific systems. Last reviewed 28 November 2026.
        </p>
      </div>
    </div>
  );
}
