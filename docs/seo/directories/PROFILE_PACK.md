# Canonical NAP and profile pack: Titanos (draft, nothing submitted)

Prepared 2026-11-28. Source of every fact: site footer and /contact, lib/jsonld.ts Organization block, ABR record linked from /contact. Use these strings exactly, character for character, on every listing (NAP consistency).

## NAP and identifiers
| Field | Value |
|---|---|
| Business name (display) | Titanos |
| Legal entity | Kyle Montrose Deligny, sole trader |
| ABN | 34 318 502 254 (check the ABR trading name matches before any citation: https://abr.business.gov.au/ABN/View?id=34318502254) |
| Business type | Service-area business. No street address is published (home-based; privacy rule). Where a directory forces an address, use the service-area or city-only option, never a street. |
| City, state, country | Brisbane, QLD, Australia |
| Service area | Australia-wide (remote); base Brisbane |
| Phone | [PHONE: Kyle to supply one business number; do not use a personal mobile unless he chooses to] |
| Email | kyle@titanos.tech |
| Website | https://titanos.tech |
| Free check URL | https://titanos.tech/scan |
| Shop URL | https://titanos.tech/shop |
| Founder | Kyle Deligny |
| Languages | English (en-AU) |
| Hours | By appointment (leave blank where a field is optional) |
| Founded | [YEAR: Kyle to confirm; do not guess] |
| Pricing | AUD, no GST charged (as stated on /shop) |

## Categories (use the closest available on each platform)
1. Primary: Computer consultant (GBP alternative: Business management consultant).
2. Secondary: Information technology consultant; Software company is not appropriate (we sell services and digital documents).
3. Tags where free text is allowed: AI automation, Privacy Act compliance, email security, DMARC, Essential Eight, small business, Brisbane.
Check each platform's live category list on the day; names change.

## Descriptions
### 50 characters (48)
Brisbane AI and privacy help for small business.

### 150 characters (141)
Titanos is a solo Brisbane practice helping Australian small businesses with AI automation, Privacy Act compliance and email security checks.

### 300 characters (299)
Titanos is a solo Brisbane practice run by Kyle Deligny. We help Australian small businesses with practical AI automation, Privacy Act compliance and external email and domain security checks. We use public records only, replace nobody and keep your IT provider in charge. Start with the free check.

### 750 characters (681)
Titanos is a solo practice in Brisbane, Queensland, run by Kyle Deligny (ABN 34 318 502 254). We help Australian small businesses use AI sensibly and meet their Privacy Act obligations.

What we do: AI automation that gives hours back, plain-English Privacy Act and Essential Eight material, and a free external security check of your domain that reads public DNS records only. Nothing is probed or changed.

How we work: nobody is replaced, your IT provider stays in charge, prices are in AUD and shown before you pay. We serve clients across Australia remotely.

Start with the free check at https://titanos.tech/scan or see https://titanos.tech/shop. Contact: kyle@titanos.tech.

## Claims rules for every listing
- No invented stats, reviews, awards, client names or "years in business".
- Say what is true on the site: solo practice, public records only, nobody replaced, prices shown before you pay.
- No tracking-heavy UTM beyond ?utm_source=<platform>.
- Link the free check first (https://titanos.tech/scan); it is the lowest-friction, most honest entry point.

## Image specs (point at existing assets in public/)
| Use | Spec needed | Existing asset | Status |
|---|---|---|---|
| Small logo and favicon | 32 x 32 | public/favicon-32.png (32x32) | Ready |
| Logo, general (GBP min 250x250, Apple 1024 square preferred, LinkedIn 300x300) | Square, at least 512 | public/apple-touch-icon.png is 192x192 (the Organization JSON-LD logo) | TOO SMALL for GBP, Apple and LinkedIn. Gap: export a 1024x1024 square from the gold T mark. Source mark: public/site-redesign/t-mark.png (168x168 RGBA, cropped by tools/make_logo_mark.mjs from the building render). Needs a higher-resolution crop from the original building render; ME can do this on request (new file only). |
| Cover / banner (GBP 1024x575 min; LinkedIn 1128x191; Facebook 820x312) | Wide, safe centre | public/og-image.png (1200x630) works for GBP, Product Hunt gallery and link previews. Crop banners from public/site-redesign/hero-mountain-1199.webp (1199 wide) or building-concept-1672.webp | Ready for 1200x630; banners need crops |
| Founder photo (expert platforms, SourceBottle, PodMatch) | Square, 400+ | public/kyle.jpg (640x640) | Ready, but Kyle approves which listings use his photo (privacy) |
| Product Hunt gallery | 1270 x 760, 2 to 4 images | Screenshots of /scan (take at 1440 wide after the restyle merges) | Pending restyle merge |
Colours: obsidian black and warm gold (see components/home-redesign/home-redesign.css tokens).

## Kyle gates (what only he can do)
Every account creation, login, phone or video verification, and anything posted as Kyle. Nothing here has been submitted. Outbound pitches and sends wait for the L10 gate (VAL8) and a per-batch approval card.
