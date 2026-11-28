# TITANOS — SCREENSHOT-FAITHFUL ART DIRECTION AND IMAGE CONTRACT
## OWNER-PROVIDED STORM MOUNTAIN T / BLACK-GOLD OFFICE TOWER / FULL PAGE VISUAL REFERENCE
### Exact photo mapping, crops, LCP, responsive composition, provenance, visual comparison and safe handling

DATE: 2026-11-28
REPO: kyle4814/titanos-next
BRANCH: design/titanos-proof-economy-obsidian-gold-redesign-2026-11-28
MASTER: docs/ops/site-redesign/TITANOS_PROOF_ECONOMY_MASTER_REDESIGN_NUKE_2026-11-28.md

READ THIS BEFORE touching hero HTML, CSS or imported image derivatives. This art direction is user-source-driven, NOT permission to invent assets.

# A. WHAT OWNER WILL SEND CLAUDE CODE

Treat owner messages/attachments in the actual Claude Code session as the authoritative asset payload. The ChatGPT prior-conversation screenshot/photo links are not assumed local paths. Search the actual Claude attachment folder or ask for exact local file location ONLY if an image is not accessible after owner says it was provided. Do not begin final image integration using guessed or unrelated fallback.
Anticipated sources:
REFERENCE_SCREENSHOT:
- screenshot of a designed TITANOS homepage, approximately vertical 3:4 full-page view;
- dark black/gold presentation including entire homepage, T mountain hero, 4 metrics, 3 receipts, 4 product cards, office/case study, 4-stage operating model, trust strip and full footer.
HERO_MOUNTAIN:
- cinematic black, near-monochrome storm mountains;
- glowing tall angular geometric golden T symbol integrated on right above jagged snowless rock;
- a halo/arc of warm light, atmospheric golden fog and ridgeline; negative space on left for white/gold copy;
- no robots, no neon sci-fi buildings, no cosmic nebula, no typography across whole image unless source already contains branded emblem.
TITANOS_BUILDING:
- wide architecturally-rendered glass/steel office building under slate storm clouds, low angle;
- angle of facade points toward upper right, gold TITANOS signage near roof and gold T insignia;
- warm gold office interiors, silhouetted desks/plants, cinematic high contrast; source render in conversation previously displayed at about 16:9;
- this is a generated concept visual, not evidence of a real TITANOS building/tenant.
Optional LOGO_ASSET:
- authoritative vector/transparent PNG of TITANOS angular T. If absent, reuse site current brand wordmark/sigil; do not produce arbitrary approximation.

In the source receipt record each:
user-supplied original filename, actual path, byte size, width/height, format, SHA256, date received, author-provided right/description, AI-generated/concept flag, any embedded writing/mark, and verified output derivatives. NEVER pretend an unreceived image exists.

Suggested user upload steps to Claude Code: owner sends the full-page screenshot and the two original high-resolution images, not a screenshot crop for the hero. A screenshot crop is lower quality and includes UI overlays; use only if owner genuinely has no original and clearly mark visual limitations.

# B. TARGET PAGE VISUAL MEASUREMENTS FROM USER REFERENCE

The screenshot is a visual target, not a pixel-locked breakpoint.

At a wide desktop viewport:
- top navigation dark strip spanning full width, TITANOS logo roughly first 20% and menu/CTA distributed to right. Header ~64-85 CSS px depending scale.
- hero art begins directly under navigation with mountains rising from center/right, golden T/logo occupying upper-right quadrant, storm atmosphere fading to black on left. Left text margin roughly 4-6% viewport. Hero headline line breaks: THE PROOF / ECONOMY IS LIVE, with white/white/gold word emphasis; strong but not overbearing; left side roughly 42-48% width.
- small eyebrow spaced uppercase at top-left about 12-14px; H1 about clamp 2.5rem–4.5rem (actual calibration from screenshot at target width), white body 14-17px with 55-70ch ideal but visually compact.
- CTA row left: gold rectangular primary button (white/black readable), dark outlined secondary. Horizontal space approx 12-16px. Border radius moderate. On mobile stack or wrap gracefully.
- metrics: four equal cards, aligned below hero within wide max-width container and roughly 14-22px gaps; black/charcoal with subtle top glint, icon square at left, large numeric header, two-line explanation. Must use approved actual figures or qualitative sourced evidence, not screenshot's attractive invented numerical values.
- Proof Layer: left overline/vertical gold rule ~30% width and three compact receipt cards to right. Cards have filename/title and a real button. On tablet and mobile all stack nicely. Vertical breathing space tight but not cramped.
- systems: one headline row with Explore Products, four icon cards in 4 columns desktop and 2/1 on smaller screens, gold hover border and arrow low right. Screenshot has each about 230px wide, with a bold service title and 2-3 line description.
- case study: two-column text left (~36%) and image right (~64%), building facade scaled to fill image crop with visible TITANOS signage; overlay right metric panel if sourced. Gold overline and small gold CTA. On mobile image below case story; preserve signage view.
- process: four sequential cards connected by small arrows; gold line icons, step numbers and concise subcopy. On mobile arrows vertical or omitted with accessible numbering.
- trust strip thin black row, right clusters of small icon/text; only verified, nonmisleading endorsements.
- footer near-black with brand left, multi-column links, small CTA card right; legal strip bottom.

