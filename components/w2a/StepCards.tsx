import { BentoGrid, BentoItem, GlowCard } from "@/components/house";
import SectionReveal from "@/components/SectionReveal";
import "./w2a.css";

export type Step = { title: string; body?: string };

/** Numbered step cards in the house bento. Text is passed through unchanged. */
export default function StepCards({ steps, label, span = 4 }: { steps: Step[]; label: string; span?: 4 | 6 }) {
  return (
    <SectionReveal className="w2a-wrap">
      <div>
        <div role="group" aria-label={label}>
          <BentoGrid>
            {steps.map((s) => (
              <BentoItem key={s.title} span={span}>
                <GlowCard className="w2a-step">
                  <span className="w2a-step__n" aria-hidden="true" />
                  <h2>{s.title}</h2>
                  {s.body ? <p>{s.body}</p> : null}
                </GlowCard>
              </BentoItem>
            ))}
          </BentoGrid>
        </div>
      </div>
    </SectionReveal>
  );
}
