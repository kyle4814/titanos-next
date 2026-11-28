"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/config";
import { DIGITAL_API_BASE } from "@/lib/shop/digital_api";

type State = "checking" | "pending" | "processing" | "sent" | "revoked" | "unknown";

// Polls the Worker until the webhook has fulfilled the order. The link itself only ever goes to the buyer's inbox, never to this page.
export default function DigitalThanksClient() {
  const [state, setState] = useState<State>("checking");
  const [title, setTitle] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("s");
    if (!s) { setState("unknown"); return; }
    let stop = false, tries = 0;
    const tick = async () => {
      if (stop) return;
      try {
        const r = await fetch(`${DIGITAL_API_BASE}/digital/order?s=${encodeURIComponent(s)}`, { headers: { Accept: "application/json" } });
        const j: { state?: State; title?: string | null; download_url?: string } = await r.json();
        if (j.state) setState(j.state);
        if (j.title) setTitle(j.title);
        if (j.download_url) setLink(j.download_url);
        if (j.download_url || j.state === "sent" || j.state === "revoked") return;
      } catch { /* try again */ }
      if (++tries < 40) setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, []);
  const text: Record<State, string> = {
    checking: "Checking your order…",
    pending: "Confirming your payment with Stripe. This usually takes a few seconds.",
    processing: "Payment confirmed. Your download link is below and is also on its way to your inbox.",
    sent: `Done. Your private download link${title ? ` for ${title}` : ""} is below and in your inbox.`,
    revoked: "This order was refunded, so the download is no longer available.",
    unknown: "We could not find an order reference on this page. Your receipt and download link were emailed to you after payment.",
  };
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 20px var(--space-16)", textAlign: "center" }}>
      <p role="status" aria-live="polite" style={{ color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.7 }}>{text[state]}</p>
      {link && state !== "revoked" ? (
        <p style={{ margin: "var(--space-6) 0" }}>
          <a href={link} style={{ color: "var(--gold)", fontSize: "var(--fs-body)" }} rel="nofollow noopener">Download your files</a>
          <span style={{ display: "block", color: "var(--dim)", fontSize: "var(--fs-sm)", marginTop: 8 }}>Private to you. Valid for 7 days and 5 downloads. We also email the same link.</span>
        </p>
      ) : null}
      <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", lineHeight: 1.7 }}>
        Nothing in your inbox after 10 minutes? Check spam, then email <a href={`mailto:${SITE.KYLE_EMAIL}?subject=${encodeURIComponent("Download link not received")}`} style={{ color: "var(--gold)" }}>{SITE.KYLE_EMAIL}</a> with the email you paid with and we will resend it by hand.
      </p>
    </div>
  );
}
