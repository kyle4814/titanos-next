/**
 * Wave 2e polished twins of the SiteBlocks used by /courses and /security.
 * Same props, same copy; house kit surfaces, a 62ch measure, zero client JS of their own.
 */
import type { ReactNode } from "react";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { GlowCard, BentoGrid, BentoItem } from "@/components/house";
import type { Fact } from "@/lib/site-data";
import s from "./blocks.module.css";

export function PointCard({ point, children }: { point: string; children?: ReactNode }) {
  return (
    <GlowCard as="article" className={s.point}>
      <h2>{point}</h2>
      {children && <p>{children}</p>}
    </GlowCard>
  );
}

/** A set of Block-equivalents as a bento: wide card first, the rest beneath. */
export function PointGrid({ children }: { children: ReactNode }) {
  return (
    <SectionReveal className={s.sec}>
      <div className={s.wrap}>
        <BentoGrid>{children}</BentoGrid>
      </div>
    </SectionReveal>
  );
}

export function PointItem({ span = 6, children }: { span?: 4 | 6 | 12; children: ReactNode }) {
  return (
    <BentoItem span={span} style={{ padding: 0 }}>
      {children}
    </BentoItem>
  );
}

export function StatBlock({ fact, heading = "The biggest true number" }: { fact: Fact; heading?: string }) {
  return (
    <SectionReveal className={s.sec}>
      <div className={s.wrap}>
        <GlowCard as="article" className={s.stat}>
          <p className={s.kicker}>{heading.toUpperCase()}</p>
          <p className={s.statValue}>{fact.value}</p>
          <p data-claim-label={fact.label} className={s.label}>
            {fact.label}
          </p>
          <p className={s.note}>{fact.note}</p>
          {fact.source && (
            <p className={s.source}>
              Source: {fact.sourceUrl ? <a href={fact.sourceUrl} rel="noopener noreferrer">{fact.source}</a> : fact.source}
            </p>
          )}
        </GlowCard>
      </div>
    </SectionReveal>
  );
}

export function StepBlock({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <SectionReveal className={s.sec}>
      <div className={s.step}>
        <h2>{text}</h2>
        <p>Would it be okay if we showed you? A no is welcome.</p>
        <AnimatedButton href={href}>{label}</AnimatedButton>
      </div>
    </SectionReveal>
  );
}
