import "./offers.css";

/** List items rendered as bento tiles. `lead` spans the first tile across the grid on wide screens. */
export function Bento({ items, mark, tone = "ok", lead = false, label }: { items: string[]; mark: string; tone?: "ok" | "no" | "plain"; lead?: boolean; label?: string }) {
  return (
    <ul className="ox-bento" data-tone={tone} data-lead={lead ? "true" : undefined} aria-label={label}>
      {items.map((it) => (
        <li key={it} data-mark={mark}>{it}</li>
      ))}
    </ul>
  );
}

/** Label/price tiles (enterprise starting points). */
export function PriceTiles({ rows }: { rows: { label: string; price: string }[] }) {
  return (
    <ul className="ox-prices">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="ox-prices__price">{r.price}</span>
        </li>
      ))}
    </ul>
  );
}

/** Glow frame for a hero price card. */
export function GlowFrame({ children }: { children: React.ReactNode }) {
  return <div className="ox-glow">{children}</div>;
}
