import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import s from "@/components/w2b/w2b.module.css";
import { NextStep, jsonLd } from "@/components/SiteBlocks";

export const metadata: Metadata = {
  title: "FAQ · TITANOS",
  description: "Straight answers: who we are, what we touch, what it costs, and who stays in charge.",
  alternates: { canonical: "https://titanos.tech/faq" },
  robots: { index: true, follow: true },
};

const QA: [string, string][] = [
  ["Do you touch my systems?", "No. The first reading uses public records only, such as your public DNS and website."],
  ["Does anyone get replaced?", "No. Your IT provider and your team stay in charge. The aim is to hand hours back."],
  ["What does the first step cost?", "The free scan costs nothing and asks for no login."],
  ["Where do your numbers come from?", "Each number carries a label (measured, modelled, estimate and so on) and a source you can open."],
  ["What if you have no number for my sector?", "Then we say UNKNOWN on the page and explain what would measure it."],
  ["Who runs this?", "One operator, Kyle Deligny, in Brisbane. See the about page for the ABN."],
];

export default function FaqPage() {
  return (
    <>
      {jsonLd({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: QA.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      })}
      <PageHero badge="FAQ" title="Straight answers before you ask" />
      <SectionReveal>
        <div className={s.wrap}>
          <div className={s.faq}>
            {QA.map(([q, a]) => (
              <details key={q} className={s.item}>
                <summary className={s.q}>{q}</summary>
                <p className={s.a}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </SectionReveal>
      <NextStep text="Anything we missed? Ask and we will answer." href="/contact" label="Ask a question" />
    </>
  );
}
