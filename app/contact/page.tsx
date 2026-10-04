import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import ContactButtons from "@/components/ContactButtons";
import { SITE, CONTACT } from "@/lib/config";
import { Inscription, SystemLabel } from "@/components/Myth";
import { Bluf, Analogy, Pillars, FrontLoad, FreeStart } from "@/components/SalesKit";

const META_TITLE = "Contact · Kyle Deligny · TITANOS";
const META_DESC =
  "Message Kyle on Telegram, call 0414 244 544, or email kyle@titanos.tech. Solo operator, Brisbane, Australia. ABN 34 318 502 254.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/contact" },
  openGraph: { title: META_TITLE, description: META_DESC },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        badge="CONTACT"
        title="Talk to Kyle directly."
        sub="No contact form maze, no booking system, no support ticket queue. Message or call Kyle directly. You'll hear back from the same person who does the work."
        trustLine={<>ABN 34 318 502 254 · Brisbane, Australia</>}
      />
      <Bluf>
        Message or call Kyle. You hear back from the person who does the work, and the first conversation and your report are free.
      </Bluf>
      <Analogy k="healthcheck" />

      <section aria-label="Message or call Kyle" style={{ padding: "0 20px var(--space-10)", position: "relative", zIndex: 2, textAlign: "center" }}>
        <ContactButtons heading="Book your free consultation and report, ask a quick question, or just say hi. Whichever is easiest." />
      </section>

      <div className="divider-gold" />

      <section aria-label="Direct line" style={{ padding: "0 20px var(--space-8)", position: "relative", zIndex: 2 }}>
        <Inscription label="One phone. One person.">
          There is no queue and no ticket number.
          <br />
          <span style={{ color: "var(--gold)" }}>Message Kyle and Kyle messages back.</span>
        </Inscription>
      </section>

      <SectionReveal style={{ padding: "var(--space-16) 20px var(--space-20)", position: "relative", zIndex: 2, textAlign: "center" }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "28px 26px",
              marginBottom: 24,
            }}
          >
            <SystemLabel style={{ marginBottom: 16 }}>Direct contact · no form, no gatekeeper</SystemLabel>
            <p style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", margin: "0 0 16px" }}>
              <strong>Phone:</strong>{" "}
              <a href={CONTACT.TEL_HREF} style={{ color: "var(--gold)" }}>
                {CONTACT.PHONE_DISPLAY}
              </a>{" "}
              ({CONTACT.PHONE_INTL})
            </p>
            <p style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", margin: "0 0 16px" }}>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${SITE.KYLE_EMAIL}`} style={{ color: "var(--gold)" }}>
                {SITE.KYLE_EMAIL}
              </a>
            </p>
            <p style={{ color: "var(--ice)", fontSize: "var(--fs-lg)", margin: 0 }}>
              <strong>ABN:</strong> 34 318 502 254 ·{" "}
              <a
                href="https://abr.business.gov.au/ABN/View?id=34318502254"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--gold)" }}
              >
                verify on the ABR ↗
              </a>
            </p>
          </div>

          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", margin: 0 }}>
            Want a free consultation and a free report on your business? Just message Kyle. No obligation, no pitch deck, and a no is welcome.
          </p>
        </div>
      </SectionReveal>
      <FrontLoad/>
    </>
  );
}
