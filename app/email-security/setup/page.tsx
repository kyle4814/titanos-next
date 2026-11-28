import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import { HUB, PROVIDERS, ROLLOUT, providerPath, DMARC_SETUP_BASE } from "@/lib/dmarcSetup";
import "@/components/home-redesign/home-redesign.css";
import { Byline, Crumbs, Cta, FaqList, Rollout, Schema, Sources, Verify, articleLd, crumbLd, faqPage, s } from "./_parts";

export const metadata: Metadata = withSeo(DMARC_SETUP_BASE, {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `https://titanos.tech${DMARC_SETUP_BASE}` },
  openGraph: { title: HUB.title, description: HUB.description, type: "article" },
  robots: { index: true, follow: true },
});

export default function SetupHub() {
  return (
    <>
      <Schema
        items={[
          articleLd({ path: DMARC_SETUP_BASE, headline: HUB.h1, description: HUB.description }),
          faqPage(HUB.faq),
          crumbLd([{ name: "Home", path: "/" }, { name: "SPF, DKIM and DMARC setup", path: DMARC_SETUP_BASE }]),
        ]}
      />
      <main className={s.shell}>
        <div className={s.wrap}>
          <Crumbs trail={[{ name: "Home", path: "/" }, { name: "SPF, DKIM and DMARC setup" }]} />
          <p className={s.kicker}>Email security setup</p>
          <h1 className={s.h1}>{HUB.h1}</h1>
          <Byline />
          <p className={s.bluf}>
            Pick the place your domain is registered or your email is hosted, and follow its guide. Each one gives the exact name, type and value to enter for SPF, DKIM and DMARC, links the provider&apos;s own help pages, and uses the same safe rollout from p=none to reject.
          </p>
          <p className={s.p}>
            SPF, DKIM and DMARC are three DNS records that together tell the world which servers may send email as your domain, prove each message was not altered, and say what to do with mail that fails. Without them, anyone can send an email that shows your business name in the From line, and receivers have little reason to refuse it. Setting them up is a half-day job for most small businesses. The hard part is not the idea, it is the specific screen: what to type in the name box, whether a record already exists, and which panel your nameservers actually read.
          </p>

          <section className={s.sec} aria-labelledby="pick">
            <h2 id="pick">Which guide do I need?</h2>
            <p className={s.p}>Two questions decide it. First, who hosts your DNS? Look at the nameservers on your domain: whoever they belong to is where the records go, even if you bought the domain somewhere else. Second, who runs your mailboxes? That decides the values: Microsoft 365 and Google Workspace each create your DKIM key and tell you your SPF include. You often need two guides: one for where to type the records and one for what to type.</p>
            <ul className={s.cards}>
              {PROVIDERS.map((p) => (
                <li key={p.slug} className="pe-card">
                  <Link href={providerPath(p.slug)} className={s.cardlink}>
                    <span className={s.cardgroup}>{p.group}</span>
                    <span className={s.cardname}>{p.name}</span>
                    <span className={s.carddesc}>{p.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={s.sec} aria-labelledby="order">
            <h2 id="order">The order that keeps your email flowing</h2>
            <ol className={s.list}>
              <li><strong>List your senders.</strong> Your mail platform, plus every other tool that sends as you: invoicing, bookings, newsletters, the website contact form, a CRM.</li>
              <li><strong>SPF.</strong> One TXT record on the root of the domain listing those senders. One record only: two SPF records make SPF fail.</li>
              <li><strong>DKIM.</strong> Your mail platform creates the key and you publish it. Microsoft 365 uses two CNAME records; Google Workspace uses one TXT record.</li>
              <li><strong>DMARC at p=none.</strong> A TXT record named _dmarc with a reporting address. It changes nothing for your mail and starts the reports. GoDaddy, Google and Microsoft all put DMARC after SPF and DKIM.</li>
              <li><strong>Read the reports for about a month,</strong> fix any legitimate sender that fails, then tighten the policy in stages.</li>
            </ol>
            <p className={s.p}>
              The {ROLLOUT.length} stages are laid out in the timeline further down. Choosing a tool to read the reports? See <Link href="/email-security/compare">DMARC tools compared</Link>. Primary specifications, for the curious, are linked at the foot of the page: SPF is RFC 7208, DKIM is RFC 6376 and DMARC is RFC 7489.
            </p>
          </section>

          <section className={s.sec} aria-labelledby="mistakes">
            <h2 id="mistakes">The five mistakes we see most</h2>
            <ul className={`${s.list} ${s.ul}`}>
              <li>Typing the full hostname (_dmarc.yourbusiness.com.au) into a box that already adds the domain.</li>
              <li>Editing the registrar&apos;s DNS when the nameservers point to Cloudflare, a web host or Microsoft.</li>
              <li>Adding a second SPF record instead of editing the first.</li>
              <li>Publishing p=reject on day one and losing the invoice emails.</li>
              <li>Pointing reports at a personal inbox that is then flooded with daily XML attachments.</li>
            </ul>
          </section>

          <Rollout />
          <Verify />
          <FaqList items={HUB.faq} />
          <Sources list={[]} />
          <Cta />
        </div>
      </main>
    </>
  );
}
