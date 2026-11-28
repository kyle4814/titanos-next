# Sitewide design system, 2026-11-28 (obsidian, graphite, warm metallic gold)

Foundation branch: `build/sitewide-obsidian-gold-2026-11-28`. Page agents branch from it and follow this file.
Reference: the homepage (`components/home-redesign/`), screenshots in `/home/tech2/klinge-kernel/state/research/d89e1778/ocean/site_redesign_2026-11-28/`.

## Rules for page agents
- Visual restyle only. Keep content, facts, numbers, links, routes. Do not touch APIs, Workers, Stripe, checkout, booking or form-submission logic. Do not touch `app/shop`, `app/products`, `app/order`.
- Australian English, no em or en dashes in copy.
- Do NOT add a header or footer to a page. `app/layout.tsx` renders `Nav` and `Footer`, and both now render `HomeNav` / `HomeFooter` on every route.
- Do NOT import `home-redesign.css` or `site-system.css` in a page. Both are imported once in `app/layout.tsx` (site-system.css last).
- Prefer tokens and the classes below over new inline hex colours. Never hard-code a font family: use `var(--font-body)` (Geist) or `var(--font-mono)`. `var(--font-display)` now resolves to Geist, so old inline uses are safe but italic display text should be un-italicised.
- Keep one `h1` per page, keep landmarks, keep visible focus. Respect `prefers-reduced-motion`. No layout shift (reserve image and embed boxes).
- Gold is an accent: one gold button per view, gold text for eyebrows, numbers and links only.

## Where things live
| File | Role |
| --- | --- |
| `app/site-system.css` | Canonical tokens (`--pe-*`), sitewide base (canvas, type, links, forms, tables), primitive classes |
| `components/home-redesign/home-redesign.css` | Shared chrome (`.pe-nav`, `.pe-footer`, `.pe-btn`, `.pe-card`) plus homepage-only sections (scoped by `main:has(.pe-hero)`) |
| `app/globals.css` | Legacy Vault tokens (left byte-identical: `scripts/test_print_chrome_class.mjs` pins it); `site-system.css` re-points them at the new palette |
| `components/Nav.tsx`, `components/Footer.tsx` | Thin wrappers that render `HomeNav` / `HomeFooter` |
| `components/home-redesign/HomeNav.tsx` | Header: Platform, Proof, Case Studies, Products, Contact, More (every other `lib/navLinks.ts` LINKS entry), gold CTA, mobile drawer |
| `components/home-redesign/HomeFooter.tsx` | Footer: merged old and new columns, "All pages" disclosure from LINKS, legal row |

Adding a page to `lib/navLinks.ts` LINKS makes it appear in the header More menu, the mobile drawer and the footer All pages list automatically.

## Tokens (all on `:root`)
Palette: `--pe-bg #060708` (canvas), `--pe-bg2 #0a0b0d`, `--pe-card #0e1013`, `--pe-card2 #121418`, `--pe-line rgba(255,255,255,.10)`, `--pe-line-strong .20`, `--pe-line-gold rgba(212,175,55,.34)`, `--pe-gold #d4af37`, `--pe-gold-hi #f3d98c`, `--pe-gold-lo #b8892e`, `--pe-text #f4f2ec`, `--pe-mute #b4b2ad`, `--pe-faint #8f8d88`, `--pe-ok`, `--pe-warn`, `--pe-gold-grad` (button gradient), `--pe-gold-text-grad` (headline accent).

Type (Geist, one family; IBM Plex Mono only for code and small labels): `--pe-fs-display` (hero, 2.5 to 4.4rem), `--pe-fs-h1`, `--pe-fs-h2`, `--pe-fs-h3`, `--pe-fs-lead`, `--pe-fs-body`, `--pe-fs-sm`, `--pe-fs-xs`; eyebrow tracking `--pe-track-eyebrow` (0.28em, uppercase, gold, 12px).
Spacing: `--pe-sp-1..8` (4, 8, 12, 16, 24, 32, 48, fluid 48 to 88), `--pe-section-y`; layout `--pe-wrap` 1340px, `--pe-gutter` 32px (20px under 720px).
Radii: `--pe-r-sm` 6, `--pe-r-md` 8 (buttons, inputs), `--pe-r-card` 12, `--pe-r-pill`.
Shadows: `--pe-shadow-card`, `--pe-shadow-pop` (menus), `--pe-shadow-btn`.
Motion: `--pe-ease`, `--pe-dur` 0.18s.

Legacy tokens (still valid, same look): `--vault-black` = bg, `--vault-warm` / `--card` = card, `--text`, `--dim` = mute, `--border` = line, `--ice` = warm ivory (was cyan), `--gold` #d4af37, `--gold-dim`, `--gold-bright`. Existing inline styles that use them already render in the new palette. `--radius-md/sm/lg` now map to 12/8/12px.

