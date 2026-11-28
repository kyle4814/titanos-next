import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import GuideView from "@/components/integrations/GuideView";
import { getGuide } from "@/lib/integrations";

const g = getGuide("jobber");

export const metadata: Metadata = withSeo(`/integrations/${g.slug}`, {
  title: g.metaTitle,
  description: g.metaDescription,
  alternates: { canonical: `https://titanos.tech/integrations/${g.slug}` },
  robots: { index: true, follow: true },
});

export default function Page() {
  return <GuideView g={g} />;
}
