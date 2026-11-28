import { fullLines } from "@/lib/llmsFacts";

export const dynamic = "force-static";

export function GET() {
  return new Response(fullLines().join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
