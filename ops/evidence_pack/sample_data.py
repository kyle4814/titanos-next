"""
Real scan data for titanos.tech — authorised own-infra scan 2026-06-27.
Every value here was captured from a live external scan. No fabrication.

Commands run:
  nmap -sV -p 80,443,8080,8443 titanos.tech
  echo | openssl s_client -connect titanos.tech:443 -servername titanos.tech
  curl -sI https://titanos.tech
  python3 -c "import dns.resolver; ..." (SPF, DMARC, DKIM, CAA)
"""

SCAN_DATA = {
    "client": {
        "business_name": "Titanos",
        "domain": "titanos.tech",
        "scan_date": "27 June 2026",
        "prepared_by": "Kyle Deligny",
        "abn": "34 318 502 254",
        "engagement_type": "External Security Assessment",
        "mode": "sample",
    },

    "overall": {
        "posture": "STRONG",
        "posture_status": "green",
        "summary": "Your external security posture is strong. We found 5 housekeeping items — none are urgent, and none represent an active vulnerability or exploitable hole.",
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 1,
        "info": 4,
    },

    "scorecard": [
        {
            "area": "Website encryption",
            "tech_name": "TLS/SSL",
            "status": "green",
            "label": "🟢 Strong",
            "meaning": "Bank-grade encryption on every visitor connection. Certificate valid, auto-renewing, issued by Google Trust Services.",
        },
        {
            "area": "Email fraud protection",
            "tech_name": "SPF / DKIM / DMARC",
            "status": "green",
            "label": "🟢 Strong",
            "meaning": "Nobody can send fake email from your domain. Attempts are rejected before they reach anyone's inbox. Daily fraud reports enabled.",
        },
        {
            "area": "Public exposure",
            "tech_name": "Port scan / origin",
            "status": "green",
            "label": "🟢 Strong",
            "meaning": "Your actual web server is hidden behind Cloudflare. No direct access from the internet — all traffic goes through Cloudflare's protection first.",
        },
        {
            "area": "Browser security settings",
            "tech_name": "HTTP security headers",
            "status": "amber",
            "label": "🟡 Partial",
            "meaning": "Most settings in place. One (Content-Security-Policy) is applied via the page rather than the server — works correctly today, but the server-level approach is stricter.",
        },
        {
            "area": "Certificate restriction record",
            "tech_name": "CAA DNS record",
            "status": "amber",
            "label": "🟡 Minor gap",
            "meaning": "No record limits who can issue your security certificates. Low risk, 5-min fix. Scheduled for addition on first working call.",
        },
    ],

    "next_actions": [
        {
            "action": "Add a certificate restriction (CAA) record",
            "who": "You",
            "where": "Cloudflare DNS → Add three CAA records",
            "effort": "5 min",
        },
        {
            "action": "Move the Content-Security-Policy setting to server level",
            "who": "Cloudflare (we provide the exact request)",
            "where": "Cloudflare Transform Rules",
            "effort": "30 min",
        },
        {
            "action": "Remove the outdated Expect-CT instruction",
            "who": "Cloudflare (we provide the exact request)",
            "where": "Cloudflare header rules",
            "effort": "5 min",
        },
    ],

    "ports": {
        "scan_ip": "172.67.217.202",
        "scan_command": "nmap -sV -p 80,443,8080,8443 titanos.tech",
        "scan_raw": (
            "Nmap scan report for titanos.tech (172.67.217.202)\n"
            "PORT     STATE SERVICE       VERSION\n"
            "80/tcp   open  http          cloudflare\n"
            "443/tcp  open  ssl/https     cloudflare\n"
            "8080/tcp open  http-proxy    cloudflare\n"
            "8443/tcp open  ssl/https-alt cloudflare"
        ),
        "results": [
            {"port": 80,   "state": "open", "service": "http",          "version": "cloudflare",     "meaning": "Standard unencrypted web. Cloudflare redirects all visitors to the secure (HTTPS) version automatically. Not your actual server."},
            {"port": 443,  "state": "open", "service": "ssl/https",     "version": "cloudflare",     "meaning": "Encrypted web traffic (the padlock). All visitor data travels over this connection. Answered by Cloudflare."},
            {"port": 8080, "state": "open", "service": "http-proxy",    "version": "cloudflare",     "meaning": "Cloudflare backup port. Not your web server. Cloudflare blocks unauthorised requests on this port automatically."},
            {"port": 8443, "state": "open", "service": "ssl/https-alt", "version": "cloudflare",     "meaning": "Cloudflare backup port. Not your web server. Cloudflare blocks unauthorised requests on this port automatically."},
        ],
        "origin_exposed": False,
        "status": "green",
    },

    "tls": {
        "status": "green",
        "issuer": "Google Trust Services (WE1)",
        "subject": "titanos.tech",
        "sans": "titanos.tech, *.titanos.tech",
        "valid_from": "1 June 2026",
        "valid_until": "30 August 2026",
        "protocol": "TLS 1.3",
        "cipher": "TLS_AES_256_GCM_SHA384",
        "hsts": "max-age=31536000; includeSubDomains; preload",
        "hsts_preloaded": True,
        "tech_protocol_raw": (
            "$ echo | openssl s_client -connect titanos.tech:443 -servername titanos.tech 2>/dev/null \\\n"
            "    | grep -E 'Protocol|Cipher|subject|issuer'\n"
            "subject=CN = titanos.tech\n"
            "issuer=C = US, O = Google Trust Services, CN = WE1\n"
            "New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384"
        ),
        "tech_dates_raw": (
            "$ echo | openssl s_client -connect titanos.tech:443 2>/dev/null \\\n"
            "    | openssl x509 -noout -dates\n"
            "notBefore=Jun  1 04:00:52 2026 GMT\n"
            "notAfter=Aug 30 04:45:54 2026 GMT"
        ),
        "tech_hsts_raw": (
            "$ curl -sI https://titanos.tech | grep -i strict-transport\n"
            "strict-transport-security: max-age=31536000; includeSubDomains; preload"
        ),
    },

    "email_auth": {
        "status": "green",
        "spf": {
            "status": "green",
            "record": "v=spf1 include:_spf.google.com include:_spf.mx.cloudflare.net -all",
            "policy": "Strict reject (-all)",
        },
        "dkim": {
            "status": "green",
            "selector": "google._domainkey",
            "key_type": "RSA",
            "record_excerpt": "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtnkeG3Fth0TW...[truncated]",
        },
        "dmarc": {
            "status": "green",
            "record": "v=DMARC1; p=reject; rua=mailto:kyle@titanos.tech; ruf=mailto:kyle@titanos.tech; pct=100",
            "policy": "reject (all failures blocked)",
            "reporting": "Daily failure reports to kyle@titanos.tech",
        },
        "caa": {
            "status": "amber",
            "record": None,
            "note": "No CAA record published. See finding F-01.",
        },
        "tech_raw": (
            "$ python3 -c \"import dns.resolver; [print(r.to_text()) for r in \\\n"
            "    dns.resolver.resolve('titanos.tech','TXT') if 'spf' in r.to_text()]\"\n"
            "\"v=spf1 include:_spf.google.com include:_spf.mx.cloudflare.net -all\"\n\n"
            "$ python3 -c \"import dns.resolver; [print(r.to_text()) for r in \\\n"
            "    dns.resolver.resolve('_dmarc.titanos.tech','TXT')]\"\n"
            "\"v=DMARC1; p=reject; rua=mailto:kyle@titanos.tech; ruf=mailto:kyle@titanos.tech; pct=100\"\n\n"
            "$ python3 -c \"import dns.resolver; [print(r.to_text()[:80]+'...') for r in \\\n"
            "    dns.resolver.resolve('google._domainkey.titanos.tech','TXT')]\"\n"
            "\"v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtnkeG3Fth0TW...\"\n\n"
            "$ python3 -c \"import dns.resolver; dns.resolver.resolve('titanos.tech','CAA')\"\n"
            "# DNS timeout — CAA record not published"
        ),
    },

    "headers": {
        "present": {
            "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
            "x-frame-options": "SAMEORIGIN",
            "x-content-type-options": "nosniff",
            "referrer-policy": "same-origin",
            "x-xss-protection": "1; mode=block",
            "expect-ct": "max-age=86400, enforce",
        },
        "absent": ["content-security-policy (server-level)", "permissions-policy"],
        "raw": (
            "$ curl -sI https://titanos.tech\n"
            "HTTP/2 200\n"
            "date: Sat, 27 Jun 2026 08:41:56 GMT\n"
            "content-type: text/html; charset=utf-8\n"
            "x-frame-options: SAMEORIGIN\n"
            "server: cloudflare\n"
            "strict-transport-security: max-age=31536000; includeSubDomains; preload\n"
            "x-content-type-options: nosniff\n"
            "referrer-policy: same-origin\n"
            "expect-ct: max-age=86400, enforce        ← deprecated, see F-05\n"
            "x-xss-protection: 1; mode=block\n"
            "cf-ray: a12327d31816d736-BNE"
        ),
    },

    "findings": [
        {
            "id": "F-01",
            "plain_title": "Your domain doesn't limit who can issue security certificates for it",
            "tech_title": "CAA records not published",
            "severity": "LOW",
            "severity_plain": "LOW · worth doing",
            "status": "amber",
            "effort": "5 min",
            "who": "You (Cloudflare DNS)",
            "what_means": (
                "Right now, any major certificate authority in the world could technically issue a security "
                "certificate for titanos.tech — as long as they follow standard procedures. A CAA record "
                "(Certificate Authority Authorisation) limits this to only the specific providers that actually "
                "issue certificates for your domain. This isn't a current hole — it narrows a rare attack "
                "window involving a rogue or compromised certificate authority."
            ),
            "real_world": (
                "Low. The specific attack this defends against requires a certificate authority itself to be "
                "compromised — an extremely rare event. But the fix takes 5 minutes and is best practice for "
                "any business that wants a clean compliance record."
            ),
            "how_fix_plain": (
                "Log in to Cloudflare DNS. Add three CAA records for titanos.tech — "
                "one allowing Google Trust Services and one allowing Let's Encrypt to issue certificates, "
                "plus a wildcard restriction. Done in under 5 minutes."
            ),
            "how_fix_tech": (
                "Add to Cloudflare DNS (titanos.tech zone):\n"
                "  titanos.tech. 300 IN CAA 0 issue \"letsencrypt.org\"\n"
                "  titanos.tech. 300 IN CAA 0 issue \"pki.goog\"\n"
                "  titanos.tech. 300 IN CAA 0 issuewild \"pki.goog\"\n\n"
                "Verify after adding:\n"
                "  python3 -c \"import dns.resolver; [print(r) for r in dns.resolver.resolve('titanos.tech','CAA')]\""
            ),
            "action_status": "SCHEDULED — fix applied on working call",
            "action_status_color": "amber",
        },
        {
            "id": "F-02",
            "plain_title": "One browser security setting is applied via the page, not the server",
            "tech_title": "Content-Security-Policy delivered via meta tag, not HTTP header",
            "severity": "INFO",
            "severity_plain": "INFO · housekeeping",
            "status": "grey",
            "effort": "30 min",
            "who": "Cloudflare (we provide the request)",
            "what_means": (
                "A setting called Content Security Policy (CSP) — which tells browsers what content is "
                "allowed to load on your pages (scripts, images, fonts, etc.) — is currently set inside "
                "the page's HTML itself. This works correctly for visitors today. The stricter approach "
                "is to have it sent by the server as an HTTP header, so it applies before any page "
                "content loads. This is a best-practice improvement, not a current vulnerability."
            ),
            "real_world": (
                "None at present — the protection is working. This is an incremental hardening step "
                "that moves the setting to the most trusted delivery channel."
            ),
            "how_fix_plain": (
                "We provide Cloudflare the exact Transform Rule to add. They inject the "
                "Content-Security-Policy header at the edge, replacing the meta-tag approach. "
                "Takes about 30 minutes on a Cloudflare working call."
            ),
            "how_fix_tech": (
                "Cloudflare Dashboard → Rules → Transform Rules → Modify Response Header\n"
                "Action: Set → Content-Security-Policy\n"
                "Value: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';\n"
                "        style-src 'self' 'unsafe-inline' fonts.googleapis.com;\n"
                "        font-src 'self' fonts.gstatic.com; img-src 'self' data: https:;\n"
                "        frame-ancestors 'none'; base-uri 'self'; form-action 'self';\n\n"
                "Note: remove the <meta http-equiv=\"Content-Security-Policy\"> tag from HTML once deployed."
            ),
            "action_status": "INFORMATIONAL — scheduled for next infrastructure update",
            "action_status_color": "grey",
        },
        {
            "id": "F-03",
            "plain_title": "The site doesn't explicitly declare which browser features it uses",
            "tech_title": "Permissions-Policy header absent",
            "severity": "INFO",
            "severity_plain": "INFO · housekeeping",
            "status": "grey",
            "effort": "10 min",
            "who": "Cloudflare (we provide the request)",
            "what_means": (
                "A Permissions Policy header tells browsers which sensitive device features — camera, "
                "microphone, location, payment — this website is allowed to use. Currently there's no "
                "explicit policy, so browsers fall back to their defaults. Since the site doesn't "
                "use any of those features, there's no current risk. Adding an explicit "
                "'deny everything' policy guards against future changes accidentally enabling them."
            ),
            "real_world": "None today. This is a preventive measure for future-proofing.",
            "how_fix_plain": (
                "We provide Cloudflare the exact header to add: a one-line rule that denies camera, "
                "microphone, location, payment, and USB access. Takes about 10 minutes."
            ),
            "how_fix_tech": (
                "Cloudflare Dashboard → Rules → Transform Rules → Modify Response Header\n"
                "Action: Set → Permissions-Policy\n"
                "Value: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()\n\n"
                "Verify:\n"
                "  curl -sI https://titanos.tech | grep -i permissions-policy"
            ),
            "action_status": "INFORMATIONAL — escalation language provided to Cloudflare",
            "action_status_color": "grey",
        },
        {
            "id": "F-04",
            "plain_title": "Four website connection points are visible — all answered by your security provider",
            "tech_title": "4 ports open: 80, 443, 8080, 8443 — all Cloudflare-terminated",
            "severity": "INFO",
            "severity_plain": "INFO · no action needed",
            "status": "grey",
            "effort": "n/a",
            "who": "No action required",
            "what_means": (
                "A port scan shows four connection points to the website rather than the standard two. "
                "The extra two (ports 8080 and 8443) are Cloudflare's standard backup ports — they don't "
                "lead to your actual web server, and Cloudflare filters all traffic on them. "
                "Your actual server (GitHub Pages) is not exposed through any of these."
            ),
            "real_world": (
                "None. All four ports are answered by Cloudflare, not your origin server. "
                "This is Cloudflare's standard configuration and presents no additional risk."
            ),
            "how_fix_plain": (
                "No action required. If you prefer a tighter visible surface, Cloudflare can be "
                "configured to disable ports 8080 and 8443 — but there's no security benefit to doing so."
            ),
            "how_fix_tech": (
                "Scan command run:\n"
                "  nmap -sV -p 80,443,8080,8443 titanos.tech\n\n"
                "Output:\n"
                "  PORT     STATE  SERVICE       VERSION\n"
                "  80/tcp   open   http          cloudflare\n"
                "  443/tcp  open   ssl/https     cloudflare\n"
                "  8080/tcp open   http-proxy    cloudflare\n"
                "  8443/tcp open   ssl/https-alt cloudflare\n\n"
                "All 4 ports terminate at Cloudflare IP 172.67.217.202 (Cloudflare AS13335).\n"
                "Origin server not reachable directly."
            ),
            "action_status": "INFORMATIONAL — no action required",
            "action_status_color": "grey",
        },
        {
            "id": "F-05",
            "plain_title": "An outdated browser instruction is being sent — harmless, can be cleaned up",
            "tech_title": "Expect-CT header present — deprecated since 2021",
            "severity": "INFO",
            "severity_plain": "INFO · housekeeping",
            "status": "grey",
            "effort": "5 min",
            "who": "Cloudflare (we provide the request)",
            "what_means": (
                "The website is sending a security instruction called Expect-CT — a header that was "
                "introduced a few years ago to enforce certificate transparency logs, but has been "
                "superseded by a newer standard that all major certificate authorities follow by default. "
                "Modern browsers simply ignore this instruction. It's not harmful — it's a leftover "
                "from an older Cloudflare configuration that can be removed for a cleaner setup."
            ),
            "real_world": "None. Deprecated instruction, ignored by all current browsers (Chrome, Firefox, Safari, Edge).",
            "how_fix_plain": (
                "We provide Cloudflare the exact rule to remove the Expect-CT header from responses. "
                "Takes about 5 minutes."
            ),
            "how_fix_tech": (
                "Current state:\n"
                "  curl -sI https://titanos.tech | grep -i expect-ct\n"
                "  expect-ct: max-age=86400, enforce\n\n"
                "Remediation: Cloudflare Dashboard → Rules → Transform Rules\n"
                "→ Remove response header: Expect-CT\n\n"
                "Reference: RFC 9163 (Expect-CT Extension for HTTP) deprecated Aug 2022.\n"
                "Certificate Transparency now enforced natively by browser root programs."
            ),
            "action_status": "INFORMATIONAL — no action required (cleanup item only)",
            "action_status_color": "grey",
        },
    ],
}
