// Sections moved off the homepage on 2026-11-10 (the phone page was 37,141 px tall, about 41 screens at 412 x 915).
// The JSX and copy are unchanged from app/page.tsx at d6c7c57ad; each one now renders on the page that owns its topic:
//   ProofCharts      -> /proof         (cost curve, the measured flex cards, the market ceiling)
//   PartnershipStack -> /pricing       (tier quiz + retainer cards, every door, the ROI estimator)
//   HowSections      -> /how-it-works  (BLUF + pillars, the four costs, the journey)
//   WhatWeBuild      -> /ai-delivery
//   OperatorSections -> /about         (Privacy by Design, the doctrine behind the delivery)
// The homepage keeps the hero, trust strip, free consultation, front-loaded answers and a link to each of these.
// This file: WhatWeBuild.
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import BentoGrid from "@/components/home/BentoGrid";

const WHAT_WE_BUILD = [
  { title: "Lead gen & outreach", body: "Finds and follows up with the customers you're currently missing." },
  { title: "Customer service & support", body: "Answers the same ten questions your inbox gets every day, instantly." },
  { title: "Appointments & booking", body: "Books, reminds, and reschedules without anyone touching a calendar." },
  { title: "Content & social media", body: "Keeps your channels active without you writing a single post." },
  { title: "Sales & follow-up", body: "Chases every quote and lead until someone answers." },
  { title: "Data & reporting", body: "Your numbers, pulled from the systems you already run, before Monday's meeting." },
  { title: "Admin & data entry", body: "Invoicing, onboarding, documents. The repetitive work, gone." },
];

export function WhatWeBuild() {
  return (
    <>
    {/* ═══ WHAT WE BUILD ═══ */}
    <SectionReveal style={{ padding: "var(--space-20) 20px", position: "relative", zIndex: 2 }}>
      <div className="container-vault">
        <SectionHeading title="If it's repetitive, we automate it." />
        <BentoGrid items={WHAT_WE_BUILD} />
      </div>
    </SectionReveal>
    </>
  );
}
