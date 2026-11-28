import type { ContentBlock } from "../blog";

export const p = (text: string): ContentBlock => ({ type: "p", text });
export const h2 = (text: string): ContentBlock => ({ type: "h2", text });
export const h3 = (text: string): ContentBlock => ({ type: "h3", text });
export const ul = (...items: string[]): ContentBlock => ({ type: "ul", items });
export const ol = (...items: string[]): ContentBlock => ({ type: "ol", items });
export const quote = (text: string, attribution?: string): ContentBlock => ({ type: "quote", text, attribution });
export const link = (before: string, linkText: string, href: string, after?: string): ContentBlock => ({
  type: "p-link",
  before,
  linkText,
  href,
  after,
});
export const cta = (text: string, label: string, href: string): ContentBlock => ({ type: "cta", text, label, href });

/** Closing disclosure used on every post in this folder. */
export const DISCLOSURE = p(
  "Written with AI assistance (Claude) and edited by TITANOS, Brisbane, ABN 34 318 502 254. Sources checked 28 November 2026. This is general information for small business owners, not legal advice. For a specific decision, ask a lawyer.",
);
