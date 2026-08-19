# BLACK ICE — Build Report (Phase 1 of the full master-prompt scope)

Date: 2026-08-20

## What this document is

The master prompt Kyle gave specifies a 44-section, 24-phase build: a full
public Black Ice product (landing + 12 subroutes), a downloadable PDF field
guide, an interactive AI Mirror tool, a 5-minute polling system, a social
content repo, internal agent definitions, plus SEO/security/performance/test
passes across all of it. That is genuinely weeks of work, not one session.

Per the doctrine's own Pareto Frontier and "do not build elaborate products
before validating demand" rules, this report documents the full inspection
and a phased plan, then Phase 1 ships the highest-leverage real slice —
not a shallow pass across all 44 sections. Padding every section thin would
violate the doctrine's own integrity rule more than shipping less, well.

## 1. Existing architecture (inspected, not assumed)

- **Stack**: Next.js 16 (Turbopack), React, TypeScript, Tailwind (PostCSS),
  Framer Motion, GSAP, `@react-three/fiber`/`three` (used sparingly).
- **Output**: `output: 'export'` — fully static HTML export, deployed by
  force-pushing `out/` to the `gh-pages` branch of
  `github.com/kyle4814/titanos-next` (see `DEPLOY_NOW.sh`). GitHub Pages
  serves it at titanos.tech (CNAME in `public/`). No SSR, no API routes —
  everything server-side lives on the separate Cloudflare Worker
  (`api.titanos.tech`, `~/titan/vault/worker.js`) and Flask backend.
- **Design system**: dark "vault" aesthetic already exists and already
  *is* Black Ice — `--vault-black`, `--vault-warm`, `--gold`, `--gold-dim`,
  `--ice`, `--dim` tokens in `app/globals.css`; `VaultFrame`, `VaultBackground`,
  `VaultKeyhole`, `GoldDust`, `GoldThread`, `TerminalSnippet`, `CursorTrail`
  components. Per the master prompt's own rule ("if the existing design
  language is stronger than a new interpretation, use it as source of
  truth") — **no new visual identity was invented.** Black Ice content
  uses the existing system unchanged.
- **Content architecture**: blog is a single typed data array
  (`lib/blog.ts`, `POSTS: BlogPost[]`), rendered through
  `app/blog/[slug]/page.tsx` via a small `ContentBlock` union (p/h2/h3/ul/
  ol/quote/cta/p-link) — deliberately not MDX (static export, zero markdown
  tooling installed, one content pipeline not two). New long-form content
  extends this pattern, doesn't replace it.
- **Page pattern**: every content page (`/about`, `/methodology`,
  `/compliance`) is `PageHero` (badge/title/tagline/sub/trustLine/CTAs) +
  `SectionReveal` blocks + `SectionHeading` + `FaqItem` list + closing CTA
  section, all inline-styled reading CSS custom properties — no CSS-in-JS
  library, no component library beyond the repo's own ~40 components.
- **Nav**: `components/Nav.tsx` — desktop shows `LINKS.slice(0, 6)`
  deliberately (documented in-file: "five revenue doors plus blog"), the
  rest live in the mobile drawer + footer. This was a considered call in
  an earlier session, not an oversight.
