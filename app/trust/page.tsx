import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { PointCard, PointGrid, PointItem, StepBlock } from "@/components/w2e/Blocks";
import { TRUST_CLAIMS, TRUST_AS_OF, OSG1_LINE, STATE_MEANING, type TrustState } from "@/lib/trust-centre";

export const metadata: Metadata = {
  title: "Trust Centre · TITANOS",
  description: "Each security and privacy claim, with its evidence state: built and tested, planned, or open. Plain about what is not done yet.",
  alternates: { canonical: "https://titanos.tech/trust" },
  robots: { index: false, follow: false },
};

const ORDER: TrustState[] = ["BUILT_TESTED", "PLANNED", "OPEN"];
const LABEL: Record<TrustState, string> = { BUILT_TESTED: "Built and tested", PLANNED: "Planned", OPEN: "Open" };

export default function TrustPage() {
  return (
    <>
      <PageHero
        badge="TRUST CENTRE"
        title="What is true, what is planned, what is open"
        tagline="Every claim below carries its evidence state and a pointer to the evidence. Nothing here is an audit or a certification."
        sub={`Reviewed ${TRUST_AS_OF}. Demonstrations use SYNTHETIC data only.`}
      />
      <PointGrid>
        <PointItem span={6}>
          <PointCard point="The isolation review is open.">{OSG1_LINE}</PointCard>
        </PointItem>
        <PointItem span={6}>
          <PointCard point="Nothing here is an audit or a certification.">
            These are our own statements with pointers to our own evidence. No outside body has assessed them, and no demonstration here uses real customer data.
          </PointCard>
        </PointItem>
      </PointGrid>
      {ORDER.map((state) => {
        const rows = TRUST_CLAIMS.filter((c) => c.state === state);
        return (
          <section key={state} aria-label={LABEL[state]} data-state={state}>
            <PointGrid>
              <PointItem span={12}>
                <PointCard point={`${LABEL[state]} (${rows.length})`}>{STATE_MEANING[state]}</PointCard>
              </PointItem>
              {rows.map((c) => (
                <PointItem key={c.id} span={6}>
                  <PointCard point={c.claim}>
                    <strong>{state}.</strong> Evidence: {c.evidence.kind === "file" ? c.evidence.path : c.evidence.ref}. {c.evidence.detail}
                  </PointCard>
                </PointItem>
              ))}
            </PointGrid>
          </section>
        );
      })}
      <StepBlock text="Want the detail behind any line? Ask and we will show you the evidence." href="/contact" label="Ask a question" />
    </>
  );
}
