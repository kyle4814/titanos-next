// Every Response this Worker builds goes through here, so each one carries the five portal security headers
// (reuses portal-api/src/http.ts) and, for the file, no-store plus nosniff.
import { json, empty, withSecurityHeaders } from "../../portal-api/src/http.ts";
export { json, empty };

export function fileStream(body: ReadableStream, o: { filename: string; size: number; etag?: string }): Response {
  const h: Record<string, string> = {
    "content-type": "application/zip",
    "content-disposition": `attachment; filename="${o.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    "content-length": String(o.size),
    "cache-control": "no-store, private",
  };
  if (o.etag) h.etag = o.etag;
  return withSecurityHeaders(new Response(body, { status: 200, headers: h }));
}
export function fileHead(o: { filename: string; size: number }): Response {
  return withSecurityHeaders(new Response(null, { status: 200, headers: { "content-type": "application/zip", "content-length": String(o.size), "cache-control": "no-store, private" } }));
}
