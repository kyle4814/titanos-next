import { largest, spaceImage, srcSet } from "@/lib/space-images";

/** Responsive AVIF + WebP picture of a licensed deep-space image. Lazy by default; pass priority for the one
 *  above-the-fold image. Credit lives in the title attribute and on /credits (every image, source, licence). */
export default function SpaceImage({
  id, sizes = "(max-width: 800px) 100vw, 50vw", priority = false, className, alt,
}: { id: string; sizes?: string; priority?: boolean; className?: string; alt?: string }) {
  const m = spaceImage(id);
  const fb = largest(m, "webp");
  return (
    <picture className={className}>
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
