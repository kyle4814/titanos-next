import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Block } from "@/components/SiteBlocks";
import JsonLd from "@/components/JsonLd";
import { dataset } from "@/lib/jsonld";
import { longDate } from "@/lib/provenance";
import od from "@/lib/site-data/opendata.json";

const META_TITLE = "Open data: the Sector Index and the claims ledger | TITANOS";
const META_DESC = "The numbers behind the Sector Index and the Proof Wall as plain JSON and CSV, each row with its label, source and date.";

export const metadata: Metadata = withSeo("/open-data", {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/open-data" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/open-data" },
  robots: { index: true, follow: true },
});

export default function OpenData() {
  return (
    <>
      {od.datasets.map((d) => (
        <JsonLd
          key={d.id}
          data={dataset({ name: d.title, description: d.about, path: "/open-data", files: [{ url: d.file, format: "application/json" }, { url: d.csv, format: "text/csv" }], dateModified: od.compiled, licenceNote: od.licence })}
        />
      ))}
      <PageHero badge="OPEN DATA" title="The numbers, as files." tagline="Download them, check them, quote them. Every row names its label, its source and its date." />
      {od.datasets.map((d) => (
        <Block key={d.id} point={d.title}>
          <p data-dataset={d.id}>{d.about}</p>
          <p>
            <a href={d.file} style={{ color: "var(--gold)", marginRight: 16 }}>JSON</a>
            <a href={d.csv} style={{ color: "var(--gold)" }}>CSV</a>
          </p>
        </Block>
      ))}
      <Block point="Source, date and licence">
        <p data-provenance="/open-data">{od.system}, compiled {longDate(od.compiled)}. Figures from a third party are cited as theirs and keep that source&apos;s own date.</p>
        <p>{od.licence}</p>
      </Block>
    </>
  );
}
