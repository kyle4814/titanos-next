# SECURITY HEADERS — titanos.tech
**Created:** 2026-06-05 · **Updated:** 2026-06-06
**Status:** SEC-01 mostly shipped; residual = Permissions-Policy + ACAO HTML strip.

---

## Enforcement Matrix (current state)

| Header | Layer | Status |
|---|---|---|
| Content-Security-Policy | `app/layout.tsx` `<meta http-equiv>` | ✅ shipped via repo |
| Referrer-Policy | CF Managed + `<meta name="referrer">` belt-and-braces | ✅ shipped (CF Managed serves `same-origin` — stricter than audit `strict-origin-when-cross-origin`, so kept) |
| X-Frame-Options | CF Managed "Add security headers" | ✅ shipped (`SAMEORIGIN`; audit asked `DENY` but SAMEORIGIN is fine for a brochure site) |
| Strict-Transport-Security | CF (already live) | ✅ `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | CF Managed (now) + already-live nosniff | ✅ shipped |
| Permissions-Policy | **RESIDUAL** — meta tag is ignored by browsers per W3C spec; the only way to ship this on static GH Pages is a CF Transform Rule | ⏳ See "SEC-RESIDUAL-1" below |
| Access-Control-Allow-Origin | CF (still emits `*` on HTML) | ⏳ See "SEC-RESIDUAL-2" below — SEC-02 from audit |

Repo strategy locked: CSP + Referrer-Policy in `app/layout.tsx`. Everything else in CF (managed or transform rules). `next.config.ts` is documented to NOT carry `headers()` because static export ignores it.

---

## SEC-RESIDUAL-1 — Permissions-Policy

### Why this can't live in the repo
The CSP-style meta tag (`<meta http-equiv="Permissions-Policy" content="...">`) is explicitly ignored by browsers. W3C spec says Permissions-Policy is HTTP-header-only. Static GH Pages can't serve custom HTTP headers from a repo file (no `_headers` support). Only CF can set this header.

### Recommendation
Add ONE Cloudflare Transform Rule with this single header:

```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```

Policy is a "feature freezer" — it denies access to APIs the site never uses (camera, mic, payment-request, geolocation). Zero functional impact; adds a SecurityHeaders.com point.

### Dashboard path
```
Cloudflare Dashboard
  → titanos.tech zone
  → Rules
  → Transform Rules
  → Modify Response Header
  → Create rule

Rule name: "SEC-RESIDUAL-1 Permissions-Policy"
When: (all requests)   [Expression: true]

Then:
  Set → Permissions-Policy → "geolocation=(), microphone=(), camera=(), payment=()"

Save and deploy.
```

### Equivalent curl (once CF token has `Transform-Rules:Edit` scope)
```bash
CLOUDFLARE_API_TOKEN="<your-token>"
CLOUDFLARE_ZONE_ID="1b03a17da4a15bea41d56e9730a4ca50"

curl -s -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/http_response_headers_transform/entrypoint" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [{
      "description": "SEC-RESIDUAL-1 Permissions-Policy",
      "expression": "true",
      "action": "rewrite",
      "action_parameters": {
        "headers": {
          "Permissions-Policy": {
            "operation": "set",
            "value": "geolocation=(), microphone=(), camera=(), payment=()"
          }
        }
      }
    }]
  }'
```

---

## SEC-RESIDUAL-2 — ACAO `*` on HTML responses (SEC-02 from audit)

### Why it matters
HTML responses do not need CORS at all (no cross-origin XHR can read them). Wildcard `Access-Control-Allow-Origin: *` on HTML signals carelessness for a vendor pitching Privacy Act + Essential Eight compliance.

### Recommendation
One CF Transform Rule that REMOVES `Access-Control-Allow-Origin` on HTML responses while keeping it on `/_next/static/*` (font CORS).

### Dashboard path
```
Cloudflare Dashboard
  → titanos.tech zone
  → Rules
  → Transform Rules
  → Modify Response Header
  → Create rule

Rule name: "SEC-RESIDUAL-2 Strip ACAO on HTML"
When: (http.response.content_type.media_type eq "text/html")

Then:
  Remove → Access-Control-Allow-Origin

Save and deploy.
```

---

## SEC-07 — Disable Cloudflare Email Obfuscation

Funnel is mailto-based — Kyle WANTS `kyle@titanos.tech` indexed. Currently CF rewrites it into `/cdn-cgi/l/email-protection#...` payloads, which hurts inbound discoverability.

### Steps (one click)
```
Cloudflare Dashboard
  → titanos.tech zone
  → Scrape Shield
  → Email Address Obfuscation
  → Toggle OFF

Save.
```

No API change needed.

---

## What WAS staged here previously (SEC-01 full CF rule)

This file used to recommend the full SEC-01 stack as a single CF Transform Rule. With Kyle's 2026-06-06 decision to keep custom security headers in the repo:

- CSP moved to `app/layout.tsx` `<meta http-equiv>` ✅
- Referrer-Policy moved to `app/layout.tsx` `<meta name="referrer">` (belt-and-braces on top of CF Managed) ✅
- X-Frame-Options stays with CF Managed (no meta equivalent) ✅
- Permissions-Policy is the residual (no meta equivalent) — see SEC-RESIDUAL-1 above ⏳

The historical full-stack CF rule snippet has been removed to avoid future maintainers applying it on top of the meta-tag CSP and creating a header conflict.
