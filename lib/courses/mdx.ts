/**
 * Minimal MDX-subset parser for course pages. Output is the same ContentBlock[] the blog uses, so lessons render through
 * BlogBody with no new dependency (the site is a static export with no markdown tooling; see lib/blog.ts).
 * Supported: ## / ### headings, paragraphs, "- " and "1. " lists, "- [ ] " checklists, "> " quotes. Inline ** and * markers are stripped.
 */
import type { ContentBlock } from "@/lib/blog";

const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2").replace(/`([^`]+)`/g, "$1").trim();

export function parseMdx(src: string): ContentBlock[] {
  const out: ContentBlock[] = [];
  const lines = src.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    if (para.length) out.push({ type: "p", text: plain(para.join(" ")) });
    if (list) out.push({ type: list.kind, items: list.items });
    if (quote.length) out.push({ type: "quote", text: plain(quote.join(" ")) });
    para = []; list = null; quote = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^###\s+(.*)$/))) { flush(); out.push({ type: "h3", text: plain(m[1]) }); continue; }
    if ((m = line.match(/^#{1,2}\s+(.*)$/))) { flush(); out.push({ type: "h2", text: plain(m[1]) }); continue; }
    if ((m = line.match(/^>\s?(.*)$/))) { if (!quote.length) flush(); quote.push(m[1]); continue; }
    if ((m = line.match(/^\s*-\s+\[( |x)\]\s+(.*)$/i))) {
      if (!list || list.kind !== "ul") { flush(); list = { kind: "ul", items: [] }; }
      list.items.push(`${m[1] === " " ? "☐" : "☑"} ${plain(m[2])}`); continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (!list || list.kind !== "ul") { flush(); list = { kind: "ul", items: [] }; }
      list.items.push(plain(m[1])); continue;
    }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (!list || list.kind !== "ol") { flush(); list = { kind: "ol", items: [] }; }
      list.items.push(plain(m[1])); continue;
    }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return out;
}
