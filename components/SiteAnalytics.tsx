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
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
  } else {
    fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
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
