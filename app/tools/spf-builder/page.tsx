import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { faqPage, breadcrumbs } from "@/lib/jsonld";
import JsonLd from "@/components/JsonLd";
import SpfBuilder from "./SpfBuilder";
import { PROVIDERS } from "./spf";
import "@/components/home-redesign/home-redesign.css";
import "./spf-builder.css";

const PATH = "/tools/spf-builder";
const TITLE = "Free SPF Record Builder and Lookup Counter | TITANOS";
const DESC = "Free SPF record builder for Australian small business. Pick Google Workspace or Microsoft 365, get the record, and check it against the 10 DNS lookup limit.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
});

const FAQ = [
  { q: "What is an SPF record?", a: "An SPF record is one line of text in your domain's DNS that lists the services allowed to send email as your domain. Receiving mail systems check it and treat mail from anywhere else with suspicion. It is defined in RFC 7208." },
  { q: "What is the 10 lookup limit?", a: "RFC 7208 lets a receiver make at most 10 DNS-querying terms while checking one SPF record. The terms include, a, mx, ptr, exists and redirect each count one. ip4, ip6 and all cost nothing. Past 10, the check returns a permanent error and your mail can fail SPF." },
  { q: "Why does the counter say a minimum?", a: "An include points at another domain's SPF record, and that record can include more. The tool runs in your browser and does not query DNS, so it counts only the terms you wrote. The true total can be higher. If you are at 8 or more, check the nested records with your DNS host or IT provider." },
  { q: "Can I have two SPF records?", a: "No. A domain with two SPF records gets a permanent error. Merge every sender into one record. This is the most common mistake when a second service is added months after the first." },
  { q: "Should I use ~all or -all?", a: "Start with ~all (soft fail) while you check DMARC reports and find every sender. Move to -all (hard fail) once the list is complete. Microsoft recommends -all for Microsoft 365 domains that also run DKIM and DMARC." },
  { q: "Why do Xero and ServiceM8 have no include?", a: "We could not find an SPF include published by either, and we will not guess one: a wrong include can authorise strangers or break the record. Xero sends invoices from its own domain. ServiceM8 sends through your mail host if you use its Custom SMTP add-on. Check each provider's current help or ask their support." },
  { q: "Does this tool store or send my record?", a: "No. It runs in your browser. Nothing is sent to a server or saved." },
];

export default function Page() {
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "SPF record builder and lookup counter",
    url: `${SITE}${PATH}`,
    applicationCategory: "SecurityApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en-AU",
    description: DESC,
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
    publisher: { "@id": `${SITE}/#organization` },
  };
  return (
    <main className="spf">
      <JsonLd data={webApp} />
      <JsonLd data={faqPage(FAQ)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Free tools", path: "/tools" }, { name: "SPF builder", path: PATH }])} />
      <div className="spf-wrap">
        <nav className="spf-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/tools">Free tools</Link> / <span aria-current="page">SPF builder</span></nav>
        <header>
          <p className="spf-eyebrow">Free tool for Australian small business</p>
          <h1>SPF record builder and DNS lookup counter</h1>
          <p className="spf-lede">Pick the services that send email as your business and get one correct SPF record to paste into your DNS. The counter flags anything past the 10 lookup limit, the two-records mistake and a record that lets everyone send as you. It runs in your browser and nothing you type is sent or saved.</p>
        </header>

        <SpfBuilder />

        <section className="spf-sec">
          <h2>Where each include came from</h2>
          <p>We checked these on 29 November 2026. Where a provider does not publish an SPF include, the tool says so and adds nothing.</p>
          <ul>
            {PROVIDERS.map((p) => (
              <li key={p.id}><strong>{p.name}:</strong> {p.include ? <code>include:{p.include}</code> : "no include published that we could find"}. {p.note} <a href={p.source.url} rel="noopener noreferrer">{p.source.label}</a>.</li>
            ))}
          </ul>
        </section>

        <section className="spf-sec">
          <h2>How to publish the record</h2>
          <ol>
            <li>Find where your domain&apos;s DNS is managed. That is usually your domain registrar or web host.</li>
            <li>Look for an existing TXT record that starts with <code>v=spf1</code>. If there is one, replace it with the new record. Never add a second.</li>
            <li>Create or edit one TXT record on your domain (host field <code>@</code> or blank) and paste the record as the value.</li>
            <li>Wait for DNS to update, then send a test email to a free mailbox and read its headers for <code>spf=pass</code>.</li>
          </ol>
          <p>SPF is one of three checks. DKIM signs the message and DMARC says what to do when checks fail. To see all three for your domain, use the <Link href="/tools/email-spoofing-check">email spoofing check</Link>, and for the plain-English steps read the <Link href="/guides/email-security-small-business-australia">email security guide</Link>.</p>
        </section>

        <section className="spf-sec">
          <h2>If you are over 10 lookups</h2>
          <ul>
            <li><strong>Drop services you no longer use.</strong> Old newsletter and CRM includes are the usual cause.</li>
            <li><strong>Move bulk senders to a subdomain.</strong> Each subdomain has its own record and its own 10 lookups. Microsoft suggests this for services you do not control.</li>
            <li><strong>Use IP ranges for stable senders.</strong> ip4 and ip6 cost no lookups, but you must keep them current. Do not flatten Google or Microsoft: their addresses change.</li>
          </ul>
          <p>Source for the counting rules: <a href="https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure" rel="noopener noreferrer">Microsoft Learn, Set up SPF</a> and <a href="https://datatracker.ietf.org/doc/html/rfc7208#section-4.6.4" rel="noopener noreferrer">RFC 7208 section 4.6.4</a>.</p>
        </section>

        <section className="spf-sec">
          <h2>Questions owners ask</h2>
          {FAQ.map((f) => (
            <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </section>

        <aside className="spf-cta" aria-label="Next step">
          <h2>Want your email domain checked end to end?</h2>
          <p>The free spoofing check reads your public SPF, DKIM and DMARC records. The DMARC and SPF setup guide walks through the rest. A no is welcome.</p>
          <div>
            <Link href="/tools/email-spoofing-check" className="pe-btn pe-btn--gold pe-btn--lg">Check my domain</Link>
            <Link href="/products/dmarc-setup-guide" className="pe-btn pe-btn--dark pe-btn--lg">DMARC and SPF setup guide</Link>
          </div>
          <p className="spf-small">Built by Kyle Deligny, Brisbane. ABN 34 318 502 254. General information, not security advice for your specific setup.</p>
        </aside>
      </div>
    </main>
  );
}