## Base behaviour (automatic, no class needed)
- Canvas is flat obsidian: the grain, lattice, mesh blobs, specular sweep and edge thread are hidden.
- `h1` to `h6`: Geist 700, white, tight tracking. A heading with an inline gold colour stays gold.
- Links: gold-hi (`:where(a)`, so any class wins). Prose links inside `main p` and `main li` are underlined gold.
- `main` inputs, selects, textareas: graphite fill, 1px line, 8px radius, gold focus ring. `main table` and `th`: gold uppercase header, hairline rows. Inline styles still win, so only fix inline colours that clash.
- Submit buttons without a class get the gold button look.

## Primitives
Components (import and use as before, they are already restyled):
- `PageHero` (`components/PageHero.tsx`): props `badge`, `title`, `tagline`, `sub`, `children` (CTA row), `trustLine`. Renders `.pe-pagehero` (gold glow top, 800 weight h1, pill badge, gold rule). Use exactly one per page.
- `SectionHeading` (`components/SectionHeading.tsx`): props `title`, `lead`, `showKeyhole`, `sigilIndex`. Renders `.pe-sechead` (centred h2, gold rule, mute lead).
- `SectionReveal` (`components/SectionReveal.tsx`): behaviour only (fade up on scroll, reduced-motion safe). Wrap a section; put layout classes in `className`.
- `AnimatedButton` (`components/AnimatedButton.tsx`): `variant="primary"` is now the gold gradient button (dark text, 8px radius, 600 weight); `variant="secondary"` is a gold-hi text link with arrow.
- `OfferTile` (`components/offers/OfferTile.tsx`) and `OfferCard` (`components/OfferCard.tsx`): graphite card, gold edge on featured, white name, gold-hi price. Use for any offer grid.
- `BlogBody` / `BlogPostCard`: prose and cards via `components/w2b/blog.module.css` (white 700 headings, gold-hi links, 12px cards).
- `HomeNav`, `HomeFooter`: do not render these in pages.

Classes (use in page markup):
| Class | Use |
| --- | --- |
| `.pe-page` / `.pe-page--narrow` | Centred wrapper: width `min(100% - 2*gutter, 1340px)`; narrow caps at 860px |
| `.pe-section` | Vertical rhythm plus top hairline between sections |
| `.pe-section__head` | Flex row: h2 left, short `p` right (wraps on mobile) |
| `.pe-eyebrow-line` | Gold uppercase eyebrow above a heading |
| `.pe-goldtext` | Gold gradient text for one accent phrase inside a heading |
| `.pe-card` (+ `.pe-card--pad`, `.pe-card--link`, `.pe-card--gold`) | Graphite card with gold top hairline; `--link` adds hover lift and gold border; `--gold` highlights the recommended one |
| `.pe-grid` / `.pe-grid--2` | Auto-fit card grid (280px or 420px min columns, 16px gap) |
| `.pe-btn` + `.pe-btn--gold` / `.pe-btn--dark` / `.pe-btn--lg` | Buttons (for plain links and buttons; `AnimatedButton` for the animated CTA) |
| `.pe-lead`, `.pe-muted` | Lead paragraph, secondary text |
| `.pe-prose` | Long-form text (68ch, 1.75 line height, gold list markers, gold-hi links, quote with gold rule) |
| `.pe-field` | Label above input, 44px min height, 16px font (no iOS zoom) |
| `.pe-table-wrap` | Scroll container with border and card fill around a `table` |
| `.pe-tag--pill`, `.pe-kicker`, `.pe-textlink` | Small pill label, card kicker, inline gold link with arrow (from home-redesign.css) |

## Page recipe
```tsx
<>
  <PageHero badge="Proof" title="..." tagline="..." sub="...">
    <AnimatedButton href="/book">Book a free call</AnimatedButton>
  </PageHero>
  <div className="pe-page">
    <SectionReveal className="pe-section">
      <div className="pe-section__head"><h2>...</h2><p>...</p></div>
      <div className="pe-grid">
        <div className="pe-card pe-card--pad">...</div>
      </div>
    </SectionReveal>
  </div>
</>
```
Check before finishing a page: narrow phone (390px) has no horizontal scroll; tab order and focus rings visible; no inline `#0b0908`, cyan, or serif italics left; contrast of any custom text colour at least 4.5:1 on `--pe-card`.

## Known notes
- `lib/navLinks.ts` DESKTOP_LINKS is no longer rendered (the header uses a More menu) but stays for `scripts/test_nav_links.mjs`.
- The sigil seal row and the "every symbol" line were dropped from the footer; the footer text, ABN, privacy and terms are kept.
- A worktree needs a clean `npm ci`; a copied or symlinked `node_modules` breaks the Turbopack PostCSS step.
