import { largest, portraitFiles, spaceImage, srcSet, srcSetOf } from "@/lib/space-images";

/** Responsive AVIF + WebP picture of a licensed deep-space image. Lazy by default; pass priority for the one
 *  above-the-fold image. Credit lives in the title attribute and on /credits (every image, source, licence).
 *  portrait: art-direct with the <id>-portrait crop on the given media query (phones), the landscape master elsewhere. */
export default function SpaceImage({
  id, sizes = "(max-width: 800px) 100vw, 50vw", priority = false, className, alt, portrait,
}: { id: string; sizes?: string; priority?: boolean; className?: string; alt?: string; portrait?: string }) {
  const m = spaceImage(id);
  const fb = largest(m, "webp");
  const pf = portrait ? portraitFiles(id) : null;
  return (
    <picture className={className}>
      {pf && <source type="image/avif" media={portrait} srcSet={srcSetOf(pf.files, "avif")} sizes="100vw" />}
      {pf && <source type="image/webp" media={portrait} srcSet={srcSetOf(pf.files, "webp")} sizes="100vw" />}
      <source type="image/avif" srcSet={srcSet(m, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(m, "webp")} sizes={sizes} />
      <img
        src={`/space/${fb.name}`}
        width={m.width}
        height={m.height}
        alt={alt ?? m.alt}
        title={`${m.title}. Credit: ${m.credit}. ${m.licence}.`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}
