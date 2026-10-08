import { serialise, type Json } from "@/lib/jsonld";

/** The one way pages emit structured data. Pass any builder result from lib/jsonld.ts; null renders nothing. */
export default function JsonLd({ data }: { data: Json | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialise(data) }} />;
}
