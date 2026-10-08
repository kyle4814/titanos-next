import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import AnimatedButton from "@/components/AnimatedButton";
import { COURSES, getCourse, partsFor, partKey, coursePriceAud, allLessons, totalMinutes } from "@/lib/courses";
import links from "@/lib/courses/links.json";
import { formatAUD } from "@/lib/pricing";

export const dynamicParams = false;
export const generateStaticParams = () => COURSES.map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCourse(slug);
  if (!c) return {};
  return {
    title: `${c.title} (written course) | TITANOS`,
    description: c.tagline,
    alternates: { canonical: `https://titanos.tech/courses/${c.slug}` },
    robots: { index: true, follow: true },
  };
}

const h2 = { fontFamily: "var(--font-display), Georgia, serif", color: "var(--gold)", fontSize: "var(--fs-h3)", margin: "32px 0 14px" } as const;
const li = { color: "var(--text)", lineHeight: 1.7, marginBottom: 8 } as const;

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCourse(slug);
  if (!c) notFound();
  const open = new Set(partsFor(c).map(partKey));
  const price = coursePriceAud(c);
  const link = (links as Record<string, string>)[c.slug];
  const buy = link && link.startsWith("https://") ? link : null;
  const lessonCount = allLessons(c).length;
  return (
    <>
      <PageHero badge="WRITTEN COURSE" title={c.title} tagline={c.tagline} />
      <SectionReveal style={{ padding: "var(--space-8) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <p className="label-system" style={{ color: "var(--ice)" }}>
            {lessonCount} LESSONS · {c.worksheets.length} WORKSHEETS · QUIZ · CERTIFICATE · ABOUT {Math.round(totalMinutes(c) / 60)} HOURS · {price === null ? "PRICE TO BE CONFIRMED" : `${formatAUD(price)} ONE-OFF`}
          </p>
          <p style={{ color: "var(--text)", lineHeight: 1.8, margin: "16px 0" }}>{c.disclosure}</p>
          <h2 style={h2}>Who it is for</h2>
          <ul style={{ paddingLeft: 22 }}>{c.audience.map((a) => <li key={a} style={li}>{a}</li>)}</ul>
          <h2 style={h2}>What you will be able to do</h2>
          <ul style={{ paddingLeft: 22 }}>{c.outcomes.map((a) => <li key={a} style={li}>{a}</li>)}</ul>
          <h2 style={h2}>The outline</h2>
          {c.modules.map((m) => (
            <div key={m.title} style={{ marginBottom: 18 }}>
              <h3 style={{ color: "var(--ice)", marginBottom: 8 }}>{m.title}</h3>
              <ol style={{ paddingLeft: 22 }}>
                {m.lessons.map((l) => (
                  <li key={l.slug} style={li}>
                    {open.has(`lesson-${l.slug}`)
                      ? <Link href={`/courses/${c.slug}/${l.slug}`} style={{ color: "var(--ice)" }}>{l.title}</Link>
                      : l.title}
                    {" "}({l.minutes} min). {l.outcome}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <h2 style={h2}>Worksheets, quiz and certificate</h2>
          <ul style={{ paddingLeft: 22 }}>
            {c.worksheets.map((w) => (
              <li key={w.slug} style={li}>
                {open.has(`worksheet-${w.slug}`) ? <Link href={`/courses/${c.slug}/${w.slug}`} style={{ color: "var(--ice)" }}>{w.title}</Link> : w.title}. {w.blurb}
              </li>
            ))}
            <li style={li}>{c.quiz.questions.length}-question quiz, pass mark {c.quiz.passPct}%.</li>
            <li style={li}>A printable certificate of completion (a self-assessed record, not an accredited qualification).</li>
          </ul>
          <div style={{ marginTop: 32 }}>
            {buy
              ? <AnimatedButton href={buy}>GET THE FULL COURSE →</AnimatedButton>
              : <AnimatedButton href={`mailto:kyle@titanos.tech?subject=${encodeURIComponent(`Interest: ${c.title}`)}`}>TELL ME WHEN IT OPENS →</AnimatedButton>}
          </div>
          <p style={{ color: "var(--text)", marginTop: 24, lineHeight: 1.7 }}>
            Want it done with you instead? Run the <Link href="/scan" style={{ color: "var(--ice)" }}>free scan</Link> or <Link href="/contact" style={{ color: "var(--ice)" }}>book an audit call</Link>.
          </p>
        </div>
      </SectionReveal>
    </>
  );
}
