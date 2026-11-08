"use client";

/**
 * Fires a pageview beacon on mount, then delegates click/submit on any
 * element carrying data-analytics="<event-name>" (already present across
 * the site from earlier instrumentation passes — this is the first thing
 * that actually reads them). Sends to the vault Worker's public,
 * unauthenticated /api/site-event endpoint — no cookies, no third-party
 * script, consistent with the site's "no tracking" privacy copy.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ENDPOINT = "https://vault.titanos.tech/api/site-event";

function send(event: string, path: string) {
  const body = JSON.stringify({ event, path });
  // text/plain, NOT application/json — deliberate, and load-bearing.
  //
  // application/json is not a CORS-safelisted content type, so it forces a
  // preflight OPTIONS. A Cloudflare transform rule on this zone strips
  // Access-Control-Allow-Origin from responses (see the SEC-02 residual
  // noted in next.config.ts), so that preflight failed and EVERY event
  // from titanos.tech was silently dropped — found 2026-08-20 by opening
  // the live site in a real browser and reading the console, which is the
  // only reason anyone noticed analytics had never worked.
  //
  // text/plain IS safelisted, so this is a "simple request": no preflight,
  // no ACAO needed, nothing for the transform rule to strip. The Worker
  // parses the body with request.json() regardless of the declared type,
  // so the payload contract is unchanged.
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
  } else {
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: true }).catch(() => {});
  }
}

export default function SiteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    send("pageview", pathname || "/");
  }, [pathname]);

  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e.target as HTMLElement)?.closest("[data-analytics]");
      if (!target) return;
      const name = target.getAttribute("data-analytics");
      if (name) send(name, pathname || "/");
    };
    document.addEventListener("click", handler, true);
    document.addEventListener("submit", handler, true);
    return () => {
      document.removeEventListener("click", handler, true);
      document.removeEventListener("submit", handler, true);
    };
  }, [pathname]);

  return null;
}