It is NOT essential to reproduce fake browser chrome, fake URL bar, or an entire giant screenshot as a single <img>. Deliver a real website whose internal screenshot at correct viewport resembles the source.

# C. HERO PHOTO: PHOTO-FIRST, NOT CSS GIMMICK-FIRST

CROP TARGET:
Desktop wide <= 1920:
- keep luminous TITANOS T head above ridgeline with some atmospheric air; ridgeline cuts through lower middle, gold glint visible on peaks; black storm cloud behind logo.
- text area negative space on left; if the actual image has mountain on left too, add elegant CSS black scrim/gradient to retain text contrast, not blur whole source.
- use object-fit cover and suitable object-position x around 67-78% after checking actual image; don't blindly use 50% center. Actual values must be tuned from screenshot inspection.
- edges fade naturally to black site surface; hero/metrics boundary doesn't look like a rectangular stock photo dropped onto background.
Tablet:
- source art still dramatic; move T position as needed, ensure no nav/text overlap; cover with scrim.
Mobile 390px:
- consider dedicated art-directed tall crop generated from actual owner image (crop/reframe, not new style-generation) or background with object-position x ~72%, render T above H1 or behind upper-right but without slicing entire sigil off.
- headline must fit and primary CTA appear within reasonable first viewport scroll. Do not reduce headline to tiny size just to force same desktop layout.
- if owner source image has low-resolution glyph, don't fake vector sharpness with CSS effects; report limitation or use provided logo.

IMAGE LOADING:
- use static source under /public/site-redesign, carefully sized WebP/AVIF derivatives at actual required dimensions.
- when using next/image with static export, note images unoptimized; ensure actual variants and srcset/sizes or rendered picture element with high-quality optimized images.
- preload ONLY the appropriate hero LCP source; avoid preloading desktop+mobile simultaneously; use fetchpriority/high where supported on visible main image, not unrelated building image.
- width/height or aspect ratio to prevent layout shift. Avoid base64 giant image inline and no CSS background-image only if it prevents responsive/preload control.
- use a dark CSS gradient fallback when image delayed; no layout jump.
- decorative atmospheric image may have alt="" if H1 communicates content, but when logo itself is substantive/symbol informative give a concise alt or accessible figcaption.
- ensure contrast by actual measurements and screenshot review, not subjective "looks readable."

# D. BUILDING PHOTO: NO FAKE CORPORATE HQ

The office rendering is beautiful and appropriate for aspirational TITANOS brand imagery, but it is an AI-generated architectural concept. There is no evidence in this image that such a physical building belongs to TITANOS. Do NOT write "Inside TITANOS HQ", "our offices", "enterprise headquarters" or invent tenant/client locations.
Recommended accessible editorial placement:
- Featured Work section pairs true case-study content and actual supported case study metric labels on the left with the TITANOS concept render on the right.
- Near image or immediately underneath add a readable disclosure: "TITANOS architectural concept — AI-generated visualization." Do not hide in a hover tooltip or image alt only.
- The image can be a decorative brand analogy for engineered systems, but cannot substantiate claims of office size, enterprise customer trust or a completed customer automation.
- If the screenshot demands a numeric proof panel on top/right, populate only with real CASES/ledger evidence with readable provenance and scope. Use labels RECORD / MODELLED / DEMO rather than anonymous "margin improvement."
- Prefer one truly credible testimonial or actual verified case study over fake ROI badges.

CROP:
Desktop case card landscape width ~65%, aspect 1.8:1 or 16:9, office corner/signage visible high/center-left, windows and golden reflections visible lower half, storm clouds left/top.
Image owner provided may have logo positioned near upper center; avoid crop that cuts TITANOS name. Set focal point based on actual source scan, generate a 16:9 optimized main file and a distinct mobile crop. Use image as image element, not background if caption requires semantics.
Mobile: stack image within card with aspect 4:3 or 3:2 if source supports, not forced 16:9 crop that makes signage unreadable.
Case image should load lazily and decode async since below fold.
Gradient from black right panel may blend; preserve transparency and not add unreadable text over window grid.

