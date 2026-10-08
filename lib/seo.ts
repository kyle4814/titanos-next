import type { Metadata } from "next";

export const SITE = "https://titanos.tech";
export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Route path ("/offers/x") to the build-time generated card file name. */
export function ogSlug(path: string): string {
  const s = path.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
  return s || "home";
}

export function ogUrl(path: string): string {
  return `/og/${ogSlug(path)}.png`;
}

/** Search engines cut meta descriptions near 160 characters: end on a sentence if one fits, else on a word. */
export function clipDescription(text: string, max = 160): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("? "), head.lastIndexOf("! "));
  if (sentence > 60) return head.slice(0, sentence + 1);
  return head.slice(0, head.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "...";
}

/**
 * Complete a page's Metadata so every route carries canonical, Open Graph
 * (with the per-page generated card) and Twitter tags. Next replaces a
 * parent's openGraph wholesale, so a page that sets its own openGraph without
 * images used to lose the image; this closes that gap in one place.
 */
export function withSeo(path: string, base: Metadata): Metadata {
  const title = typeof base.title === "string" ? base.title : undefined;
  const description = base.description ? clipDescription(base.description) : undefined;
  const url = `${SITE}${path === "/" ? "/" : path}`;
  const image = { url: ogUrl(path), ...OG_SIZE, alt: title ?? "TITANOS" };
  const og = (base.openGraph ?? {}) as Record<string, unknown>;
  return {
    ...base,
    description,
    alternates: { ...base.alternates, canonical: base.alternates?.canonical ?? url },
    openGraph: {
      siteName: "TITANOS",
      locale: "en_AU",
      type: "website",
      ...og,
      title: (og.title as string) ?? title,
      description: (og.description as string) ?? description,
      url,
      images: [image],
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      title: title ?? (og.title as string),
      description,
      images: [image.url],
    },
  };
}
