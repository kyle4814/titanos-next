import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { Block, NextStep } from "@/components/SiteBlocks";

export const metadata: Metadata = {
  title: "Courses · TITANOS",
  description: "Courses are not on sale yet. Here is what is true today and the free way to learn from us now.",
  alternates: { canonical: "https://titanos.tech/courses" },
  robots: { index: true, follow: true },
};

export default function CoursesPage() {
  return (
    <>
      <PageHero badge="COURSES" title="There are no courses on sale yet" tagline="We would rather tell you than sell you a placeholder." />
      <Block point="Today the best way to learn from us is free.">
        The blog and the free scan show the method on a real domain, which is the whole lesson.
      </Block>
      <Block point="When a course exists, it will say what it teaches, what it costs, and who it is for.">
        Until then this page stays honest and short.
      </Block>
      <NextStep text="Read how we work, with receipts." href="/blog" label="Read the blog" />
    </>
  );
}
