import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";

const baseMetadata: Metadata = {
  title: "Services | Titanos",
  alternates: { canonical: "https://titanos.tech/audit" },
  robots: { index: false, follow: true },
};

export const metadata: Metadata = withSeo("/services", baseMetadata);

// Static export: a server-side redirect() renders a client-side error shell (layout shift 0.5 to 0.9 measured
// 2026-10-08). A plain meta refresh with a visible link is instant, shift-free and works without JavaScript.
export default function ServicesRedirect() {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24 }}>
      <meta httpEquiv="refresh" content="0; url=/audit" />
      <p>
        Taking you to the <a href="/audit">audit page</a>.
      </p>
    </main>
  );
}