# E. VISUAL TOKENS / TYPOGRAPHY / ICONS

Black: #070809 approximate; graphite cards #111316; subtle borders rgba(255,255,255,.11); rare gold specular #FFE19D; primary warm gold #D4AF37; dark gold #89672B; white #F5F6F7; text muted #B2B4B8. These are art-direction candidates; align with existing site --gold, --gold-warm, --gold-spec, --vault-black to avoid global inconsistencies. Homepage CSS scope tokens only if necessary.
Text:
- screenshot H1 uses bold modern sans, visually compressed/clean, tracking ~-0.03em, line-height ~.95–1.03, large maximum 62–74px at 1440.
- eyebrow all caps tracking .2em; small gold/grey.
- section titles strong modern grotesk 27–35px at desktop; copy readable 15–17px.
- optional existing Fraunces/Geist font system may adapt by using Geist for homepage dramatic headline while preserving existing global type elsewhere; don't force Cinzel if brand bible rejected generic luxury usage.
- avoid microscopic paragraph labels, impossible contrast or many all-caps text blocks.
- numbers should use tabular-nums; SOURCE/proof labels readable.

Icons:
Use existing lucide-react package or inline original vector icons only; stroke thin gold 1.7–2.0, 18–22px. Cards: code bracket, layers/check, bolt, upward arrow; assets dossier icon paper; model step layers/brain/check/rocket. Icon itself never fake verified state.

Cards:
Light surface sheen along top edge and subtle backdrop reflect, not thick neon gold border on all. One accent border on selected/hover featured card; hover move 2px, respects reduced motion. Gold gradient CTA with black high contrast and gentle inner shadow. Shadow black/charcoal, no heavy large blur.

# F. VISUAL COMPARISON CHECKLIST — OWNER'S OWN DESIGN IS THE BENCHMARK

Capture actual app screenshots (same widths if possible) and compare side-by-side with owner reference; use owner image as design reference only.
Checklist:
- top nav: logo position, labels, CTA size, header height,
- hero: exact T mountain visual, correct right-weighted composition, line breaks and gold LIVE,
- CTA shape and left margin,
- metrics count, density and black-glass treatment,
- Proof Layer left vertical gold accent and three dossier cards,
- systems 4-card grid and icons,
- case office building image actual owner file and crop, concept disclosure readable,
- process 4 steps, arrows and footer,
- black/gold palette, subtle contrast, no cyan/nebula takeover,
- mobile art-directed focal point and no overlap/clipping,
- page not flattened.
Mark each as MATCH / MINOR_DIFFERENCE / MATERIAL_DIFFERENCE / NOT_IMPLEMENTED. Every material difference must be listed with a reason and screenshot. Don't self-certify 99% pixel fidelity based on feeling.

Use true web browser screenshot testing, not generated images of a future website. Playwright screenshot: 1440x900, 1920x1080, 1024x768, 768x1024, 390x844, optionally 320x700. For full page capture scroll states and asset load. Check computed CSS and alt/captions, no visual overlay errors.
Reasonable pixel-diff tooling may reveal layout drift but don't treat pixel-perfect comparison as sole measure; actual source screenshot includes fake browser chrome and possibly non-implemented texts/numbers. Prioritise art direction and UX with truthful content.

# G. FILE MANIFEST / HANDOFF

Source names under incoming folder are not predetermined. Suggested destination:
public/site-redesign/hero-mountain-desktop.webp
public/site-redesign/hero-mountain-mobile.webp
public/site-redesign/titanos-building-concept.webp
public/site-redesign/titanos-building-concept-mobile.webp
public/site-redesign/titanos-site-og.webp (only if actually created)
docs/ops/site-redesign/ASSET_SOURCE_MANIFEST.json (source basename, SHA256, owner source, AI concept flag, output hashes and dimensions).
Do not commit giant unoptimized source if not necessary; source archive in owner local intake can be private; production only derivatives (with content rights).
Do not expose original upload absolute paths or EXIF personal location in public metadata. Scrub nonessential EXIF/GPS.
If owner provides only screenshot and building photo but no separate mountain artwork, DO NOT fabricate that it arrived; screenshot may be used to target composition and owner can provide isolated mountain source. If no high-res art exists, create an honest fallback that mimics shape/colour as best possible and clearly request owner art before final approval. Do NOT produce a different futuristic stock scene.
Asset legal/source notes are part of QA. If image is generated for owner, permission to display is presumed within user's provided files, but representation must not mislead visitors.

# END ART DIRECTION

The two original images are the visual anchors and the screenshot is layout authority. Everything else should serve them and preserve TITANOS's evidence-first voice. Strong emotion from art, calm precision from text. No fake numbers, fake office, or irrelevant sci-fi aesthetic.
