import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import ContactButtons from "@/components/ContactButtons";
import { SITE, CONTACT } from "@/lib/config";
import { Inscription, SystemLabel } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import W2c from "@/components/w2c/W2c";
import "@/components/g4/g4.css";

const META_TITLE = "Contact · Kyle Deligny · TITANOS";
const META_DESC =
  "Message Kyle on Telegram or email kyle@titanos.tech. Solo operator, Brisbane, Australia. ABN 34 318 502 254.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/contact" },
  openGraph: { title: META_TITLE, description: META_DESC },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/contact", baseMetadata);

export default function ContactPage() {
  return (
    <W2c>
     <div className="g4">
      <PageHero
        badge="CONTACT"
        title="Talk to Kyle directly."
        sub="No form maze and no ticket queue. Book a call or message Kyle directly, and you deal with the same person who does the work."
        trustLine={<>ABN 34 318 502 254 · Brisbane, Australia</>}
      />
      <Bluf>
        Book a call or message Kyle. You deal with the person who does the work, and the first conversation and your report are free.
      </Bluf>
      <Analogy k="healthcheck" />

      <SectionReveal className="pe-section">
        <div className="pe-page--narrow">
          <FlexNumber f={FLEX.fleetJobs} />
          <p className="pe-muted" style={{ lineHeight: 1.7, marginTop: 14 }}>
            Method: counted from our own job log over 24 hours. That is the machine. The person who answers your message is Kyle. Before you
            ask: the first look uses public records only, nothing of yours is touched, nobody is replaced, your IT provider stays in
            charge, and the first conversation and report cost nothing.
          </p>
        </div>
      </SectionReveal>

      <OpenLoop>So how do you actually reach him?</OpenLoop>

      <section aria-label="Message Kyle" className="pe-section g4-center">
        <div className="w2c-contact">
          <ContactButtons heading="Book a call for a free consultation and report, or message Kyle to ask a quick question or just say hi. Whichever is easiest." />
        </div>
      </section>

      <section aria-label="Direct line" className="pe-section">
        <div className="pe-page--narrow">
          <Inscription label="One person.">
            There is no queue and no ticket number.
            <br />
            <span style={{ color: "var(--pe-gold)" }}>Message Kyle and Kyle messages back.</span>
          </Inscription>
        </div>
      </section>

      <SectionReveal className="pe-section g4-center">
        <div className="pe-page--narrow">
          <div className="pe-card pe-card--gold pe-card--pad w2c-card" style={{ marginBottom: 24 }}>
            <SystemLabel style={{ marginBottom: 16 }}>Direct contact · no form, no gatekeeper</SystemLabel>
            <div className="g4-kv">
              <p>
                <strong>Email:</strong> <a href={`mailto:${SITE.KYLE_EMAIL}`}>{SITE.KYLE_EMAIL}</a>
              </p>
              <p>
                <strong>ABN:</strong> 34 318 502 254 ·{" "}
                <a href="https://abr.business.gov.au/ABN/View?id=34318502254" target="_blank" rel="noopener noreferrer">
                  verify on the ABR ↗
                </a>
              </p>
            </div>
          </div>

          <p className="pe-muted" style={{ margin: 0 }}>
            Would it be okay if you messaged Kyle for a free consultation and a free report on your business? No obligation, no pitch deck, and a no is welcome.
          </p>
        </div>
      </SectionReveal>
      <FrontLoad/>
     </div>
    </W2c>
  );
}
