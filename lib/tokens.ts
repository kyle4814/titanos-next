// Token mirrors for code that CANNOT read CSS variables.
//
// Framer Motion's `animate={{ color: ... }}` interpolates values frame
// by frame; it does NOT resolve `var(--foo)` mid-animation (the var is
// captured once at evaluation, not on every tick). To re-theme nav link
// colours by editing globals.css we'd need a getComputedStyle-on-mount
// dance per component.
//
// Until that's worth the complexity, this file is the single point of
// truth that Framer Motion animations import from. Keep it in sync
// with the canonical values in app/globals.css :root.
//
// Audit reference: AES-07.

export const GOLD = "#D4AF37";
export const GOLD_BRIGHT = "#F5D575";
export const GOLD_DIM = "#8B7225";
export const ICE = "#B9F2FF";
export const DIM = "#777777";
export const TEXT = "#E0E0E0";
