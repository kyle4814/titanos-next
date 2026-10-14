/**
 * BentoGrid + BentoItem: 12-column bento layout that collapses to one column on phones.
 * span: columns on desktop (1 to 12), rows: row span (1 to 3). Server component, no JS.
 */
import { createElement, type CSSProperties, type ReactNode } from "react";

export function BentoGrid({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`h-bento${className ? ` ${className}` : ""}`} style={style}>
      {children}
    </div>
  );
}

export function BentoItem({
  children,
  span = 4,
  rows = 1,
  as = "div",
  className,
  style,
}: {
  children: ReactNode;
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  rows?: 1 | 2 | 3;
  as?: "div" | "article" | "section" | "li";
  className?: string;
  style?: CSSProperties;
}) {
  return createElement(
    as,
    { className: `h-bento__item h-span-${span} h-rows-${rows}${className ? ` ${className}` : ""}`, style },
    children,
  );
}

export default BentoGrid;
