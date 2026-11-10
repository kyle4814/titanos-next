import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import { HEADLINE, WHO, DECLARATION_DATE, DEFAULT_TAG } from "@/lib/declaration";
import { Achievements, Capability, Prices, CaseList, Method, CourseCards, PdfButton, Appendix } from "@/components/declaration/Parts";
import SubscribeForm from "@/components/declaration/SubscribeForm";
import s from "@/components/declaration/declaration.module.css";

const TITLE = "The final business declaration | TITANOS";
const DESC = "What TITANOS has built, what it cost, how it is tested and secured, and how to do the same. Free to read, with a downloadable PDF and sources for every number.";

export const metadata: Metadata = withSeo("/declaration", {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://titanos.tech/declaration" },
  openGraph: { title: TITLE, description: DESC, type: "website", url: "https://titanos.tech/declaration", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og-image.png"] },
  robots: { index: true, follow: true },
});

export default function DeclarationPage() {
  return (
    <article className={s.wrap} style={{ padding: "var(--space-20, 80px) 16px var(--space-16, 64px)", position: "relative", zIndex: 2 }}>
      <p className={s.eyebrow}>Declaration · {DECLARATION_DATE}</p>
      <h1 className={s.title}>{HEADLINE}</h1>
      {WHO.map((w) => <p key={w} className={s.p}>{w}</p>)}
      <div className={s.row}><PdfButton /><a className={`${s.btn} ${s.btn2}`} href="#daily-artifacts">Join the mailing list</a></div>

      <h2 className={s.h2} id="achievements">Key achievements</h2>
      <Achievements />

      <h2 className={s.h2} id="capability">AI engineering capability</h2>
      <Capability />

      <h2 className={s.h2} id="prices">Subscriptions and prices</h2>
      <Prices />

      <h2 className={s.h2} id="case-studies">Case studies</h2>
      <CaseList />

      <h2 className={s.h2} id="how">How we do it</h2>
      <Method />

      <h2 className={s.h2} id="courses">Courses</h2>
      <CourseCards />

      <h2 className={s.h2} id="daily-artifacts">Daily artifacts</h2>
      <p className={s.p}>One short, useful artifact a day from the build: a number, a method, a template or a lesson, with the source attached.</p>
      <SubscribeForm tag={DEFAULT_TAG} source="declaration-page" />

      <h2 className={s.h2} id="appendix">Appendix: sources for every number</h2>
      <Appendix />
      <div className={s.row}><PdfButton secondary /></div>
    </article>
  );
}
