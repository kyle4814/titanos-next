"use client";

import Link from "next/link";
import { useState } from "react";
import type { BlogPost } from "@/lib/blog";

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BlogPostCard({ post }: { post: BlogPost }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/blog/${post.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: "var(--card)",
        border: `1px solid ${hovered ? "var(--gold-dim)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        padding: "var(--pad-card)",
        textDecoration: "none",
        transition: "border-color 200ms ease, transform 200ms ease",
        transform: hovered ? "translateY(-2px)" : "none",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginBottom: 14,
          fontFamily: "var(--font-mono), monospace",
          fontSize: "var(--fs-xs)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--dim)",
        }}
      >
        <span style={{ color: "var(--gold-dim)" }}>{post.tag}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDate(post.date)}</span>
        <span aria-hidden="true">·</span>
        <span>{post.readMinutes} min read</span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          color: hovered ? "var(--gold-bright)" : "var(--gold)",
          fontSize: "var(--fs-h4)",
          lineHeight: 1.3,
          marginBottom: 10,
          transition: "color 200ms ease",
        }}
      >
        {post.title}
      </h3>
      <p
        style={{
          color: "var(--text)",
          fontSize: "var(--fs-sm)",
          lineHeight: 1.7,
          marginBottom: 0,
        }}
      >
        {post.excerpt}
      </p>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginTop: 16,
          color: "var(--ice)",
          fontSize: "var(--fs-sm)",
        }}
      >
        Read
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            transform: hovered ? "translateX(4px)" : "none",
            transition: "transform 200ms ease",
          }}
        >
          →
        </span>
      </span>
    </Link>
  );
}
