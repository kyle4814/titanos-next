import Link from "next/link";
import AnimatedButton from "./AnimatedButton";
import type { ContentBlock } from "@/lib/blog";
import s from "./w2b/blog.module.css";

export default function BlogBody({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className={s.prose}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return <h2 key={i} className={s.h2}>{block.text}</h2>;
          case "h3":
            return <h3 key={i} className={s.h3}>{block.text}</h3>;
          case "p":
            return <p key={i} className={s.p}>{block.text}</p>;
          case "p-link":
            return (
              <p key={i} className={s.p}>
                {block.before}
                <Link href={block.href} className={s.link}>{block.linkText}</Link>
                {block.after}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className={s.list}>
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className={s.list}>
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ol>
            );
          case "quote":
            return (
              <blockquote key={i} className={s.quote}>
                {block.text}
                {block.attribution && <div className={`label-system ${s.attr}`}>{block.attribution}</div>}
              </blockquote>
            );
          case "cta":
            return (
              <div key={i} className={s.cta}>
                <p className={s.ctaText}>{block.text}</p>
                <AnimatedButton href={block.href} variant="primary">{block.label}</AnimatedButton>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
