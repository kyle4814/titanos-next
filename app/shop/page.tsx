import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import SectionReveal from "@/components/SectionReveal";
import SectionHeading from "@/components/SectionHeading";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import OfferTile from "@/components/offers/OfferTile";
import { shopReader } from "@/lib/shop/reader";
import { formatAUD, formatMonthly } from "@/lib/pricing";
import type { GradedShelf } from "@/lib/shop/types";

const TITLE = "Shop: Ready to Buy, Checked Before You See It | TITANOS";
const DESC = "Every item in the shop is checked before it appears. Prices in AUD, no GST charged. Not on a shelf? Ask and we quote.";

export const metadata: Metadata = withSeo("/shop", {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://titanos.tech/shop" },
  openGraph: { title: TITLE, description: DESC, type: "website", url: "https://titanos.tech/shop" },
  robots: { index: true, follow: true },
});

function price(s: GradedShelf): string {
  if (s.priceAud === null || s.cadence === "quote" || s.cadence === "none") return "Quote before you pay";
  if (s.priceAud === 0) return "Free";
  return s.cadence === "month" ? formatMonthly(s.priceAud) : s.cadence === "per-seat-month" ? `${formatAUD(s.priceAud)}/seat/mo` : `${formatAUD(s.priceAud)} one-off`;
}

const PILL: Record<string, string> = { BUYABLE: "Available now", FREE_STEP: "Free first step open", QUOTE: "Instant quote" };

export default function Shop() {
  const shelves = shopReader.listShelves();
  const courses = shelves.filter((s) => s.kind === "course");
  const generator = shelves.filter((s) => s.kind === "generator");
  const rest = shelves.filter((s) => s.kind !== "course" && s.kind !== "generator");
  const grid = (list: GradedShelf[]) => (
    <div className="ox-grid">
      {list.map((s) => (
        <OfferTile key={s.id} href={s.href} name={s.name} pill={PILL[s.availability] ?? "Available"} body={s.bluf} price={price(s)} open feature={s.availability === "BUYABLE"} />
      ))}
    </div>
  );
  return (
    <>
      <PageHero
        badge="TITANOS · SHOP"
        title="Checked before you see it."
        tagline={`${shelves.length} items on the shelves, each one passed a check before it was listed.`}
        sub="Prices are in AUD and no GST is charged. Nothing is touched without your say, nobody is replaced, and your IT provider stays in charge."
      >
        <AnimatedButton href="/scan#request">START WITH THE FREE CHECK →</AnimatedButton>
      </PageHero>
      <SectionReveal>
        <SectionHeading title="Ready now" lead="Buy online or start with the free first step." />
        {grid(rest)}
      </SectionReveal>
      {courses.length > 0 && (
        <SectionReveal>
          <SectionHeading title="Courses" lead="Learn it once, do it yourself." />
          {grid(courses)}
        </SectionReveal>
      )}
      {generator.length > 0 && (
        <SectionReveal>
          <SectionHeading title="Built for your sector" lead="Pick the job, the sector and the country. You get a fixed quote first." />
          {grid(generator)}
        </SectionReveal>
      )}
      <SectionReveal>
        <SectionHeading title="Not on a shelf?" lead="Tell us what you need. If it is not listed we build it, check it, and send you a quote." />
        <AnimatedButton href="/contact">ASK FOR A QUOTE →</AnimatedButton>
      </SectionReveal>
    </>
  );
}
