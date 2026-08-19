# Black Ice Visual Audit

Scope: audit only. No page `.tsx` files touched. No existing token renamed or altered. Zero new tokens added to `globals.css` — see verdict.

## 1. Token-by-token map against the brief

Brief: obsidian black, near-black blue, cold metallic, subtle frosted silver, cyan as a rare accent, dim amber/gold as a sacred accent. Restraint over maximalism.

| Token(s) | Value | Brief target | Verdict |
|---|---|---|---|
| `--vault-black` / `--vault-deep` | `#0b0908` / `#050303` | obsidian black | Satisfies. Slight warm undertone (doc calls it "leather + ink") is a deliberate, imperceptible deviation from pure OLED black — reads as considered, not off-brief. No change. |
| `--vault-cool` | `#0F1418` | near-black blue / cold metallic | Satisfies directly — this is the "near-black blue" the brief asks for, already scoped to `/scan` and `/ai-delivery` via `body[data-page]`. No change. |
| `--vault-warm` | `#1A1310` | card surface | Satisfies as the default card tone; paired with `--vault-cool` the site already has both a warm and a cold near-black surface, which is more nuanced than the brief asked for, not less. No change. |
| `--gold` / `--gold-warm` / `--gold-mid` / `--gold-cool` / `--gold-spec` / `--gold-dim` / `--gold-bright` | tritone gold system | "dim amber/gold, sacred accent, used sparingly" | Satisfies, and exceeds the brief's ambition — a 7-value gold system with a dedicated `--gold-dim` for restrained states and `--gold-spec` reserved for specular highlights only. This *is* "sacred accent" already formalised as a rule (gold-dim for dim states, spec for rare highlight moments). No change. |
| `--ice` | `#B9F2FF` | electric cyan, EXTREMELY sparing | Satisfies the colour target. Usage check: `--ice` is wired only to `a { color: var(--ice) }` (link colour) — i.e. it's already scoped to one functional role, not scattered as decoration. That is the "extremely sparingly" instruction enforced structurally, not just by convention. No change. |
| `--steel` | `#6B8FA8` | cold metallic | Satisfies — a muted blue-grey, not chrome/neon. Used as the per-page accent shard for `/scan` and `/ai-delivery`. No change. |
| `--dim` | `#a3a09b` | subtle silver/frosted white | Satisfies — a desaturated warm-grey close to frosted silver, already tuned once for WCAG AA (comment on line 45 notes the bump from `#888`). No change. |
| `--ember` / `--oxblood` | `#FF5A3A` / `#5C1F1A` | (not in brief, but check for brief-violation) | Both are used narrowly (ember = global urgency/RESOLVED state; oxblood = `/compliance` mood only) — neither reads as neon or rainbow-gradient; both stay inside a single accent-per-context discipline. No change. |
| `--text` / `--border` | `#E0E0E0` / `#1A1A1A` | restrained ink | Satisfies — flat, no colour cast, no glow baked into the base text colour. No change. |
| Spacing scale (`--space-*`) | fluid clamp scale | n/a (structural, not aesthetic) | Not part of the aesthetic brief; already coherent and fluid-tuned per the 2026-07-11 mobile pass. No change. |
| Radius scale (`--radius-sm/md/lg`) | 3 / 6 / 24px | "expensive because restrained" | Satisfies — small radii on functional elements, one large radius reserved for hero-scale cards. No pill-shaped/bubbly UI, no glass-morphism radius abuse. No change. |

No genuinely missing color, spacing, or radius token was found. The gold tritone and the single-role `--ice` usage are, if anything, stronger evidence of restraint than the brief itself asked for.

## 2. Typography

Grep across `app/about/page.tsx`, `app/methodology/page.tsx`, `app/black-ice/page.tsx`, `app/black-ice/doctrine/page.tsx` confirms one consistent hierarchy in practice, not per-page drift:

