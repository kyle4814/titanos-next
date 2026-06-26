#!/usr/bin/env python3
"""
Generate sample-evidence-pack-excerpt.pdf
Plain-English rewrite — readable by any SMB owner, no technical background needed.
Run: python3 ops/gen_sample_pdf.py
Output: public/sample-evidence-pack-excerpt.pdf
"""

import os
import sys

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', Georgia, sans-serif;
    font-size: 10.5pt;
    line-height: 1.65;
    color: #1a1a1a;
    background: #fff;
  }

  /* ── Page layout ── */
  @page {
    size: A4;
    margin: 18mm 16mm 18mm 16mm;
    @bottom-center {
      content: "Titanos · ABN 34 318 502 254 · titanos.tech/our-evidence-pack · page " counter(page) " of " counter(pages);
      font-size: 8pt;
      color: #888;
      font-family: 'Inter', sans-serif;
    }
    @top-right {
      content: "SAMPLE — REDACTED";
      font-size: 8pt;
      color: #aaa;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.08em;
    }
  }

  /* ── Cover page ── */
  .cover {
    padding: 30mm 10mm 20mm;
    page-break-after: always;
    min-height: 220mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .cover-badges {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
  }
  .badge {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.10em;
    padding: 4px 10px;
    border: 1.5px solid #c8a84b;
    border-radius: 3px;
    color: #c8a84b;
    text-transform: uppercase;
  }
  .cover h1 {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 26pt;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1.25;
    margin-bottom: 10px;
  }
  .cover-sub {
    font-size: 12pt;
    color: #444;
    margin-bottom: 28px;
    line-height: 1.5;
  }
  .cover-meta {
    border-left: 3px solid #c8a84b;
    padding: 12px 16px;
    background: #fffbf0;
    font-size: 9.5pt;
    color: #555;
    line-height: 1.8;
    margin-bottom: 28px;
  }
  .cover-meta strong { color: #1a1a1a; }
  .cover-callout {
    background: #f7f7f7;
    border-radius: 6px;
    padding: 16px 18px;
    font-size: 9.5pt;
    color: #444;
    line-height: 1.7;
  }
  .cover-callout strong { color: #1a1a1a; }
  .cover-footer {
    font-size: 8.5pt;
    color: #888;
    margin-top: 20px;
    border-top: 1px solid #eee;
    padding-top: 12px;
  }

  /* ── Section headings ── */
  .section-heading {
    font-family: 'Merriweather', Georgia, serif;
    font-size: 14pt;
    font-weight: 700;
    color: #b8922a;
    margin: 0 0 6px;
    padding-bottom: 6px;
    border-bottom: 1.5px solid #e8d8a0;
  }
  .section-lead {
    color: #555;
    font-size: 9.5pt;
    margin-bottom: 14px;
    line-height: 1.6;
  }
  .section-block {
    margin-bottom: 28px;
  }

  /* ── Score table (summary) ── */
  .score-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 9.5pt;
  }
  .score-table thead tr {
    background: #2a2a2a;
    color: #fff;
  }
  .score-table thead th {
    padding: 9px 12px;
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.04em;
    font-size: 8.5pt;
  }
  .score-table tbody tr:nth-child(even) { background: #fafafa; }
  .score-table tbody tr:nth-child(odd) { background: #fff; }
  .score-table td {
    padding: 9px 12px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  .score-table td:first-child { font-weight: 500; color: #222; }
  .score-table td:last-child { color: #444; font-size: 9pt; }
  .pill {
    display: inline-block;
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 3px 9px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .pill-green { background: #e6f4ea; color: #1e7e34; }
  .pill-amber { background: #fff3cd; color: #856404; }
  .pill-red   { background: #fde8e8; color: #c0392b; }
  .pill-grey  { background: #f0f0f0; color: #555; }

  /* ── Plain prose blocks ── */
  p { margin-bottom: 10px; }
  ul { margin: 8px 0 10px 18px; }
  li { margin-bottom: 5px; line-height: 1.6; color: #333; }
  li strong { color: #1a1a1a; }

  /* ── Callout box ── */
  .callout {
    border-left: 3px solid #c8a84b;
    background: #fffbf0;
    padding: 12px 16px;
    margin: 12px 0 16px;
    font-size: 9.5pt;
    color: #444;
    line-height: 1.7;
    border-radius: 0 4px 4px 0;
  }
  .callout strong { color: #1a1a1a; }

  .callout-green {
    border-left: 3px solid #27ae60;
    background: #f0faf4;
  }
  .callout-blue {
    border-left: 3px solid #2980b9;
    background: #f0f6ff;
  }

  /* ── Finding cards ── */
  .finding {
    border: 1.5px solid #e0e0e0;
    border-radius: 6px;
    margin-bottom: 14px;
    overflow: hidden;
  }
  .finding-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #f5f5f5;
    border-bottom: 1px solid #e0e0e0;
  }
  .finding-header .fnum {
    font-weight: 700;
    font-size: 9pt;
    color: #444;
    letter-spacing: 0.04em;
  }
  .finding-header .ftitle {
    font-weight: 600;
    font-size: 10pt;
    color: #1a1a1a;
    flex: 1;
    padding: 0 12px;
  }
  .finding-body {
    padding: 12px 14px;
  }
  .finding-row {
    display: flex;
    gap: 0;
    margin-bottom: 8px;
    font-size: 9.5pt;
    line-height: 1.6;
  }
  .finding-label {
    font-weight: 600;
    font-size: 8pt;
    letter-spacing: 0.08em;
    color: #b8922a;
    text-transform: uppercase;
    min-width: 110px;
    padding-right: 12px;
    padding-top: 1px;
  }
  .finding-value {
    color: #333;
    flex: 1;
  }

  /* ── Two-column split ── */
  .split {
    display: flex;
    gap: 14px;
    margin-bottom: 16px;
  }
  .split-col {
    flex: 1;
    border: 1.5px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 9pt;
  }
  .split-col h4 {
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1.5px solid #e0e0e0;
  }
  .split-col.gold h4 { color: #b8922a; border-color: #e8d8a0; }
  .split-col.slate h4 { color: #4a6fa5; border-color: #c5d8f0; }
  .split-col ul { margin-left: 14px; }
  .split-col li { font-size: 9pt; color: #333; margin-bottom: 6px; }

  /* ── Sign-off box ── */
  .signoff {
    border: 1.5px solid #c8a84b;
    border-radius: 6px;
    padding: 14px 18px;
    background: #fffbf0;
    margin-top: 14px;
    font-size: 9.5pt;
    line-height: 1.7;
    color: #333;
  }
  .signoff strong { color: #1a1a1a; }
  .signoff .sig-name {
    font-size: 12pt;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 2px;
  }

  /* ── Page break helpers ── */
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }

  /* ── General ── */
  hr { border: 0; border-top: 1px solid #eee; margin: 18px 0; }
</style>
</head>
<body>

<!-- ═══ COVER ═══ -->
<div class="cover">
  <div>
    <div class="cover-badges">
      <span class="badge">Sample</span>
      <span class="badge">Redacted</span>
      <span class="badge">Sections 1 · 2 · 4 · 5 · 6 · 9 · 10 · 12 · 13</span>
    </div>

    <h1>Security &amp; Compliance<br>Evidence Pack</h1>
    <p class="cover-sub">
      A plain-English security report — showing what was checked, what was found,
      and what it means for the business. No technical background needed to read this.
    </p>

    <div class="cover-meta">
      <strong>Business scanned:</strong> titanos.tech (our own infrastructure)<br>
      <strong>Date of scan:</strong> 24 June 2026<br>
      <strong>Prepared by:</strong> Kyle Deligny &nbsp;·&nbsp; <strong>ABN:</strong> 34 318 502 254<br>
      <strong>Report type:</strong> External security assessment — 8 of 13 sections shown
    </div>

    <div class="cover-callout">
      <strong>This is a sample of our own report — published so you can see the format before engaging.</strong><br><br>
      The sections shown here are the externally-verifiable ones: the scan results, email security setup,
      website security, and the findings list. The sections that are specific to each client — your privacy
      policy, your breach response plan, your staff access record, your signed government checklist — are
      built from your own business data during the engagement. We don't include made-up versions of those
      in this sample because fabricating them would undermine the point.<br><br>
      <strong>What you're looking at:</strong> The same format, same structure, and same level of detail
      that every client receives — applied to our own business first.
    </div>
  </div>

  <div class="cover-footer">
    Titanos &nbsp;·&nbsp; ABN 34 318 502 254 &nbsp;·&nbsp; titanos.tech/our-evidence-pack
    &nbsp;·&nbsp; Issued 2026-06-24
  </div>
</div>


<!-- ═══ SECTION 01: SUMMARY ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">01 — What we found: the summary</h2>
  <p class="section-lead">
    A plain-English overview of the check run on titanos.tech on 24 June 2026.
    Suitable for sharing with an insurer, a prospective enterprise client, or a regulator — no technical knowledge required to read it.
  </p>

  <div class="callout callout-green">
    <strong>Overall result: Good posture, one minor item to fix.</strong><br>
    Five items were checked. Four are in strong shape. One low-risk item (a missing certificate restriction record)
    is easy to fix and has been scheduled. No high-severity issues were found.
  </div>

  <table class="score-table">
    <thead>
      <tr>
        <th style="width:28%">Area checked</th>
        <th style="width:14%">Result</th>
        <th>What it means in plain English</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Website encryption</td>
        <td><span class="pill pill-green">STRONG</span></td>
        <td>All connections to the website use the strongest available encryption (same level as major banks). Customers and visitors are protected.</td>
      </tr>
      <tr>
        <td>Email fraud protection</td>
        <td><span class="pill pill-green">STRONG</span></td>
        <td>Nobody can send a fake email pretending to be from this business. If they try, major email providers will reject it before it reaches anyone's inbox.</td>
      </tr>
      <tr>
        <td>Protection against interception</td>
        <td><span class="pill pill-green">STRONG</span></td>
        <td>Browsers are locked to the secure version of the site. Even if someone tried to redirect visitors to an unsecured connection, it would fail.</td>
      </tr>
      <tr>
        <td>Page security settings</td>
        <td><span class="pill pill-amber">PARTIAL</span></td>
        <td>One browser security setting is applied through the page itself rather than at the server level — it works, but the more secure approach is to set it at the server. Scheduled for improvement.</td>
      </tr>
      <tr>
        <td>Certificate restriction record</td>
        <td><span class="pill pill-amber">MISSING</span></td>
        <td>No record tells the internet "only these certificate authorities are allowed to issue a security certificate for this domain." Low risk — easy to add. Scheduled.</td>
      </tr>
      <tr>
        <td>Website access points</td>
        <td><span class="pill pill-green">OK</span></td>
        <td>The actual web server is protected behind Cloudflare and not directly visible on the internet. This is the correct setup.</td>
      </tr>
    </tbody>
  </table>
</div>

<hr>

<!-- ═══ SECTION 02: HOW WE CHECKED ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">02 — How this check was run</h2>
  <p class="section-lead">
    What we actually did — and what we deliberately did not do.
  </p>

  <p>
    This is an <strong>external, passive assessment</strong> — meaning we ran the check from outside the business,
    looking at the same information that any attacker, enterprise client, or government agency would see
    when they look up your business online. We did not attempt to log in to anything, did not try to break
    anything, and did not access any private data.
  </p>

  <div class="callout">
    <strong>In plain terms:</strong> Think of this like a building inspector walking around the outside of
    your premises and checking the locks on the doors they can see from the street — not breaking in,
    not going through drawers. Everything in this report is visible to anyone with internet access.
  </div>

  <p><strong>What we checked:</strong></p>
  <ul>
    <li><strong>Website connection security</strong> — how your website encrypts data between itself and visitors</li>
    <li><strong>Email fraud protection</strong> — whether your domain is set up to prevent fake emails</li>
    <li><strong>DNS records</strong> — the internet's address book entries for your domain, which affect email security and certificate authority control</li>
    <li><strong>Security settings sent to browsers</strong> — instructions your website gives to visitors' browsers about what it's allowed to do</li>
    <li><strong>What's publicly visible about your website's infrastructure</strong> — what an attacker can see about how your site is hosted</li>
  </ul>

  <p>
    Every finding in this report can be independently verified by anyone with internet access —
    we note what was checked and when, so anyone can re-run the same check and confirm the result.
  </p>

  <div class="callout callout-blue">
    <strong>90-day responsible disclosure:</strong> For any significant finding identified during a client
    engagement, we notify the business and allow 90 days to fix it before publishing any reference to it.
    This sample contains only our own findings — we scan our own infrastructure and any domain we are
    explicitly authorised to scan.
  </div>
</div>

<div class="page-break"></div>

<!-- ═══ SECTION 04: YOUR WEBSITE ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">04 — Your website and how it's accessed</h2>
  <p class="section-lead">
    We checked which "doors" to your website are open on the internet, who's answering them, and whether your actual web server is protected.
  </p>

  <table class="score-table">
    <thead>
      <tr>
        <th style="width:22%">Connection point</th>
        <th style="width:14%">Status</th>
        <th>What this means</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Standard web (port 80)</td>
        <td><span class="pill pill-green">PROTECTED</span></td>
        <td>Standard unencrypted web traffic — answered by Cloudflare (your web security provider), not your actual server. Cloudflare redirects all visitors to the secure version automatically.</td>
      </tr>
      <tr>
        <td>Secure web (port 443)</td>
        <td><span class="pill pill-green">PROTECTED</span></td>
        <td>Encrypted web traffic (the "padlock" connection). Answered by Cloudflare. All visitor data travels over this encrypted connection.</td>
      </tr>
      <tr>
        <td>Alternative ports (8080, 8443)</td>
        <td><span class="pill pill-green">PROTECTED</span></td>
        <td>Cloudflare's standard backup ports — also answered by Cloudflare, not your web server. Cloudflare blocks unauthorised requests on these automatically. No action needed.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-green">
    <strong>Key finding:</strong> Your actual web server (hosted on GitHub Pages) is not directly visible on the
    internet from our vantage point. All traffic goes through Cloudflare first — this is the correct and
    secure configuration. An attacker cannot reach your web server directly; they have to go through
    Cloudflare's protections.
  </div>
</div>

<hr>

<!-- ═══ SECTION 05: WEBSITE ENCRYPTION ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">05 — Website encryption (the "padlock")</h2>
  <p class="section-lead">
    We verified the security certificate that protects all connections to the website.
  </p>

  <table class="score-table">
    <thead>
      <tr>
        <th style="width:32%">What we checked</th>
        <th>What we found</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Certificate issued by</td>
        <td>Google Trust Services — a major, publicly trusted certificate authority</td>
      </tr>
      <tr>
        <td>Certificate covers</td>
        <td>titanos.tech and all subdomains (e.g. api.titanos.tech)</td>
      </tr>
      <tr>
        <td>Valid until</td>
        <td>30 August 2026 — actively monitored; auto-renews on a 90-day cycle</td>
      </tr>
      <tr>
        <td>Encryption strength</td>
        <td>Strongest currently available standard — the same level used by major banks and government websites</td>
      </tr>
      <tr>
        <td>Encryption version</td>
        <td>TLS 1.3 — the current standard. Older, weaker versions are not accepted.</td>
      </tr>
      <tr>
        <td>Browser lock-in (HSTS)</td>
        <td>Active — browsers are permanently instructed to only use the secure version of this site, even if someone tries to redirect them to an unencrypted version. This setting is registered on a global browser preload list.</td>
      </tr>
      <tr>
        <td>Certificate validation</td>
        <td>Passed — independently confirmed as valid and not revoked</td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-green">
    <strong>In plain terms:</strong> When someone visits titanos.tech, their connection is as secure as a
    visit to their online banking. The certificate is current, issued by a trusted authority, and uses
    the strongest available encryption. Browsers are locked to the secure version and cannot be tricked
    into using an unencrypted connection.
  </div>
</div>

<div class="page-break"></div>

<!-- ═══ SECTION 06: EMAIL FRAUD PROTECTION ═══ -->
<div class="section-block">
  <h2 class="section-heading">06 — Email fraud protection</h2>
  <p class="section-lead">
    We checked whether your domain is protected against email impersonation — one of the most common
    techniques used in invoice fraud and phishing attacks on small businesses.
  </p>

  <div class="callout">
    <strong>Why this matters:</strong> "Email spoofing" is when an attacker sends an email that appears to
    come from your business — your domain, your branding — but didn't. Common uses: fake invoices sent to
    your clients in your name, phishing emails to your staff pretending to be you, fraud. Three technical
    records (SPF, DKIM, DMARC) block this at the email provider level. If they're set correctly, major
    email providers like Gmail and Outlook will reject the fake email before it reaches anyone.
  </div>

  <table class="score-table">
    <thead>
      <tr>
        <th style="width:18%">Protection</th>
        <th style="width:14%">Status</th>
        <th>What it does in plain English</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>SPF</strong><br><span style="font-size:8.5pt;color:#666;">(Sender Policy Framework)</span></td>
        <td><span class="pill pill-green">ACTIVE</span></td>
        <td>A record that says "only Google's mail servers are authorised to send email from @titanos.tech." Anyone else trying to send as this domain will be rejected. Set to the strictest level.</td>
      </tr>
      <tr>
        <td><strong>DKIM</strong><br><span style="font-size:8.5pt;color:#666;">(Email signing)</span></td>
        <td><span class="pill pill-green">ACTIVE</span></td>
        <td>A digital signature applied to every email sent from this domain. The recipient's email provider can verify the signature to confirm the email genuinely came from us and wasn't modified in transit.</td>
      </tr>
      <tr>
        <td><strong>DMARC</strong><br><span style="font-size:8.5pt;color:#666;">(Fraud policy)</span></td>
        <td><span class="pill pill-green">ACTIVE (strictest)</span></td>
        <td>The overall policy that tells email providers what to do with emails that fail the checks above. Set to "reject" — meaning fake emails are blocked outright, not just flagged. We also receive a daily report of any attempts.</td>
      </tr>
      <tr>
        <td><strong>CAA record</strong><br><span style="font-size:8.5pt;color:#666;">(Certificate restriction)</span></td>
        <td><span class="pill pill-amber">NOT SET</span></td>
        <td>A record that restricts which certificate authorities are allowed to issue a security certificate for this domain. Currently absent — not a vulnerability, but a best-practice hardening step. Scheduled for addition. See finding F-01.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout callout-green">
    <strong>In plain terms:</strong> The email fraud protection for titanos.tech is at the strongest
    practical configuration. If anyone tries to send a fake email from @titanos.tech, Gmail, Outlook,
    and most other major providers will reject it before it reaches the recipient. We also receive a
    daily report if any attempts are made.
  </div>
</div>

<hr>

<!-- ═══ SECTION 09: YOU VS HOST ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">09 — What you control vs what your provider controls</h2>
  <p class="section-lead">
    One of the most important things a compliance report clarifies: which security settings are yours
    to manage, and which ones are controlled by your hosting or technology providers.
    This matters because "reasonable steps" under Australian privacy law only applies to things you can actually control.
  </p>

  <div class="split">
    <div class="split-col gold">
      <h4>You control</h4>
      <ul>
        <li>Your email security records (SPF, DKIM, DMARC) — set in your domain's DNS settings</li>
        <li>Your domain registrar account security (lock status, two-factor login)</li>
        <li>The security settings built into your website's code</li>
        <li>Your privacy policy content and the AI disclosure in it</li>
        <li>Who has access to your accounts and when that access is removed</li>
        <li>Your data breach response plan</li>
      </ul>
    </div>
    <div class="split-col slate">
      <h4>Your hosting provider controls (Cloudflare + GitHub Pages)</h4>
      <ul>
        <li>The website's encrypted connection (the padlock)</li>
        <li>Protection against large-scale traffic attacks on the server</li>
        <li>Some browser security headers that need to be set at the server level</li>
        <li>Physical infrastructure and server-level hardening</li>
        <li>DDoS protection</li>
      </ul>
    </div>
  </div>

  <div class="callout">
    <strong>Why this matters for your compliance:</strong> For any item in the "your provider controls"
    column, the compliance engagement gives you the exact language to send to your provider asking them
    to fix it. If they refuse or it's not possible, that refusal gets documented in your evidence pack
    as "reasonable steps taken" — which is the standard the regulator actually assesses against. You are
    never left responsible for something outside your control.
  </div>
</div>

<div class="page-break"></div>

<!-- ═══ SECTION 10: FINDINGS ═══ -->
<div class="section-block">
  <h2 class="section-heading">10 — What needs attention: findings list</h2>
  <p class="section-lead">
    Five items were logged from this scan. All are low-severity or informational — no urgent or high-risk
    issues were found. Listed in order of priority: easiest to fix with most benefit first.
  </p>

  <!-- F-01 -->
  <div class="finding no-break">
    <div class="finding-header">
      <span class="fnum">F-01</span>
      <span class="ftitle">No certificate restriction record published</span>
      <span class="pill pill-amber">LOW RISK</span>
    </div>
    <div class="finding-body">
      <div class="finding-row">
        <span class="finding-label">What it means</span>
        <span class="finding-value">
          Currently, any major certificate authority in the world could technically issue a security
          certificate for titanos.tech. A "CAA record" limits this to only the two providers that actually
          issue certificates for this domain. This doesn't create a current vulnerability — it just narrows
          the window for a rare type of attack involving a fraudulent certificate issued by a rogue authority.
        </span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Real-world impact</span>
        <span class="finding-value">
          Low. The specific attack this defends against requires a certificate authority itself to be
          compromised — an extremely rare event. But the fix takes 5 minutes and is best practice.
        </span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Who fixes it</span>
        <span class="finding-value">You — via your domain settings at Cloudflare (the DNS provider)</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">How hard</span>
        <span class="finding-value">5 minutes — add three lines to your DNS settings. Done on the working call.</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Status</span>
        <span class="finding-value"><span class="pill pill-amber">SCHEDULED — fix applied on working call</span></span>
      </div>
    </div>
  </div>

  <!-- F-02 -->
  <div class="finding no-break">
    <div class="finding-header">
      <span class="fnum">F-02</span>
      <span class="ftitle">One browser security setting applied via the page, not the server</span>
      <span class="pill pill-grey">INFO — NO ACTION NEEDED</span>
    </div>
    <div class="finding-body">
      <div class="finding-row">
        <span class="finding-label">What it means</span>
        <span class="finding-value">
          A setting called "Content Security Policy" — which tells browsers what content is allowed to
          load on your pages — is currently set inside the page itself. This works correctly for visitors.
          The stricter approach is to have it set at the server level, so it applies even before the page
          loads. This is a best-practice improvement, not a current vulnerability.
        </span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Real-world impact</span>
        <span class="finding-value">None at present — the protection is working. This is an incremental hardening step.</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Who fixes it</span>
        <span class="finding-value">Shared — the setting itself is ours; the server-level injection is a Cloudflare configuration</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Status</span>
        <span class="finding-value"><span class="pill pill-grey">INFORMATIONAL — scheduled for next infrastructure update</span></span>
      </div>
    </div>
  </div>

  <!-- F-03 -->
  <div class="finding no-break">
    <div class="finding-header">
      <span class="fnum">F-03</span>
      <span class="ftitle">Browser permissions not explicitly declared</span>
      <span class="pill pill-grey">INFO — NO ACTION NEEDED</span>
    </div>
    <div class="finding-body">
      <div class="finding-row">
        <span class="finding-label">What it means</span>
        <span class="finding-value">
          A "Permissions Policy" tells browsers which sensitive features — camera, microphone, location,
          payment — this website is allowed to use. Currently there's no explicit policy set. Since the
          site doesn't use any of those features, there's no current risk. Adding an explicit "deny all"
          policy guards against future changes accidentally enabling them.
        </span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Real-world impact</span>
        <span class="finding-value">None today. Preventive measure for future-proofing.</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Who fixes it</span>
        <span class="finding-value">Hosting provider (Cloudflare) — a configuration-level change on their side</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Status</span>
        <span class="finding-value"><span class="pill pill-grey">INFORMATIONAL — escalation language provided to Cloudflare</span></span>
      </div>
    </div>
  </div>

  <!-- F-04 -->
  <div class="finding no-break">
    <div class="finding-header">
      <span class="fnum">F-04</span>
      <span class="ftitle">Two additional website access points visible</span>
      <span class="pill pill-grey">INFO — NO ACTION NEEDED</span>
    </div>
    <div class="finding-body">
      <div class="finding-row">
        <span class="finding-label">What it means</span>
        <span class="finding-value">
          We can see four connection points to the website rather than the standard two. The extra two
          are Cloudflare's standard backup ports — they don't lead to your actual web server, and
          Cloudflare blocks any unauthorised requests on them automatically. Your actual server is not
          exposed through these.
        </span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Real-world impact</span>
        <span class="finding-value">None — these are Cloudflare's default configuration. No origin server exposure.</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Who fixes it</span>
        <span class="finding-value">Not required. Cloudflare — optional stricter configuration available if desired.</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Status</span>
        <span class="finding-value"><span class="pill pill-grey">INFORMATIONAL — no action required</span></span>
      </div>
    </div>
  </div>

  <!-- F-05 -->
  <div class="finding no-break">
    <div class="finding-header">
      <span class="fnum">F-05</span>
      <span class="ftitle">Outdated browser instruction still being sent</span>
      <span class="pill pill-grey">INFO — NO ACTION NEEDED</span>
    </div>
    <div class="finding-body">
      <div class="finding-row">
        <span class="finding-label">What it means</span>
        <span class="finding-value">
          The website sends an old security instruction ("Expect-CT") that was relevant a few years ago
          but has since been replaced by a new standard that all major certificate authorities now follow
          by default. Modern browsers simply ignore this instruction. It's not harmful — just a leftover
          from an older configuration that can be cleaned up.
        </span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Real-world impact</span>
        <span class="finding-value">None. Deprecated instruction, ignored by current browsers.</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Who fixes it</span>
        <span class="finding-value">Hosting provider (Cloudflare) — optional cleanup item</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Status</span>
        <span class="finding-value"><span class="pill pill-grey">INFORMATIONAL — no action required</span></span>
      </div>
    </div>
  </div>
</div>

<div class="page-break"></div>

<!-- ═══ SECTION 12: HOW TO VERIFY ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">12 — How to verify this independently</h2>
  <p class="section-lead">
    Every finding in this report is based on publicly accessible information. If you, your IT provider,
    or a prospective client wants to independently verify any claim, the information is available to anyone
    with internet access.
  </p>

  <p>
    The checks run to produce this report use publicly available tools that can be run from any computer.
    They work by looking up publicly visible records on the internet — the same information any large
    enterprise client or government agency would check when doing due diligence on a supplier.
  </p>

  <div class="callout">
    <strong>For your IT provider:</strong> The raw technical output (the exact commands run and results
    returned) is available on request. Every finding can be independently reproduced from any
    internet-connected machine using standard tools. We provide the reproducibility commands to clients
    on the 30-day review call so your IT team can re-run the check themselves and confirm the current state.
  </div>

  <p>
    <strong>What this means for your evidence pack:</strong> The value of a reproducible report is that any
    finding in it can be independently confirmed. If a regulator, insurer, or enterprise client
    questions a claim — "did you really fix the email fraud protection?" — you can point to a command
    they can run themselves to verify it. This is the difference between a document that says something
    was done and one that proves it.
  </p>
</div>

<hr>

<!-- ═══ SECTION 13: COMMITMENT + SIGN-OFF ═══ -->
<div class="section-block no-break">
  <h2 class="section-heading">13 — How this was produced and our commitment to you</h2>

  <p><strong>What we scan:</strong></p>
  <ul>
    <li>Our own infrastructure (this report)</li>
    <li>Any domain we are explicitly authorised to scan — every paying client engagement, plus businesses that have requested a free external scan via titanos.tech/scan</li>
  </ul>

  <p style="margin-top:10px;"><strong>What we never do:</strong></p>
  <ul>
    <li>Attempt to log in to anything</li>
    <li>Try to exploit any vulnerability</li>
    <li>Cause any disruption to the business being scanned</li>
    <li>Access private data</li>
  </ul>

  <p style="margin-top:10px;"><strong>90-day responsible disclosure:</strong> For any significant finding
  identified during a client engagement, we notify the affected business and allow at least 90 days to
  fix the issue before making any public reference to it. This sample contains only findings from our
  own infrastructure.</p>

  <p style="margin-top:10px;"><strong>About this sample:</strong> This document carries the same format,
  structure, and level of detail as every compliance engagement evidence pack — applied to our own
  business first. The sections not shown here (privacy policy, breach response plan, staff access record,
  Microsoft 365 / Google Workspace hardening evidence, two-factor login proof, backup plan, software
  update schedule, signed government security checklist, and privacy law compliance letter) are produced
  from each client's own business data during the engagement. We don't fabricate sample versions of those
  because a compliance document with made-up data defeats the purpose.</p>

  <div class="signoff">
    <div class="sig-name">Kyle Deligny</div>
    <div style="font-size:9pt;color:#555;margin-bottom:8px;">
      ABN 34 318 502 254 &nbsp;·&nbsp; titanos.tech &nbsp;·&nbsp; kyle@titanos.tech
    </div>
    <div style="font-size:9pt;color:#555;">
      Every finding in this report is personally reviewed before it leaves our hands.
      The technical checks are run by automated tools, but the interpretation, the plain-English
      explanation, and the sign-off are mine. If something in this report is wrong, that's on me —
      and I give you the tools to check it yourself so you don't have to take my word for it.
    </div>
    <div style="margin-top:10px;font-size:8.5pt;color:#888;">
      Issued 2026-06-24. Re-issued with plain-English rewrite 2026-06-26.
      See titanos.tech/methodology for the full technical scope.
    </div>
  </div>
</div>

</body>
</html>
"""

def main():
    out_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "public",
        "sample-evidence-pack-excerpt.pdf",
    )

    try:
        from weasyprint import HTML as WH
        WH(string=HTML, base_url=None).write_pdf(out_path)
        print(f"PDF written: {out_path}")
    except ImportError:
        print("WeasyPrint not found in default python. Trying pip install...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "weasyprint"], check=True)
        from weasyprint import HTML as WH
        WH(string=HTML, base_url=None).write_pdf(out_path)
        print(f"PDF written: {out_path}")

if __name__ == "__main__":
    main()
