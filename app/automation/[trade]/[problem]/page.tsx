import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withSeo, SITE } from "@/lib/seo";
import { TRADE_PROBLEMS, getTradeProblem, pagePath } from "@/lib/tradeProblems";
import TradeProblemView from "../../_view/TradeProblemView";
import "@/components/home-redesign/home-redesign.css";
import "../../automation.css";

export const dynamicParams = false;

export function generateStaticParams() {
  return TRADE_PROBLEMS.map((p) => ({ trade: p.trade, problem: p.problem }));
}

export async function generateMetadata({ params }: { params: Promise<{ trade: string; problem: string }> }): Promise<Metadata> {
  const { trade, problem } = await params;
  const p = getTradeProblem(trade, problem);
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

export default async function Page({ params }: { params: Promise<{ trade: string; problem: string }> }) {
  const { trade, problem } = await params;
  const p = getTradeProblem(trade, problem);
  if (!p) notFound();
  return <TradeProblemView p={p} />;
}
