import type { MetadataRoute } from "next";
import { indexableRoutes } from "@/lib/routes";

// Next 16 + output: 'export' needs sitemap routes to opt into static generation.
export const dynamic = "force-static";

// Generated from the app/ directory and the content libraries at build: a page cannot be missing
// from the sitemap, and noindex pages (orders, welcome, thank-you, private pitch) never appear.
export default function sitemap(): MetadataRoute.Sitemap {
  return indexableRoutes().map((r) => ({
    url: r.url,
    ...(r.lastModified ? { lastModified: r.lastModified } : {}),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
