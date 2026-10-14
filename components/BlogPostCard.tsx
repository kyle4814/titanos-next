import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import s from "./w2b/blog.module.css";

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BlogPostCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className={`${s.card}${featured ? ` ${s.feature}` : ""}`}>
      <span aria-hidden="true" className={s.dot} />
      <div className={`label-system ${s.cmeta}`}>
        <span className={s.tag}>{post.tag}</span>
        <span aria-hidden="true">·</span>
        <span>logged {formatDate(post.date)}</span>
        <span aria-hidden="true">·</span>
        <span>{post.readMinutes} min read</span>
      </div>
      <h3 className={s.ctitle}>{post.title}</h3>
      <p className={s.excerpt}>{post.excerpt}</p>
      <span className={s.open}>
        Open the record
        <span aria-hidden="true" className={s.arrow}>→</span>
      </span>
    </Link>
  );
}
