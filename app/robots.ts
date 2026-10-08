import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export const dynamic = "force-static";

// Crawlers and answer engines we want citing the site; the private areas stay out for all of them.
const AI_AGENTS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "Claude-SearchBot", "Claude-User",
  "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "CCBot", "Applebot-Extended",
];
const PRIVATE = ["/d/", "/v/", "/welcome/", "/order/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
