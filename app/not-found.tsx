import type { Metadata } from "next";
import Link from "next/link";
import { OmegaSeal } from "@/components/Myth";
import "./proof/proof-page.css";

// One robots tag: the root layout's "index, follow" must not sit beside the 404's noindex.
export const metadata: Metadata = { title: "Page not found | TITANOS", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <div className="pe-notfound">
      <OmegaSeal caption="This edge of the system has nothing behind it." />
      <p className="pe-notfound__code">Error 404</p>
      <h1>There&apos;s nothing built here.</h1>
      <p className="pe-notfound__body">
        The page you were looking for doesn&apos;t exist, or was retired. Nothing to fix on
        your end, just a wrong turn.
      </p>
      <Link href="/" aria-label="Return to titanos.tech home" className="pe-btn pe-btn--gold pe-btn--lg">
        Return to titanos.tech →
      </Link>
    </div>
  );
}
