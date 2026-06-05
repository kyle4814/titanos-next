# STAGED DECISIONS — Kyle Must Supply
**Wave 1 audit remediation. Items below require Kyle input, content, or design greenlight before code ships.**
**Date:** 2026-06-05

---

## TRUST-01 + TRUST-04 — Social Proof & About-the-Operator

### What Kyle must supply

**Social proof (for homepage + /compliance):**
- One testimonial paragraph from a beta client (anonymisable — e.g. "Principal, allied health practice, QLD" is fine). Extract as an engagement condition if you haven't already.
- If no client testimonial yet: publish titanos.tech's own scan result at `/our-scan` (ICP-B respects self-attestation more than testimonials at zero-proof stage).

**About the operator (for /compliance "About Kyle" callout, ~150 words):**
- Kyle's LinkedIn profile URL (currently not linked anywhere on the site)
- A headshot photo: square, minimum 400×400px, professional but not corporate (operator register)
- ABN verify URL to link directly: `https://abr.business.gov.au/ABN/View?id=34318502254`
- Any certifications held (IRAP / ISO 27001 lead / CISSP / CySA+ / ASD Essential Eight assessor credential) — even in-progress counts. If none, confirm so "no certs" framing can be handled honestly.
- 1-2 anonymised prior engagement names or industries ("NDIS provider, 18-staff", "accounting practice, Brisbane") — these can be paraphrased

**Implementation:** Agent B or Wave 2 session. Once Kyle supplies the above, the About callout and testimonial block are S-effort code changes.

---

## AES-08 — Corner-Bracket Signature Device

### Design direction proposal (Agent A recommendation)
Add ONE ownable graphic device: a corner-bracket SVG component (gold `#D4AF37`, 16×16, four-corner motif borrowed from instrument bezels and gunsight HUDs). Apply to hero-priority cards only: the 3 OfferCards on homepage + compliance offer block + AI offer block. One device, used sparingly, becomes ownable and breaks the generic-grid-template smell without touching the type system.

### Kyle must confirm or override
- Greenlight the corner-bracket direction, OR
- Propose alternative: monogram watermark / embossed rule / diagonal hatching / other device Kyle has in mind
- This is a full own-session design build once greenlit (Effort M).

---

## AES-14 — OG Image Regen

### Current
OG image text reads: `"TITANOS · AU/NZ/SG SECURITY"`

### Proposed change
`"TITANOS · AU/NZ/SG · Security + Compliance + AI Delivery"`

### Kyle must supply
- Confirm the new text string (or amend)
- Confirm background/palette stays identical (black + gold, Cinzel wordmark)
- Once confirmed: regenerate `public/og-image.png` at 1200×630. This can be done in a single session with a Canvas/Puppeteer script or Figma export.

---

## AES-19 — Terminal-Snippet Visual on /scan

### Audit finding
/scan page is text-dense. An inline terminal snippet showing a sample nmap command and a 3-line output excerpt would (a) signal technical credibility to ICP-B and (b) give ICP-A a visceral sense of "this is real" without reading 8 FAQ items.

### Kyle must supply
- Confirm direction (yes/no)
- If yes: provide a real (sanitised) nmap output excerpt from an actual scan (10-15 lines). Titanos's own scan of titanos.tech would be ideal. Alternatively, a fabricated-but-realistic example for a generic `.com.au` domain.
- Implementation: S-effort styled `<pre>` block with gold terminal chrome. Own session.

---

## Design-System Refactor

**AES-01 (spacing tokens), AES-02 (33→8 type scale), AES-05 (rgba gold decompositions), AES-06 (border-radius), AES-04 (ok/warn tokens)**

This is a full design-system session (Effort L × 5 findings). All globals.css + every component touched. No partial approach — do it as one motion or not at all to avoid mid-refactor drift.

**Kyle must decide:** Is the design-system refactor a named sprint (Wave 3)? Or defer until post-first-close? Recommend: post-first-close. The visual read is already above-average; the refactor is correctness, not conversion.

---

## MOT-01 — useReducedMotion

Wire `useReducedMotion()` from Framer Motion across all 10+ animated components: HeroEntrance, VaultFrame, GoldDust, CursorTrail, AnimatedButton, Nav (opacity delay), DeadlineCounter, FaqItem, GoldThread steps, VerifyKeys.

**Kyle must decide:** Schedule as a dedicated motion session (Wave 3 or 4). This is WCAG 2.3.3 — it's a legal compliance gap for a vendor selling WCAG-adjacent work. Recommend shipping before any compliance client onboards.

---

## PERF-01 — Bundle Trim

Replace Framer Motion with CSS-only animations for hero entrance + nav fade + button sweep (saves ~150KB). Tree-shake Lucide to per-icon imports (saves ~30KB). Mark CursorTrail, GoldDust, VaultFrame as `requestIdleCallback`-deferred. Target: mobile Lighthouse 85+.

**Kyle must decide:** Scope as dedicated perf session. Prerequisite: MOT-01 done first (so reduced-motion logic isn't re-built twice).

---

## ICP-02 — /for-smb Landing Variant (Steps 3-4)

A new page at `/for-smb` built ICP-A-first: strips banner-grade vocab, leads with "Get Privacy Act compliant by 11 December 2026", working-call framing, "we translate technical stuff for you" reassurance, compliance + scan only (no AI Implementation), and a plain-language FAQ.

**Kyle must decide:** Own session. Prerequisite: COPY-01/02/03 homepage rewrites done first (Agent B owns those) so the ICP-A voice register is locked before /for-smb is written.

---

## HSTS Preload Submission

**Kyle action required — 5 minutes.**

1. Go to https://hstspreload.org
2. Enter `titanos.tech`
3. Confirm the `preload` directive is present (it is: `max-age=31536000; includeSubDomains; preload`)
4. Submit

Preloading takes 1-3 months to propagate. Submit now — nothing in the site build blocks it.

---

## Summary Table

| ID | Item | Kyle Input Needed | Effort to Ship Once Supplied |
|---|---|---|---|
| TRUST-01 | Testimonial | Client quote or own-scan export | S |
| TRUST-04 | About-the-operator | LinkedIn URL, headshot, certs, 2 anonymised clients | S |
| AES-08 | Corner-bracket device | Greenlight or alt direction | M (own session) |
| AES-14 | OG image text | Confirm new string | S (regen script) |
| AES-19 | Terminal snippet | Sample nmap output (sanitised) | S |
| Design system | AES-01/02/04/05/06 | Schedule as named sprint | L (own session) |
| MOT-01 | useReducedMotion | Schedule as motion session | L (own session) |
| PERF-01 | Bundle trim | Schedule as perf session (after MOT-01) | L (own session) |
| ICP-02 | /for-smb page | Schedule (after COPY-01/02/03 done) | L (own session) |
| HSTS | hstspreload.org submit | Kyle submits directly | 5 min |
