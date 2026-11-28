import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withSeo, SITE } from "@/lib/seo";
import { INDUSTRY_PAGES, getIndustry, pagePath } from "@/lib/industryPages";
import IndustryView from "../_view/IndustryView";
import "@/components/home-redesign/home-redesign.css";
import "../../automation/automation.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return INDUSTRY_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getIndustry(slug);
  if (!p) return {};
  const path = pagePath(p);
  return withSeo(path, {
    title: p.title,
    description: p.description,
    alternates: { canonical: `${SITE}${path}` },
    openGraph: { title: p.title, description: p.description, type: "article", url: `${SITE}${path}` },
    robots: { index: true, follow: true },
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getIndustry(slug);
  if (!p) notFound();
  return <IndustryView p={p} />;
}
