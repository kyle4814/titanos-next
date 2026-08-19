import Link from "next/link";
import AnimatedButton from "./AnimatedButton";
import type { ContentBlock } from "@/lib/blog";

const pStyle = {
  color: "var(--text)",
  fontSize: "var(--fs-body)",
  lineHeight: 1.85,
  marginBottom: 20,
} as const;

const h2Style = {
  fontFamily: "var(--font-display), Georgia, serif",
  color: "var(--gold)",
  fontSize: "var(--fs-h3)",
  letterSpacing: "0.04em",
  marginTop: 40,
  marginBottom: 16,
} as const;

const h3Style = {
  fontFamily: "var(--font-display), Georgia, serif",
  color: "var(--ice)",
  fontSize: "var(--fs-h4)",
  letterSpacing: "0.02em",
  marginTop: 28,
  marginBottom: 12,
} as const;

const listStyle = {
  ...pStyle,
  paddingLeft: 22,
} as const;

export default function BlogBody({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={i} style={h2Style}>
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} style={h3Style}>
                {block.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} style={pStyle}>
                {block.text}
              </p>
            );
          case "p-link":
            return (
              <p key={i} style={pStyle}>
                {block.before}
                <Link href={block.href} style={{ color: "var(--ice)" }}>
                  {block.linkText}
                </Link>
                {block.after}
              </p>
            );
          case "ul":
            return (
              <ul key={i} style={listStyle}>
                {block.items.map((item, j) => (
                  <li key={j} style={{ marginBottom: 10 }}>
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} style={listStyle}>
                {block.items.map((item, j) => (
                  <li key={j} style={{ marginBottom: 10 }}>
                    {item}
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                style={{
                  borderLeft: "2px solid var(--gold-dim)",
                  paddingLeft: 20,
                  margin: "24px 0",
                  color: "var(--ice)",
                  fontFamily: "var(--font-display), Georgia, serif",
                  fontStyle: "italic",
                  fontSize: "var(--fs-lg)",
                  lineHeight: 1.6,
                }}
              >
                {block.text}
                {block.attribution && (
                  <div
                    style={{
                      marginTop: 8,
                      fontFamily: "var(--font-mono), monospace",
                      fontStyle: "normal",
                      fontSize: "var(--fs-xs)",
                      color: "var(--dim)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    — {block.attribution}
                  </div>
                )}
              </blockquote>
            );
          case "cta":
            return (
              <div
                key={i}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--gold-dim)",
                  borderRadius: "var(--radius-sm)",
                  padding: "24px clamp(18px, 4vw, 28px)",
                  margin: "32px 0",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    color: "var(--text)",
                    fontSize: "var(--fs-body)",
                    lineHeight: 1.7,
                    marginBottom: 18,
                  }}
                >
                  {block.text}
                </p>
                <AnimatedButton href={block.href} variant="primary">
                  {block.label}
                </AnimatedButton>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
