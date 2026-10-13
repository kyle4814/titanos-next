/** The DNA motion language carried down the whole page: three strands braid in a seamless vertical tile that scrolls
 *  with the page (driven by FlowDriver, transform only). Fixed behind the content, feathered at the edges, breathing slowly.
 *  Server-rendered markup, no JS needed for the static look.
 *
 *  PREMIUM PASS (2026-10-13). Each strand is a lit ribbon, not a flat stroke:
 *   - perspective: width and brightness follow the strand's depth in the twist (near = wider and brighter, far = thinner
 *     and dimmer), so the braid reads as a solid object instead of three wavy lines;
 *   - occlusion: every strand is split into near and far pieces at its depth zero crossings (the only places strands cross
 *     are where one is near and the other far), far pieces draw first, near pieces last, so crossings stack correctly;
 *   - light: a depth-lit gradient (repeats every twist, so the tile still loops), pre-blurred halo ribbons (two widths,
 *     falling opacity) and a fine highlight line on the near face of each strand for the specular sheen; desktop adds one
 *     real feGaussianBlur on the halo group (CSS, pointer: fine only). Phones get the layered halos and no filter.
 *   - the tile is still TILE px tall and loops seamlessly: every path is periodic in TILE (two full twists).
 *
 *  VARIANTS (design review): A Gold Filament, B Deep Glass, C Obsidian Minimal. The geometry is shared; the variant is the
 *  data-helix attribute on the root, and app/design-system.css keys every width, opacity and colour off it. Switch the
 *  default with HELIX_VARIANT below (one const). For a screenshot of another variant on the same build, set
 *  document.querySelector('.fx-thread').dataset.helix at runtime. */
export const HELIX_VARIANT: "A" | "B" | "C" = "C"; // C Obsidian Minimal: Kyle 2026-10-13, "Helix C wins hands down". A and B stay switchable here.

const TILE = 800;
const PERIOD = TILE / 2; // one full twist
const AMP = 62;
const CX = 100;
const STEP = 12.5;
const EPS = 1e-9;

type Strand = { id: string; ph: number; bright: string; dim: string };
const STRANDS: Strand[] = [
  { id: "s0", ph: 0, bright: "#f5cd72", dim: "#9c7a35" },
  { id: "s1", ph: (2 * Math.PI) / 3, bright: "#9fb6e8", dim: "#4f5e8a" },
  { id: "s2", ph: (4 * Math.PI) / 3, bright: "#b1a3ec", dim: "#5c5390" },
];

const theta = (y: number, ph: number) => (2 * Math.PI * y) / PERIOD + ph;
const xAt = (y: number, ph: number) => CX + AMP * Math.sin(theta(y, ph));
const zAt = (y: number, ph: number) => Math.cos(theta(y, ph)); // +1 nearest the viewer, -1 farthest
const f1 = (n: number) => String(Math.round(n * 10) / 10);

/** Half-width at y for a ribbon of base width w: near face 1.45x, far face 0.55x. */
const halfW = (y: number, ph: number, w: number) => (w * (1 + 0.45 * zAt(y, ph))) / 2;

/** A ribbon (filled polygon) between y0 and y1, optionally shifted sideways by a fraction of its half-width (highlight). */
function ribbon(ph: number, w: number, y0: number, y1: number, step: number, shift = 0) {
  const left: string[] = [];
  const right: string[] = [];
  const ys: number[] = [];
  for (let y = y0; y < y1 - EPS; y += step) ys.push(y);
  ys.push(y1);
  for (const y of ys) {
    const x = xAt(y, ph) + shift * halfW(y, ph, 3.4); // shift is relative to the thick core's half-width
    const h = halfW(y, ph, w);
    left.push(`${f1(x - h)} ${f1(y)}`);
    right.push(`${f1(x + h)} ${f1(y)}`);
  }
  return `M${left.join(" L")} L${right.reverse().join(" L")}Z`;
}

/** The y positions in [0, TILE] where the strand's depth changes sign (edges of the near / far pieces). */
function zeroCrossings(ph: number) {
  const out: number[] = [];
  for (let k = -3; k < 8; k++) {
    const y = ((Math.PI / 2 - ph + k * Math.PI) / (2 * Math.PI)) * PERIOD;
    if (y > EPS && y < TILE - EPS) out.push(y);
  }
  return out.sort((a, b) => a - b);
}

