/** The DNA motion language carried down the whole page: three strands braid in a seamless vertical tile that scrolls
 *  with the page (driven by FlowDriver, transform only). Fixed behind the content, feathered at the edges, breathing slowly.
 *  Server-rendered markup, no JS needed for the static look. */
const TILE = 800;
const STRANDS = [
  { ph: 0, c: "#e8b855" },
  { ph: (2 * Math.PI) / 3, c: "#7aa8ff" },
  { ph: (4 * Math.PI) / 3, c: "#8f78ff" },
];

function path(ph: number) {
  const pts: string[] = [];
  for (let y = 0; y <= TILE; y += 40) pts.push(`${y === 0 ? "M" : "L"}${(100 + 62 * Math.sin((2 * Math.PI * y) / (TILE / 2) + ph)).toFixed(1)} ${y}`);
  return pts.join(" ");
}

export default function FlowThread() {
  return (
    <div className="fx-thread" aria-hidden="true">
      <div className="fx-thread__pulse">
        <div className="fx-thread__tiles" data-flow-thread data-tile={TILE}>
          <svg viewBox={`0 0 200 ${TILE * 3}`} width="200" height={TILE * 3} fill="none">
            <defs>
              <g id="fx-strands">
                {STRANDS.map((s) => (
                  <g key={s.c}>
                    <path d={path(s.ph)} stroke={s.c} strokeWidth="5" strokeOpacity="0.14" />
                    <path d={path(s.ph)} stroke={s.c} strokeWidth="1.4" strokeOpacity="0.85" strokeLinecap="round" />
                  </g>
                ))}
              </g>
            </defs>
            {[0, 1, 2].map((k) => <use key={k} href="#fx-strands" y={k * TILE} />)}
          </svg>
        </div>
      </div>
    </div>
  );
}
