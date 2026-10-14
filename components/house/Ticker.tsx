/**
 * Ticker: infinite marquee strip. Pure CSS, compositor-only (transform). Pauses on hover and
 * focus, stops under reduced motion (then wraps as a normal row). The duplicated copy is
 * aria-hidden so screen readers read each item once.
 */
import { type ReactNode } from "react";

export default function Ticker({
  items,
  seconds = 40,
  label,
  className,
}: {
  items: ReactNode[];
  seconds?: number;
  label?: string;
  className?: string;
}) {
  const row = (hidden: boolean) => (
    <ul className="h-ticker__row" aria-hidden={hidden || undefined}>
      {items.map((it, i) => (
        <li key={i} className="h-ticker__item">
          {it}
        </li>
      ))}
    </ul>
  );
  return (
    <div
      className={`h-ticker${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={label}
      style={{ ["--h-ticker-s" as string]: `${seconds}s` }}
    >
      <div className="h-ticker__track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
