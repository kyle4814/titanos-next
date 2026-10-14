import InView from "@/components/charts/InView";
import "./proof.css";

export type TileItem = {
  /** the figure exactly as it should read, e.g. "250 of 250" (the first number counts up) */
  n: string;
  /** one-line caption, as written on the page */
  l: string;
  /** claim label shown above the figure, e.g. MEASURED */
  tag?: string;
  /** 0 to 100 share for the thin fill bar (omit for none) */
  pct?: number;
  wide?: boolean;
};

/** Receipt-style bento of measured figures. Server-rendered final values; counts up once on first view. */
export default function Tiles({ items, label }: { items: TileItem[]; label: string }) {
  return (
    <InView>
      <ul className="pf-bento" aria-label={label}>
        {items.map((t) => (
          <li key={t.n + t.l} className={t.wide ? "pf-tile pf-tile--wide" : "pf-tile"}>
            {t.tag ? <p className="pf-tag">{t.tag}</p> : null}
            <p className="pf-num" data-count>{t.n}</p>
            <p className="pf-cap">{t.l}</p>
            {t.pct !== undefined ? (
              <div className="pf-bar" aria-hidden="true">
                <i style={{ ["--w" as string]: `${t.pct}%` }} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </InView>
  );
}
