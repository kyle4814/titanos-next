// Site beacon payload. One schema, shared with the f09 counter (event names scan-instant-run and
// scan-get-fixed) and the C1 kill test (scripts/funnel_killtest.mjs): {event, path, ts, scanId?}.
// scanId is an opaque random id made in the browser per scan; it carries no domain and no personal data.
const ID_RX = /^[A-Za-z0-9_-]{16,64}$/;

export interface BeaconPayload { event: string; path: string; ts: number; scanId?: string }

/** A fresh opaque id: 128 random bits, base64url-ish hex. Not derived from the domain or the visitor. */
export function newScanId(c: { getRandomValues<T extends ArrayBufferView>(a: T): T } = globalThis.crypto): string {
  const b = c.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function buildPayload(event: string, path: string, scanId?: string | null, now: number = Date.now()): BeaconPayload {
  const p: BeaconPayload = { event, path, ts: now };
  if (scanId && ID_RX.test(scanId)) p.scanId = scanId;
  return p;
}

/** Reads the scan id off the clicked element (data-scan-id), if any. */
export function payloadFromTarget(target: { getAttribute(n: string): string | null }, path: string, now?: number): BeaconPayload | null {
  const name = target.getAttribute("data-analytics");
  if (!name) return null;
  return buildPayload(name, path, target.getAttribute("data-scan-id"), now);
}
