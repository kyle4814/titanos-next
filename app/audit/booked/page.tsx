import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";

const META_TITLE = "You're Booked — Free AI Audit Call | Titanos";
const META_DESC = "Your free AI audit call is booked. Here's exactly what happens before we talk.";

export const metadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  robots: { index: false, follow: false },
};

export default function AuditBookedPage() {
  return (
    <>
      <PageHero
        badge="BOOKED"
        title="You're in the calendar."
        sub="A confirmation email is on its way from cal.com with the time and the video link. Here's what happens on my end before we talk."
      />

      <div className="divider-gold" />

      <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <SectionHeading title="Before we talk, I will have" />
          <ul style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.9, paddingLeft: 20 }}>
            <li>Looked at your website and industry, if you gave one</li>
            <li>Come with 2-3 starting ideas for what&apos;s worth automating in a business like yours</li>
            <li>Nothing scripted or generic — the call adjusts to whatever you actually tell me</li>
          </ul>
          <p style={{ color: "var(--text)", fontSize: "var(--fs-body)", lineHeight: 1.8, marginTop: 18 }}>
            The one thing to bring: the most repetitive, time-consuming part of running your
            business right now. That&apos;s the whole call.
          </p>
          <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 24 }}>
            Need to reschedule or cancel? Use the links in your confirmation email — or just email{" "}
            <a href="mailto:kyle@titanos.tech" style={{ color: "var(--gold)" }}>
              kyle@titanos.tech
            </a>{" "}
            directly.
          </p>
        </div>
      </SectionReveal>
    </>
  );
}
