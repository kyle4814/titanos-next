/**
 * OperatorByline — Fix 2b.
 *
 * Photo thumb + "Kyle Deligny · runs every engagement personally".
 * Placeholder-gated: renders nothing while SITE.PHOTO_PATH is empty.
 * Surfaces adjacent to the /compliance pricing card to attach a face
 * to the AU$5,997 ask.
 */

import { SITE } from "@/lib/config";

export default function OperatorByline() {
  if (!SITE.PHOTO_PATH) return null;
  return (
    <div
      data-analytics="operator-byline"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px 10px 10px",
        background: "var(--card)",
        border: "1px solid var(--gold-dim)",
        borderRadius: "var(--radius-lg)",
        marginTop: 24,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SITE.PHOTO_PATH}
        alt="Kyle Deligny, Titanos, Brisbane"
        width={40}
        height={40}
        style={{ borderRadius: "50%", objectFit: "cover" }}
      />
      <span
        style={{
          color: "var(--text)",
          fontSize: "var(--fs-sm)",
          fontFamily: "var(--font-body), system-ui, sans-serif",
          lineHeight: 1.4,
        }}
      >
        <strong style={{ color: "var(--gold)" }}>Kyle Deligny</strong>
        <br />
        runs every engagement personally
      </span>
    </div>
  );
}
