# Site audit rules

Canonical reference for live-URL audits against titanos.tech. **Audit
the live HTTP response, not source files** — local greps miss
constants in `lib/pricing.ts`, sub-components, and rendered meta tags.

## Audit method

```bash
for page in / /scan /compliance /ai-delivery /monitor /our-evidence-pack; do
  curl -s "https://titanos.tech$page" > "/tmp/audit_$(echo $page | tr / _).html"
done
```

Then grep the saved files. Live response is the only ground truth.

## Pages

### / (homepage)

| Check | Rule |
|---|---|
| H1 includes "One operator. Three doors in" | MUST be present |
| Real `mailto:` links | MUST be 0 |
| `banner-grade` | MUST be 0 |
| `Domain-or-ABN` | MUST be 0 |
| Monitor surfaced (`Titanos Monitor` or `/monitor`) | MUST be present |

CSP allowlist `form-action 'self' mailto:` is in the meta tag — it is
NOT a link. When grepping for mailto, exclude `form-action ['"]self['"] mailto:`.

### /scan

| Check | Rule |
|---|---|
| `data-analytics="scan-form"` (ScanRequestForm component rendered) | MUST be present |
| `CVE-2023-22094` | MUST be 0 (fabricated Oracle CVE on MySQL line) |
| `top-ports 15` (new terminal example via TerminalSnippet) | MUST be present |
| `Personally reviewed` | MUST be present |
| `Expert-reviewed` | MUST be 0 (across body AND meta tags) |
| `KEX` on MySQL line | MUST be 0 |
| Real `mailto:` links | At most 1 — the noscript fallback inside ScanRequestForm |

`Expert-reviewed` is checked across the whole document including
`<meta name=description>`, `<meta property="og:description">`, and
`<meta name="twitter:description">`. A miss in `metadata` exports
manifests as a non-zero count even when body text is correct.

### /compliance

| Check | Rule |
|---|---|
| "3 months of Monitor free" or "3 months of Titanos Monitor free" | MUST be present |
| `$199` (monthly monitoring surcharge) | MUST be 0 — Monitor is included free for 3 months, $149/mo only if you opt in |
| `banner-grade` | MUST be 0 |
| Vanta mentions | MUST be ≥ 1 (anchor in hero block) |
| Insurance / insurer (insurance denial row) | MUST be present |
| NDB runbook / "step-by-step plan for the day" | MUST be present (jargon-translated form) |
| H1 contains `or face up to AU$50M` | MUST be 0 (the OLD fear-bomb H1) |
| Any `$50M` mention | ALLOWED inside a FOUR DEADLINES row (ADM disclosure deadline #3) or contextual penalty mention. NOT allowed as hero copy. |

To check the H1 specifically rather than the whole page, slice the
`<h1>` tag:

```bash
grep -oE '<h1[^>]*>.*?</h1>' /tmp/audit__compliance.html | head -3
```

The `$50M` figure is factually correct in the ADM deadline row. The
audit rule that was wrong was the blanket "$50M must be 0" — the
real intent is to keep $50M out of the H1 / hero scare position.

### /ai-delivery

Prices come from `lib/pricing.ts` (constants) → `${DISPLAY.X}`
template literals → inlined at build time. Source greps for literal
prices return 0. Live greps return the rendered figures.

| Check | Rule |
|---|---|
| `Diagnostic.*4,997` | MUST be present |
| `9,997` build floor | MUST be present |
| `Ops Retainer` | MUST be present |
| `990` or `1,990` retainer band | MUST be present |
| `1% human review` (FAQ → callout promotion) | MUST be present |
| `Titanos Security` body string | MUST be 0 — the sister-brand split is killed |
| `From AU$4,997` (the OLD single-rung pricing) | MUST be 0 |

`Titanos Security` source mention in `app/ai-delivery/page.tsx:514`
is a code COMMENT (`// Fix 5d — kill "Titanos Security" sister-brand
split`). The body string is gone. Source grep flags it; live grep
correctly returns 0. Always audit live.

### /monitor

| Check | Rule |
|---|---|
| HTTP 200 | MUST |
| Monitor referenced in homepage nav | MUST |

### /our-evidence-pack

| Check | Rule |
|---|---|
| HTTP 200 | MUST |

## Audit blind spots that have burned us

1. **Prices as constants.** `${DISPLAY.AI_BUILD_FLOOR}` reads as 0 in
   source grep, 4 hits on live. Always check live.
2. **Components.** Terminal example lives in `components/TerminalSnippet.tsx`,
   not `app/scan/page.tsx`. Page grep returns 0; component grep + live
   both return ≥ 1.
3. **Meta tags vs body.** `Expert-reviewed` can appear in `meta`,
   `og:description`, `twitter:description` even when body text says
   `Personally reviewed`. Voice passes must touch every `Metadata`
   export, not just JSX.
4. **Code comments.** `// kill "X"` markers stay in source after the
   string is removed from body. Source grep hits them; live doesn't.
5. **CSP allowlist.** `form-action 'self' mailto:` in `<meta http-equiv="Content-Security-Policy">`
   is a directive, not a link. Exclude it before counting `mailto:`.

## Deploy mechanism (for context)

- Source on `main` is built by Next.js 16.x with `output: "export"`.
- `next build` writes static HTML to `out/`.
- gh-pages branch is replaced by `out/` contents + `CNAME` + `.nojekyll`
  via an orphan-branch force-push. No CI workflow — deploys are manual.
- `ops/UPDATE_MONTHLY.md` covers the monthly slot-config bumps;
  this file covers the audit/QA layer.

## Backup branch convention

Before any gh-pages force-push, snapshot the current state:

```bash
git fetch origin gh-pages
git branch gh-pages-backup-YYYY-MM-DD origin/gh-pages
git push origin gh-pages-backup-YYYY-MM-DD
```

Keep the most recent 2 backup branches. Delete older ones when audit
on the new deploy passes and stays green for at least 24 hours.
