import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import SectionReveal from "@/components/SectionReveal";
import BlogBody from "@/components/BlogBody";
import CourseQuiz from "@/components/courses/CourseQuiz";
import CertificateCard from "@/components/courses/CertificateCard";
import { COURSES, getCourse, partsFor, readPart, allLessons, type Course } from "@/lib/courses";

export const dynamicParams = false;
export function generateStaticParams() {
  return COURSES.flatMap((c) => partsFor(c).map((p) => ({ slug: c.slug, part: p.slug })));
}

function resolve(c: Course, part: string) {
  const p = partsFor(c).find((x) => x.slug === part);
  if (!p) return null;
  const lesson = p.kind === "lesson" ? allLessons(c).find((l) => l.slug === part) : undefined;
  const sheet = p.kind === "worksheet" ? c.worksheets.find((w) => w.slug === part) : undefined;
  const title = lesson?.title ?? sheet?.title ?? (p.kind === "quiz" ? "End-of-course quiz" : "Certificate of completion");
  return { p, lesson, sheet, title };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; part: string }> }): Promise<Metadata> {
  const { slug, part } = await params;
  const c = getCourse(slug);
  const r = c && resolve(c, part);
  if (!c || !r) return {};
  return {
    title: `${r.title} | TITANOS course`,
    description: r.lesson?.outcome ?? r.sheet?.blurb ?? c.tagline,
    alternates: { canonical: `https://titanos.tech/courses/${c.slug}/${part}` },
    robots: { index: r.p.kind === "lesson" || r.p.kind === "worksheet", follow: true },
  };
}

export default async function CoursePartPage({ params }: { params: Promise<{ slug: string; part: string }> }) {
  const { slug, part } = await params;
  const c = getCourse(slug);
  const r = c && resolve(c, part);
  if (!c || !r) notFound();
  const order = partsFor(c);
  const i = order.findIndex((x) => x.slug === part);
  const next = order[i + 1];
  const nextTitle = next && (allLessons(c).find((l) => l.slug === next.slug)?.title ?? c.worksheets.find((w) => w.slug === next.slug)?.title ?? (next.kind === "quiz" ? "End-of-course quiz" : "Certificate"));
  return (
    <>
      <PageHero badge={r.p.kind.toUpperCase()} title={r.title} tagline={r.lesson?.outcome ?? r.sheet?.blurb ?? c.title} />
      <SectionReveal style={{ padding: "var(--space-8) 20px", position: "relative", zIndex: 2 }}>
        <div className="container-vault" style={{ maxWidth: "var(--maxw-prose)", margin: "0 auto" }}>
          <p style={{ marginBottom: 20 }}><Link href={`/courses/${c.slug}`} style={{ color: "var(--ice)" }}>Back to {c.title}</Link></p>
          {(r.p.kind === "lesson" || r.p.kind === "worksheet") && <BlogBody blocks={readPart(c, r.p)} />}
          {r.p.kind === "quiz" && <CourseQuiz questions={c.quiz.questions} passPct={c.quiz.passPct} certificateHref={`/courses/${c.slug}/certificate`} />}
          {r.p.kind === "certificate" && <CertificateCard title={c.certificateTitle} course={c.title} disclosure={c.disclosure} />}
          <p className="label-system" style={{ color: "var(--ice)", marginTop: 40, lineHeight: 1.7 }}>{c.disclosure}</p>
          {next
            ? <p style={{ marginTop: 24 }}><Link href={`/courses/${c.slug}/${next.slug}`} style={{ color: "var(--gold)" }}>Next: {nextTitle} →</Link></p>
            : <p style={{ marginTop: 24, color: "var(--text)" }}>Want the full course? <Link href={`/courses/${c.slug}`} style={{ color: "var(--gold)" }}>See the outline</Link>.</p>}
        </div>
      </SectionReveal>
    </>
  );
}
