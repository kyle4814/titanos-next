import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import { redirect } from "next/navigation";

const baseMetadata: Metadata = {
  title: "Services | Titanos",
  alternates: { canonical: "https://titanos.tech/audit" },
  robots: { index: false, follow: true },
};

export const metadata: Metadata = withSeo("/services", baseMetadata);

export default function ServicesRedirect() {
  redirect("/audit");
}