/** Pieces of a strand within one tile, tagged near or far. Pieces touching the tile edges are cut flat at 0 and TILE, so
 *  the next tile copy continues them exactly (the geometry is periodic in TILE). */
function pieces(ph: number) {
  const cuts = [0, ...zeroCrossings(ph), TILE];
  const out: { y0: number; y1: number; near: boolean }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const y0 = cuts[i], y1 = cuts[i + 1];
    out.push({ y0, y1, near: zAt((y0 + y1) / 2, ph) > 0 });
  }
  return out;
}

/** Depth-lit gradient stops over one twist: colour follows (1 + z) / 2, so the near face is bright and the far face dim. */
function depthStops(s: Strand) {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const b = hex(s.bright), d = hex(s.dim);
  const stops: { off: number; c: string }[] = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const y = (i / N) * PERIOD;
    const t = (1 + zAt(y, s.ph)) / 2;
    const c = b.map((bv, k) => Math.round(d[k] + (bv - d[k]) * t));
    stops.push({ off: i / N, c: `rgb(${c[0]} ${c[1]} ${c[2]})` });
  }
  return stops;
}

export default function FlowThread() {
  const parts = STRANDS.map((s) => ({ s, pieces: pieces(s.ph) }));
  return (
    <div className="fx-thread" data-helix={HELIX_VARIANT} aria-hidden="true">
      <div className="fx-thread__pulse">
        <div className="fx-thread__tiles" data-flow-thread data-tile={TILE}>
          <svg viewBox={`0 0 200 ${TILE * 3}`} width="200" height={TILE * 3} fill="none">
            <defs>
              <filter id="hx-blur" x="-40%" y="-2%" width="180%" height="104%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation="3.2" />
              </filter>
              {STRANDS.map((s) => (
                <linearGradient key={s.id} id={`hx-g-${s.id}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={PERIOD} spreadMethod="repeat">
                  {depthStops(s).map((st) => <stop key={st.off} offset={st.off} stopColor={st.c} />)}
                </linearGradient>
              ))}
              <g id="hx-tile">
                {/* 1. halos: wide and mid, pre-blurred by layering (phones), one true blur on desktop via CSS */}
                <g className="hx-halo">
                  {STRANDS.map((s) => (
                    <g key={s.id} className={`hx-${s.id}`} fill={`url(#hx-g-${s.id})`}>
                      <path className="hx-halo-w" d={ribbon(s.ph, 14, 0, TILE, 25)} />
                      <path className="hx-halo-m" d={ribbon(s.ph, 6.5, 0, TILE, 25)} />
                    </g>
                  ))}
                </g>
                {/* 2. far faces of every strand, then 3. near faces on top: correct occlusion at every crossing */}
                {[false, true].map((near) => (
                  <g key={near ? "near" : "far"} className={near ? "hx-near" : "hx-far"}>
                    {parts.map(({ s, pieces }) => (
                      <g key={s.id} className={`hx-${s.id}`} fill={`url(#hx-g-${s.id})`}>
                        {pieces.filter((p) => p.near === near).map((p) => (
                          <g key={p.y0}>
                            <path className="hx-core-thick" d={ribbon(s.ph, 3.4, p.y0, p.y1, STEP)} />
                            <path className="hx-core-thin" d={ribbon(s.ph, 1.3, p.y0, p.y1, STEP)} />
                          </g>
                        ))}
                      </g>
                    ))}
                  </g>
                ))}
                {/* 4. specular: a fine highlight on the near face only, sitting a little toward the light (upper left) */}
                <g className="hx-hi" fill="#fff4d6">
                  {parts.map(({ s, pieces }) => (
                    <g key={s.id} className={`hx-${s.id}`}>
                      {pieces.filter((p) => p.near).map((p) => (
                        <path key={p.y0} d={ribbon(s.ph, 0.42, p.y0 === 0 ? 0 : p.y0 + 6, p.y1 === TILE ? TILE : p.y1 - 6, STEP, -0.45)} />
                      ))}
                    </g>
                  ))}
                </g>
              </g>
            </defs>
            {[0, 1, 2].map((k) => <use key={k} href="#hx-tile" y={k * TILE} />)}
          </svg>
        </div>
      </div>
    </div>
  );
}
