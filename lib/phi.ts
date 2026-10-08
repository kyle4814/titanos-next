// The golden ratio as the grid (WEBSITE_1000X spec, "the golden ratio and fractals in everything").
// Mirrors the CSS tokens in app/design-system.css; JS callers (motion, shaders, SVG) import from here.
export const PHI = 1.618033988749895;
export const PHI_INV = 1 / PHI; // 0.618
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 137.5078 degrees, in radians

/** Type scale in px: 16, 26, 42, 68, 110 (each step x phi, rounded). */
export const TYPE_PX = [16, 26, 42, 68, 110] as const;
/** Spacing scale in px: phi steps from 6. */
export const SPACE_PX = [6, 10, 16, 26, 42, 68, 110, 178] as const;
/** Motion durations in seconds: 0.38, 0.62, 1, 1.62. */
export const DUR = { fast: 0.38, base: 0.62, slow: 1, epic: 1.62 } as const;

/** Golden section of a length: [major, minor]. */
export function golden(total: number): [number, number] {
  return [total * PHI_INV, total * (1 - PHI_INV)];
}
