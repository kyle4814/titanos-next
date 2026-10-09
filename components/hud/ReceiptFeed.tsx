"use client";

import { useEffect, useRef, useState } from "react";
import { FEED, type FeedItem } from "@/lib/hud/data";
import { validateFeed } from "@/lib/hud/validate.mjs";

const TIME = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

const TIME_HM = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", hour: "2-digit", minute: "2-digit", hour12: false });

export default function ReceiptFeed() {
  const [feed, setFeed] = useState<{ generated: number; items: FeedItem[] }>(FEED);
  const seen = useRef<Set<string> | null>(null);
  const items = feed.items;
  if (seen.current === null) seen.current = new Set();
  const fresh = (k: string) => seen.current!.size > 0 && !seen.current!.has(k);
  const keys = items.map((it, i) => `${it.t}-${it.code}-${items.slice(0, i).filter((x) => x.t === it.t && x.code === it.code).length}`);
  const isFresh = keys.map(fresh);
  useEffect(() => {
    keys.forEach((k) => seen.current!.add(k));
  });
  useEffect(() => {
    const pull = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch(`/hud/feed.json?ts=${Date.now()}`, { cache: "no-store" });
        const v = r.ok ? validateFeed(await r.json()) : null;
        if (v) setFeed(v);
      } catch {}
    };
    pull();   // 2026-10-09: fetch on open too; without it the page showed the build-time rows for the first minute
    const id = setInterval(pull, 60000);
    document.addEventListener("visibilitychange", pull);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", pull); };
  }, []);
  return (
    <section className="hud-panel" aria-label="Receipt feed">
      <div className="hud-label">Receipt feed <span className="hud-tag hud-tag-ok">MEASURED</span> <span className="hud-feed-time" aria-live="off">updated {TIME_HM.format(feed.generated)}</span></div>
      <ul className="hud-feed" aria-label="Recent builds, newest first">
        {items.map((it, i) => (
          <li key={keys[i]} className="hud-feed-row" style={{ animationDelay: `${isFresh[i] ? 0 : Math.min(i, 14) * 70}ms` }}>
            <span className="hud-feed-time">{TIME.format(it.t)}</span>
            <span className={`hud-feed-acct hud-feed-acct-${it.acct.toLowerCase()}`}>{it.acct}</span>
            <span className="hud-feed-cat">{it.cat}</span>
            <span className="hud-feed-code">{it.code}</span>
            <span className="hud-feed-ok" aria-label="receipt recorded">RECEIPT</span>
          </li>
        ))}
      </ul>
      <p className="hud-note">
        The {items.length} most recent finished jobs from the build ledger, newest first: time (Brisbane), account, category and codename only. Jobs that name an organisation or a person are left out, so the feed shows the rhythm of the work and nothing about anyone else.
      </p>
    </section>
  );
}
