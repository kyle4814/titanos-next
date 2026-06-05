# STAGED CLOUDFLARE RULES — titanos.tech
**Created:** 2026-06-05
**Wave 1 Agent A output.** Kyle must apply these manually after granting the CF API token `Transform-Rules-Edit` scope (or via the dashboard).

---

## PREREQUISITE: Token Scope Gap

The CF API token at `CLOUDFLARE_API_TOKEN` currently lacks **Transform-Rules-Edit** scope.
The `/rulesets/phases/http_response_headers_transform/entrypoint` endpoint returns an auth error.

**To grant the scope:**
1. Cloudflare Dashboard → Profile → API Tokens → Edit the existing token
2. Add permission: `Zone` → `Transform Rules` → `Edit`
3. Save → copy updated token → update `clawd/.env`

---

## SEC-01 — Add Missing Security Response Headers

### Finding
`Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`, and `X-Frame-Options` are absent on all titanos.tech responses. SecurityHeaders.com grade is currently D/F. For a vendor selling Privacy Act + Essential Eight compliance, this is the single most credibility-damaging finding.

### Policy Strings (verbatim from audit SEC-01 recommendation)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' /cdn-cgi/scripts/; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' mailto:
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
```

**Note on CSP:** The `'unsafe-inline'` allowances are required because Next.js static export injects inline `<style>` and `<script>` blocks. If you add a `nonce`-based CSP in future, remove `'unsafe-inline'`. The `/cdn-cgi/scripts/` allowance covers Cloudflare's own injected scripts (Bot Management etc.).

### Dashboard Path

```
Cloudflare Dashboard
  → titanos.tech zone
  → Rules
  → Transform Rules
  → Modify Response Header
  → Create rule

Rule name: "SEC-01 Security Headers"
When: (http.response.code ne 0)   [i.e. always — match all responses]
  OR use: Expression: true

Then:
  Set → Content-Security-Policy → "default-src 'self'; script-src 'self' 'unsafe-inline' /cdn-cgi/scripts/; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' mailto:"
  Set → Permissions-Policy → "geolocation=(), microphone=(), camera=(), payment=()"
  Set → Referrer-Policy → "strict-origin-when-cross-origin"
  Set → X-Frame-Options → "DENY"

Save and deploy.
```

### Equivalent API curl (paste after granting Transform-Rules-Edit scope)

```bash
CLOUDFLARE_API_TOKEN="<your-token-with-transform-rules-edit>"
CLOUDFLARE_ZONE_ID="1b03a17da4a15bea41d56e9730a4ca50"

curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/http_response_headers_transform/entrypoint" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "description": "SEC-01 Security Headers",
        "expression": "true",
        "action": "rewrite",
        "action_parameters": {
          "headers": {
            "Content-Security-Policy": {
              "operation": "set",
              "value": "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\'' /cdn-cgi/scripts/; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data:; font-src '\''self'\''; connect-src '\''self'\''; frame-ancestors '\''none'\''; base-uri '\''self'\''; form-action '\''self'\'' mailto:"
            },
            "Permissions-Policy": {
              "operation": "set",
              "value": "geolocation=(), microphone=(), camera=(), payment=()"
            },
            "Referrer-Policy": {
              "operation": "set",
              "value": "strict-origin-when-cross-origin"
            },
            "X-Frame-Options": {
              "operation": "set",
              "value": "DENY"
            }
          }
        }
      }
    ]
  }'
```

**Unescaped CSP string for copy-paste (dashboard text field):**
```
default-src 'self'; script-src 'self' 'unsafe-inline' /cdn-cgi/scripts/; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' mailto:
```

---

## SEC-02 — Remove `Access-Control-Allow-Origin: *` from HTML Responses

### Finding
`access-control-allow-origin: *` is returned on HTML page responses. HTML documents don't need CORS — no cross-origin XHR can read them. Wildcard CORS on your homepage signals carelessness for a security vendor.

### Rule Description
Match responses where `Content-Type` contains `text/html` → **Remove** the `Access-Control-Allow-Origin` header.

Static `/_next/static/*` assets (fonts, chunks) may legitimately need CORS — keep the wildcard on those only (or remove entirely if no cross-origin font/asset consumers exist).

### Dashboard Path

```
Cloudflare Dashboard
  → titanos.tech zone
  → Rules
  → Transform Rules
  → Modify Response Header
  → Create rule (or add to the SEC-01 rule above as an additional action)

Rule name: "SEC-02 Remove ACAO from HTML"
When (Firewall Expression):
  http.response.headers["content-type"] contains "text/html"

Then:
  Remove → Access-Control-Allow-Origin
```

### Equivalent API curl (append to the SEC-01 ruleset PUT, or create a second rule)

Add this object to the `rules` array in the SEC-01 PUT payload above:

```json
{
  "description": "SEC-02 Remove ACAO from HTML responses",
  "expression": "http.response.headers[\"content-type\"] contains \"text/html\"",
  "action": "rewrite",
  "action_parameters": {
    "headers": {
      "Access-Control-Allow-Origin": {
        "operation": "remove"
      }
    }
  }
}
```

---

## SEC-07 — Disable Email Obfuscation

### Finding
Cloudflare Email Obfuscation was inconsistently rewriting `kyle@titanos.tech` on some pages but not others. Since the funnel is mailto-based, you WANT the address indexed by search engines and clients.

### Status: APPLIED ✅

The API call succeeded at 2026-06-05T07:58:21Z:

```bash
curl -s -X PATCH \
  "https://api.cloudflare.com/client/v4/zones/1b03a17da4a15bea41d56e9730a4ca50/settings/email_obfuscation" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value":"off"}'
# Response: {"result":{"id":"email_obfuscation","value":"off",...},"success":true}
```

Email Obfuscation is now OFF. The `email-decode.min.js` script injection will stop and `kyle@titanos.tech` will be returned plaintext in all HTML responses.

If you want to verify via dashboard:
```
Cloudflare Dashboard
  → titanos.tech zone
  → Scrape Shield
  → Email Address Obfuscation → Off
```

---

## SEC-03 — HSTS (Already Correct, Action Required)

### Status: VERIFIED CORRECT ✅
HSTS header is present and correct:
```
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

### Kyle Action Required
Submit titanos.tech to the HSTS preload list so browsers hardcode HTTPS before any first request:

**URL:** https://hstspreload.org

Preloading requires the above header to be present (it is), and that you confirm all subdomains also serve HTTPS. After submitting, it takes 1-3 months to propagate into Chrome/Firefox/Edge updates.

---

## Verification Checklist (after applying SEC-01 + SEC-02)

```bash
# Check all four security headers are present:
curl -sI https://titanos.tech | grep -i -E "content-security-policy|permissions-policy|referrer-policy|x-frame-options"

# Verify ACAO is absent from HTML responses:
curl -sI https://titanos.tech | grep -i "access-control-allow-origin"
# Expected: no output (header removed)

# Check SecurityHeaders.com grade target: A or B
# URL: https://securityheaders.com/?q=titanos.tech&followRedirects=on
```
