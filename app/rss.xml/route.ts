import { feedResponse } from "@/lib/feed";

export const dynamic = "force-static";

// /rss.xml: RSS 2.0 built from the blog index at build time (lib/feed.ts).
export function GET() {
  return feedResponse();
}
