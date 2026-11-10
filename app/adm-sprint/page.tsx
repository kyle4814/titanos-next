import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import AdmOffer from "@/components/AdmOffer";
import { ADM_ROUTE, ADM_TITLE, ADM_DESC } from "@/lib/admOffer";

const baseMetadata: Metadata = {
  title: ADM_TITLE,
  description: ADM_DESC,
  alternates: { canonical: `https://titanos.tech${ADM_ROUTE}` },
  openGraph: { title: ADM_TITLE, description: ADM_DESC, type: "website", url: `https://titanos.tech${ADM_ROUTE}`, images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: ADM_TITLE, description: ADM_DESC, images: ["/og-image.png"] },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo(ADM_ROUTE, baseMetadata);

export default function AdmSprintPage() {
  return <AdmOffer />;
}
