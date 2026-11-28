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
  // the three dots count toward the limit, so cut on a word inside max - 3
  const room = text.slice(0, max - 3);
  return room.slice(0, room.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "...";
}

/** Words a title must not end on once it has been cut. */
const DANGLING = new Set(["a", "an", "the", "of", "in", "on", "to", "for", "and", "or", "with", "your", "my", "is", "are", "that", "how", "vs", "actually", "at", "by", "from", "as", "one"]);

/** Google shows about 60 characters of a title: drop a brand suffix first, then cut on a clause break, else on a word. */
export function clipTitle(title: string, max = 60): string {
  if (title.length <= max) return title;
  const bare = title.replace(/\s*[|\u00b7]\s*(TITANOS|Titanos)$/, "");
  if (bare.length <= max) return bare;
  const tidy = (t: string) => {
    let out = t.replace(/[,;:|\s-]+$/, "");
    if ((out.match(/["\u201c\u201d]/g) || []).length % 2) out = out.replace(/["\u201c\u201d]/g, "");
    for (;;) {
      const m = out.match(/^(.*\S)\s+(\S+)$/);
      if (!m || !DANGLING.has(m[2].toLowerCase()) || m[1].length < 20) return out;
      out = m[1].replace(/[,;:|\s-]+$/, "");
    }
  };
  const head = bare.slice(0, max + 1);
  const clause = Math.max(head.lastIndexOf(": "), head.lastIndexOf(", "), head.lastIndexOf(" - "), head.lastIndexOf(" ("), head.lastIndexOf("? "));
  if (clause > 25) return tidy(bare.slice(0, clause + (head[clause] === "?" ? 1 : 0)));
  const cut = head.lastIndexOf(" ");
  return tidy(cut > 20 ? bare.slice(0, cut) : bare.slice(0, max));
}

/** Fit "Name | TITANOS" inside Google's ~60 character title display: drop the suffix first, then clip on a word. */
export function fitTitle(name: string, suffix = " | TITANOS", max = 60): string {
  if (name.length + suffix.length <= max) return name + suffix;
  if (name.length <= max) return name;
  const head = name.slice(0, max + 1);
  const cut = head.lastIndexOf(" ");
  return (cut > 20 ? head.slice(0, cut) : name.slice(0, max)).replace(/[,;:\s-]+$/, "");
}

/** The one RSS feed we advertise (feed.xml is kept for old subscribers but not advertised). */
export const FEED_URL = `${SITE}/rss.xml`;

/**
 * Complete a page's Metadata so every route carries canonical, Open Graph
 * (with the per-page generated card) and Twitter tags. Next replaces a
 * parent's openGraph wholesale, so a page that sets its own openGraph without
 * images used to lose the image; this closes that gap in one place.
 */
export function withSeo(path: string, base: Metadata): Metadata {
  const title = typeof base.title === "string" ? clipTitle(base.title) : undefined;
  const description = base.description ? clipDescription(base.description) : undefined;
  const url = `${SITE}${path === "/" ? "/" : path}`;
  const image = { url: ogUrl(path), ...OG_SIZE, alt: title ?? "TITANOS" };
  const og = (base.openGraph ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...(title ? { title } : {}),
    description,
    alternates: {
      ...base.alternates,
      canonical: base.alternates?.canonical ?? url,
      types: { "application/rss+xml": [{ url: FEED_URL, title: "TITANOS" }], ...(base.alternates?.types ?? {}) },
    },
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
