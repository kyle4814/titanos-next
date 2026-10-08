/**
 * Course catalogue: reads content/courses/<slug>/ at build time (static export, server side only).
 * PREVIEW BUILD (default): outline, lesson 1 and worksheet 1 of each course are public (value first, CT5).
 * FULL BUILD (COURSES_FULL=1): every lesson, worksheet, the quiz and the certificate page exist. Going live with the full
 * pages, and the payment links, sit on Kyle's batch card (GATE1/GATE4); nothing here charges or publishes by itself.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseMdx } from "./mdx";
import type { ContentBlock } from "@/lib/blog";
import { COURSE_PRICES_AUD } from "./prices";

export type CourseLesson = { slug: string; title: string; outcome: string; minutes: number };
export type CourseModule = { title: string; lessons: CourseLesson[] };
export type QuizQuestion = { q: string; options: string[]; answer: number; why: string };
export type Course = {
  slug: string; title: string; tagline: string; audience: string[]; offerSlug: string; outcomes: string[];
  modules: CourseModule[]; worksheets: { slug: string; title: string; blurb: string }[];
  quiz: { passPct: number; questions: QuizQuestion[] }; disclosure: string; certificateTitle: string;
};

const ROOT = join(process.cwd(), "content", "courses");
export const FULL_BUILD = process.env.COURSES_FULL === "1";

export const COURSES: Course[] = existsSync(ROOT)
  ? readdirSync(ROOT, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(ROOT, d.name, "course.json")))
      .map((d) => JSON.parse(readFileSync(join(ROOT, d.name, "course.json"), "utf8")) as Course)
      .sort((a, b) => a.slug.localeCompare(b.slug))
  : [];

export const getCourse = (slug: string) => COURSES.find((c) => c.slug === slug);
export const allLessons = (c: Course) => c.modules.flatMap((m) => m.lessons);
export const coursePriceAud = (c: Course): number | null => COURSE_PRICES_AUD[c.slug] ?? null;
export const totalMinutes = (c: Course) => allLessons(c).reduce((n, l) => n + l.minutes, 0);

export type Part = { kind: "lesson" | "worksheet" | "quiz" | "certificate"; slug: string };
export const partKey = (p: Part) => (p.kind === "quiz" || p.kind === "certificate" ? p.kind : `${p.kind}-${p.slug}`);

/** Every part that exists in this build (preview build: first lesson and first worksheet only). */
export function partsFor(c: Course): Part[] {
  const lessons = allLessons(c).map((l) => ({ kind: "lesson" as const, slug: l.slug }));
  const sheets = c.worksheets.map((w) => ({ kind: "worksheet" as const, slug: w.slug }));
  if (!FULL_BUILD) return [...lessons.slice(0, 1), ...sheets.slice(0, 1)];
  return [...lessons, ...sheets, { kind: "quiz" as const, slug: "quiz" }, { kind: "certificate" as const, slug: "certificate" }];
}

export function readPart(c: Course, p: Part): ContentBlock[] {
  const dir = p.kind === "lesson" ? "lessons" : "worksheets";
  return parseMdx(readFileSync(join(ROOT, c.slug, dir, `${p.slug}.mdx`), "utf8"));
}