- **SEO**: per-page `metadata` export (title/description/canonical/OG/
  Twitter card), manual `app/sitemap.ts` (static array + `POSTS.map`, NOT
  auto-discovered from the route tree — new routes must be added here by
  hand or they're invisible to search engines), FAQ JSON-LD pattern
  already used on `/about` and `/methodology`.
- **Existing interactive components** relevant to later phases:
  `TierQuiz.tsx`, `ScopeChecker.tsx`, `RoiEstimator.tsx` (existing
  self-serve interactive tools — reference pattern for a future 5-minute
  polling widget), `PdfViewer.tsx` (existing PDF rendering — reference for
  a future downloadable field guide), `SiteAnalytics.tsx` (existing event
  tracking — reference for `black_ice_view` etc. events).
- **Testimonials**: `lib/testimonials.ts` / `Testimonials.tsx` exist and
  are real — the master prompt's rule against fabricating testimonials or
  metrics is followed by construction: Black Ice content links to real,
  existing verification surfaces (self-scan, methodology, ABN) exactly
  like `/about` already does, not new unverifiable claims.

## 2. What "Black Ice" already is vs. what's new

The **operating doctrine itself** already existed and is committed at
`~/titan/TITANOS_BLACK_ICE_DOCTRINE.md` and `~/.claude/CLAUDE.md` (added
2026-08-20, prior session) — that's the internal AI-execution framework.
This build is the **public-facing product artifact** derived from it: a
free field guide + landing page that (a) is genuinely useful on its own,
(b) demonstrates the operating philosophy behind how TITANOS itself is
built, (c) funnels naturally into the existing TITANOS service pages.

## 3. Phase 1 scope — what ships this session

- `/black-ice` — landing page. Hero states the concept in one screen,
  compressed primitives grid, CTA into the field guide + into TITANOS
  services. Mobile-first per master-prompt §30, reusing `PageHero`.
- `/black-ice/doctrine` — the field guide itself, compressed to real
  substance: Sub-Zero Murmur, Child/Operator, Web Slider, Demon Blade
  (red-team-for-preservation), 99/1 (heuristic not law), Zero-Dependency,
  Pareto Frontier, Scientific Loop, Compression, Governed Autonomy, the
  Core Loop, plus an explicit **metaphor vs. mechanism** section using the
  existing `MirrorLists` do/don't component — satisfies master-prompt §33
  (intellectual integrity: never state metaphor as established fact)
  structurally, not just as a disclaimer paragraph.
- One cornerstone blog post in the existing `POSTS` array introducing
  Black Ice and linking into `/black-ice` — seeds the content engine
  (§18) without inventing a parallel content pipeline.
- Nav/footer link, `sitemap.ts` entries, per-page SEO metadata + FAQ
  JSON-LD, mobile check, build + deploy + live verification.

## 4. Explicitly deferred (documented per §11 Pareto Frontier, not skipped silently)

Not built this session — each is real scope needing its own pass, and
building them now, thin, would be exactly the "empty branding" the master
prompt warns against:

| Item | Why deferred |
|---|---|
| 12 separate `/black-ice/*` subroutes (one per primitive) | One well-structured field guide page teaches better than 12 thin stub pages with near-zero unique content each; can split later if traffic/engagement data justifies it (§35: validate demand before building elaborate structure) |
| Downloadable PDF | `PdfViewer.tsx` exists for *viewing* PDFs, not generating them — needs a real generation pipeline (no PDF lib in `package.json`), genuine scope on its own |
| AI Mirror interactive tool | This is a real product feature (an LLM-backed reflection tool), not a content page — needs its own API route, and this repo has zero API routes today (pure static export) — needs the Flask/Worker backend, not the frontend |
| 5-minute polling system | Same — stateful, needs backend + auth story; `TierQuiz`/`RoiEstimator` are the right reference pattern once scoped |
| Social content repo (`/content/social/`) | Real content-writing work, not a code/architecture task — better done as its own focused pass once the field guide's actual language is finalised (writing social copy about a page that doesn't exist yet is backwards) |
| Internal agent definitions (`BLACK_ICE_ORCHESTRATOR` etc.) | These are prompt-engineering artifacts for *my own* future operation, not part of the public website — belongs in `~/.claude/` or `~/titan/`, not `titanos-next` |
| Security/performance/full test pass across the whole site | Scoped to the actual diff (2 new pages, 1 blog post, nav/sitemap edits) rather than re-auditing the entire existing site, which is out of scope for "add Black Ice" |

## 5. Next highest-leverage actions (in order)

1. Ship Phase 1, verify live, watch `black_ice_view` / `cta_click` events
   if `SiteAnalytics` is wired to a real backend (check before assuming).
2. If engagement is real: split the field guide's strongest sections into
   their own routes, backed by actual read-time/scroll data, not guessing.
3. AI Mirror and polling system only once there's a backend route to hold
   them — that's a Worker/Flask task, flagged for a separate session.
