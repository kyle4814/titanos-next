import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import { OpenLoop } from "@/components/FlexBlock";
import PricingGlance from "@/components/home/PricingGlance";
import { Hero, Metrics, Receipts, Systems, CaseStudy, Model, Trust, FindOffer } from "@/components/home-redesign/Sections";
import "@/components/home-redesign/home-redesign.css";

const baseMetadata: Metadata = {
  title: "Titanos | AI automation and Privacy Act compliance, Brisbane",
  description:
    "One operator finds the manual task eating your week and builds the system that does it. Free consultation, free security scan, fixed-price Privacy Act compliance.",
  alternates: { canonical: "https://titanos.tech/" },
  openGraph: {
    title: "Titanos | AI automation and Privacy Act compliance",
    description:
      "Free consultation and report, free security scan, fixed-price Privacy Act compliance. One operator, Brisbane, ABN 34 318 502 254.",
    url: "https://titanos.tech/",
    siteName: "Titanos",
    type: "website",
  },
};

export const metadata: Metadata = withSeo("/", baseMetadata);

// The homepage stays short: each long section lives on the page that owns its topic (components/home/moved/).
const GO_DEEPER = [
  { href: "/proof", title: "The proof", body: "The cost curve, the measured cards and the replayed build, each with its source." },
  { href: "/pricing", title: "Partnerships and prices", body: "Pick a partnership, see every door from free to enterprise, and test the cost of manual work with your own figures." },
  { href: "/how-it-works", title: "How it works", body: "Where the manual work quietly costs you, and the one path from first message to a running system." },
  { href: "/ai-delivery", title: "What we automate", body: "Leads, support, bookings, content, follow-up, reporting and admin." },
  { href: "/about", title: "Who builds it", body: "Privacy by Design, and the doctrine behind every delivery." },
  { href: "/learning-loop", title: "The learning loop", body: "Every turn of the loop leaves a receipt." },
];



export default function Home() {
  return (
    <>
      <Hero />
      <Metrics />
      <Receipts />
      <Systems />
      <CaseStudy />
      <Model />
      <Trust />
      <FindOffer />

      {/* More doors, prices and the open-loop close (kept from the previous homepage; scripts/test_home_pricing.mjs pins their order). */}
      <SectionReveal className="pe-more" style={{ padding: "var(--space-12) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault">
          <SectionHeading
            title="Everything else is one tap away"
            lead="The proof, the prices and the method each have their own page, so this one stays short. Every figure on them carries its source."
          />
          <nav aria-label="Go deeper" className="grid-doors" style={{ maxWidth: "var(--maxw-wide)", margin: "0 auto" }}>
            {GO_DEEPER.map((g) => (
              <a key={g.href} href={g.href} className="pe-door">
                <span className="pe-door__t">{g.title} →</span>
                <span className="pe-door__b">{g.body}</span>
              </a>
            ))}
          </nav>
        </div>
      </SectionReveal>

      <PricingGlance />

      <OpenLoop>You have seen the receipts. Would it be okay if I looked at your business the same way, free, and told you straight what I find? A no is welcome.</OpenLoop>
    </>
  );
}
