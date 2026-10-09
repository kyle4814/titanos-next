import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { withSeo } from "@/lib/seo";
import { getOffer, ineligible, CATALOG } from "@/lib/checkout/engine.mjs";
import CheckoutClient from "./client";

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = CATALOG.filter((o) => !ineligible(o)).map((o) => ({ slug: o.slug }));
  // Next export rejects an empty list; a placeholder (renders notFound) keeps the build valid.
  return slugs.length ? slugs : [{ slug: "_none" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const o = getOffer(slug);
  if (!o) return {};
  return withSeo(`/checkout/${slug}`, {
    title: `Customise and buy: ${o.name} | TITANOS`,
    description: "Choose your scope, make an offer, see the price update live, then pay securely with Stripe.",
    alternates: { canonical: `https://titanos.tech/checkout/${slug}` },
    robots: { index: false, follow: false },
  });
}

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = getOffer(slug);
  if (!o || ineligible(o)) notFound();
  return <CheckoutClient slug={slug} />;
}
