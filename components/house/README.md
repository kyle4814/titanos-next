# components/house: the house look, as reusable parts

Import from `@/components/house` (barrel) or by file. CSS lives in `house.css`, loaded once by `app/layout.tsx`.
All parts keep the black ice + gold brand, honour `prefers-reduced-motion`, and add no JS unless stated.

| Part | Kind | What it does |
|---|---|---|
| `GlowCard` | client, ~0.4 KB | Glass card with a cursor spotlight via `--mx/--my` (no React state). Props: `as`, `href`, `className`, `style`. Spotlight and lift only on hover-capable pointers. |
| `BentoGrid` + `BentoItem` | server, no JS | 12-column bento, one column under 768px. `BentoItem span={3..8,12} rows={1..3}`. Put a `GlowCard` inside an item, or pass `className="h-glow"`. |
| `Ticker` | server, no JS | CSS marquee. `items` (ReactNode[]), `seconds`, `label`. Pauses on hover/focus; becomes a wrapped row under reduced motion. Duplicate row is `aria-hidden`. |
| `ShaderBackdrop` | client, lazy | Paper Shaders `MeshGradient` (own chunk, loaded only after: a real `navigator.gpu` adapter, first user interaction, no reduced motion, no save-data). CSS gradient fallback always painted. Put inside a `position:relative` parent; children need `position:relative; z-index:1`. |

## Page-agent rules

- Do not wrap `GlowCard` content in `SectionReveal` twice; wrap the section, not each card.
- `SectionReveal` now uses native scroll-driven animation where supported (`animation-timeline: view()`), IntersectionObserver elsewhere (Firefox, Safari < 26). Do not add your own `opacity:0` initial styles.
- Route transitions are native cross-document View Transitions (`@view-transition { navigation: auto }` in globals.css), which works with `output: 'export'`. The nav carries `view-transition-name: site-nav` so it stays still. React's `<ViewTransition>` is NOT used: it needs React 19.3 and this repo is on 19.2.4. Do not give two elements the same `view-transition-name`.
- JS budget: `/` sits at 247.1 of 250 KB strict. Anything that adds initial JS to a route must be `lazy`/dynamic, or `npm run build` fails the js_budget gate.
