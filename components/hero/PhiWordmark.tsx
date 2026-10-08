import { PHI } from "@/lib/phi";

/**
 * TITANOS wordmark drawn from golden-ratio geometry. Every letter sits in a cell 1 wide by phi tall (the
 * golden rectangle). Crossbars sit at the golden section (0.618 of the height), the O is a stadium whose end
 * radius is half the cell, and the S is two stacked circles whose diameter is half of phi (0.809 wide).
 * Strokes are 0.14 units, round caps. Inline SVG, ~1 KB.
 */
const H = PHI;
const SW = 0.14;
const GAP = 0.5;
const CELL = 1;

type Glyph = { w: number; d: string };

function sPath(): Glyph {
  const r = H / 4; // circle radius = 0.404, diameter 0.809 = phi/2
  const cx = r + SW / 2;
  const c1 = SW / 2 + r, c2 = H - SW / 2 - r;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const pt = (cy: number, deg: number) => `${(cx + r * Math.cos(rad(deg))).toFixed(3)} ${(cy + r * Math.sin(rad(deg))).toFixed(3)}`;
  // top arc: from upper right (-35 deg) counter-clockwise round the left to the circle's bottom (90 deg);
  // bottom arc: from the lower circle's top (-90 deg) clockwise round the right to the lower left (145 deg).
  const d = `M ${pt(c1, -35)} A ${r} ${r} 0 1 0 ${pt(c1, 90)} A ${r} ${r} 0 1 1 ${pt(c2, 145)}`;
  return { w: cx + r + SW / 2, d };
}

const GLYPHS: Record<string, Glyph> = {
  T: { w: CELL, d: `M 0 ${SW / 2} H ${CELL} M ${CELL / 2} ${SW / 2} V ${H}` },
  I: { w: SW, d: `M ${SW / 2} 0 V ${H}` },
  A: { w: CELL, d: `M 0 ${H} L ${CELL / 2} 0 L ${CELL} ${H} M 0.19 ${(H * 0.618).toFixed(3)} H ${CELL - 0.19}` },
  N: { w: CELL, d: `M ${SW / 2} ${H} V 0 L ${CELL - SW / 2} ${H} V 0` },
  O: { w: CELL, d: `M ${CELL / 2} ${SW / 2} A ${CELL / 2 - SW / 2} ${CELL / 2 - SW / 2} 0 0 1 ${CELL - SW / 2} ${CELL / 2} V ${H - CELL / 2} A ${CELL / 2 - SW / 2} ${CELL / 2 - SW / 2} 0 0 1 ${CELL / 2} ${H - SW / 2} A ${CELL / 2 - SW / 2} ${CELL / 2 - SW / 2} 0 0 1 ${SW / 2} ${H - CELL / 2} V ${CELL / 2} A ${CELL / 2 - SW / 2} ${CELL / 2 - SW / 2} 0 0 1 ${CELL / 2} ${SW / 2} Z` },
  S: sPath(),
};

export default function PhiWordmark({ height = 28, title = "TITANOS" }: { height?: number; title?: string }) {
  let x = SW / 2;
  const parts = "TITANOS".split("").map((ch, i) => {
    const g = GLYPHS[ch];
    const el = <path key={i} d={g.d} transform={`translate(${x.toFixed(3)} 0)`} />;
    x += g.w + GAP;
    return el;
  });
  const width = x - GAP + SW / 2;
  return (
    <svg
      className="ds-wordmark"
      role="img"
      aria-label={title}
      viewBox={`0 ${(-SW / 2).toFixed(3)} ${width.toFixed(3)} ${(H + SW).toFixed(3)}`}
      height={height}
      width={(height * width) / (H + SW)}
      fill="none"
      stroke="currentColor"
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {parts}
    </svg>
  );
}