- **Display / H1–H3**: `fontFamily: "var(--font-display), Georgia, serif"` paired with `--fs-h2` / `--fs-h3` — used identically on every page checked, including `app/black-ice/doctrine/page.tsx` (built same day as this audit), which uses the exact same pairing at lines 37/39, 305, 358/360.
- **Body**: `fontSize: "var(--fs-body)"`, `color: "var(--text)"`, line-height 1.75–1.9 — the standard prose paragraph across all four pages, no page substitutes a different body font or size.
- **Technical microcopy / eyebrow labels**: `.font-mono` utility class (`--font-mono`, 0.06em tracking) — reserved for labels, not body copy.
- **Wordmark**: `.font-wordmark` — 300 italic display serif, one dedicated "editorial luxury" moment, used sparingly by design (not found inside body copy in the pages sampled).
- **Inline `<code>`**: appears in `app/methodology/page.tsx` and `app/scan/page.tsx` (nmap/openssl/curl/dig examples, "remove" keyword) with **no CSS rule targeting bare `<code>`** — see §4 gap below.

Conclusion: the hierarchy already reads as "technical precision (mono labels, tabular-nums, monospace command snippets) + editorial authority (serif display, italic wordmark)." This is not a needed change — it is the existing, deliberately-built pattern, confirmed instead of assumed.

## 3. The Ω symbol

`grep -rn "Ω\|Omega" app --include=*.tsx` returns **zero matches**. The glyph is not used anywhere in the codebase today.

**P2 recommendation (not implemented now)** — if the brand bible in progress calls for Ω as a rare seal, the minimal, restrained placement would be:
- A single small glyph (`--fs-sm`, `--gold-dim` colour, `.font-display` family) inside the footer identity block, next to or in place of a decorative rule — one occurrence per page, not repeated per section.
- Alternatively, as the glyph in `.divider-gold`'s centre, replacing the plain gradient line on section boundaries that already carries a similar "seal" function.

Either option reuses only existing tokens (`--gold-dim`, `--fs-sm`, `--font-display`) — no new token required even when this ships. Left undone pending the brand bible; do not implement yet since it changes page-level markup, which is outside this audit's remit.

## 4. Gap check — was anything genuinely missing?

One real, narrow gap found: **no base style for the native `<code>` element.** `globals.css` defines `.font-mono` as an opt-in utility, but nothing targets bare `<code>` tags, and several pages use bare `<code>` for terminal commands (`nmap`, `openssl s_client`, `curl`, `dig`) and the `remove` keyword instruction. Today these render in each browser's unstyled default monospace, uncoupled from `--font-mono` and from any Vault colour token — the one place where "technical precision" typography is left to browser defaults instead of the site's own system.

This is a rule gap, not a token gap: no new custom property is needed, only a `code { font-family: var(--font-mono), ... }` base rule wired to tokens that already exist. Implementing it would change the rendered appearance of existing pages (`methodology`, `scan`) that currently rely on browser defaults for `<code>`, which this audit's brief explicitly puts out of scope ("do not restyle existing pages"). **Recommending, not adding**: a follow-up pass (owned by whoever next touches `globals.css` base styles) should add a `code, kbd { font-family: var(--font-mono), "SF Mono", Menlo, monospace; background: rgb(var(--gold-rgb) / 0.06); padding: 0.1em 0.35em; border-radius: var(--radius-sm); color: var(--gold-warm); }`-style rule, reusing existing tokens only.

No other gap qualified — no missing focus-ring colour (`--gold` already covers `:focus-visible` at line 505), no missing surface tone (near-black blue already exists as `--vault-cool`), no missing accent (cyan and gold both exist and are already usage-scoped).

**Zero tokens added to `globals.css` in this pass.**

## 5. Verdict

The existing system already delivers the target aesthetic. The gold tritone, the single-role cyan, the warm/cool near-black surface pair, and the site-wide serif-display + mono-label + tabular-nums typographic pattern are not approximations of "obsidian, cold metallic, restrained, expensive" — they are that brief, already built and already consistently applied across every page sampled, including the doctrine page built the same day as this audit.

**The one thing actually worth changing**, when someone next has global-CSS in scope: give bare `<code>` a base rule tying it to `--font-mono` and the gold system, so terminal-command copy on `/methodology` and `/scan` stops falling back to browser-default monospace. Not done in this pass — it touches rendered output on existing pages, which was explicitly out of scope here.
