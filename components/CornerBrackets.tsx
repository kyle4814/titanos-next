/**
 * CornerBrackets — AES-08 signature device.
 *
 * Four 14×14 gold L-corner brackets pinned to the corners of a relative
 * parent. Inspired by instrument bezels + gun-sight HUDs (audit AES-08
 * recommendation). Decorative only — aria-hidden.
 *
 * Usage: drop inside a position:relative parent. No props needed.
 */

export default function CornerBrackets({
  color = "var(--gold)",
  size = 14,
  thickness = 1,
  inset = 8,
}: {
  color?: string;
  size?: number;
  thickness?: number;
  inset?: number;
}) {
  // Each corner is an SVG L: two strokes meeting at the inner corner.
  const stroke = { stroke: color, strokeWidth: thickness, fill: "none" } as const;
  const half = size;
  const path = (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={`M 0 0 L ${half} 0`} {...stroke} />
      <path d={`M 0 0 L 0 ${half}`} {...stroke} />
    </svg>
  );

  const common = {
    position: "absolute",
    width: size,
    height: size,
    pointerEvents: "none",
  } as const;

  return (
    <>
      {/* top-left */}
      <span style={{ ...common, top: inset, left: inset }}>{path}</span>
      {/* top-right (rotate 90) */}
      <span
        style={{
          ...common,
          top: inset,
          right: inset,
          transform: "rotate(90deg)",
        }}
      >
        {path}
      </span>
      {/* bottom-right (rotate 180) */}
      <span
        style={{
          ...common,
          bottom: inset,
          right: inset,
          transform: "rotate(180deg)",
        }}
      >
        {path}
      </span>
      {/* bottom-left (rotate 270) */}
      <span
        style={{
          ...common,
          bottom: inset,
          left: inset,
          transform: "rotate(270deg)",
        }}
      >
        {path}
      </span>
    </>
  );
}
