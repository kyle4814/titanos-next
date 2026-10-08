"use client";

import { FEED } from "@/lib/hud/data";

const TIME = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Brisbane", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export default function ReceiptFeed() {
  const items = FEED.items;
  return (
    <section className="hud-panel" aria-label="Receipt feed">
      <div className="hud-label">Receipt feed <span className="hud-tag hud-tag-ok">MEASURED</span></div>
      <ul className="hud-feed" aria-label="Recent builds, newest first">
        {items.map((it, i) => (
          <li key={i} className="hud-feed-row" style={{ animationDelay: `${Math.min(i, 14) * 70}ms` }}>
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
