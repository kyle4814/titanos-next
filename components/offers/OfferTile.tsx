import Link from "next/link";
import type { ReactNode } from "react";
import "./offers.css";

type Props = {
  href: string;
  name: ReactNode;
  kicker?: ReactNode;
  pill?: ReactNode;
  body: ReactNode;
  price: ReactNode;
  open: boolean;
  /** Visually lifts one tile as the recommended option. Presentation only: no text is added. */
  feature?: boolean;
  headingLevel?: "h3" | "strong";
};

/** One glowing tile for the offers hub and the products grid. Server component, no client JS. */
export default function OfferTile({ href, name, kicker, pill, body, price, open, feature, headingLevel = "strong" }: Props) {
  const Name = headingLevel;
  return (
    <Link href={href} className="ox-tile" data-open={open ? "true" : "false"} data-feature={feature ? "true" : undefined}>
      {kicker ? <div className="ox-tile__kicker">{kicker}</div> : null}
      <div className="ox-tile__top">
        <Name className="ox-tile__name" style={headingLevel === "h3" ? { margin: 0 } : undefined}>{name}</Name>
        {pill ? <span className="ox-pill" data-open={open ? "true" : "false"}>{pill}</span> : null}
      </div>
      <p className="ox-tile__body">{body}</p>
      <div className="ox-tile__price">{price}</div>
    </Link>
  );
}
