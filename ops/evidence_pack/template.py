"""
S++ Evidence Pack Template — two-layer, owner-readable + IT-verifiable.

build_html(data, mode="sample") -> HTML string -> WeasyPrint -> PDF

mode="sample"     : titanos own-infra, externally-verifiable sections only.
mode="engagement" : all 13 sections, operational sections populated from client data.

Input schema: see sample_data.py for the full dict structure.
"""

import html as _html


# ── helpers ──────────────────────────────────────────────────────────────────

def _e(s):
    return _html.escape(str(s)) if s is not None else ""


def _pill(status, label=None):
    map_label = {
        "green": "\U0001f7e2 Strong",
        "amber": "\U0001f7e1 Minor gap",
        "red":   "\U0001f534 Needs attention",
        "grey":  "\u2610 Info",
        "info":  "\u2139\ufe0f Info",
    }
    map_cls = {
        "green": "pill-green",
        "amber": "pill-amber",
        "red":   "pill-red",
        "grey":  "pill-grey",
        "info":  "pill-grey",
    }
    text = label or map_label.get(status, status)
    cls  = map_cls.get(status, "pill-grey")
    return '<span class="pill %s">%s</span>' % (cls, _e(text))


def _owner_block(text):
    return (
        '<div class="owner-layer">'
        '<div class="layer-label">What this means for you</div>'
        + text +
        '</div>'
    )


def _tech_block(raw_text, label="Technical detail \u2014 for your IT person"):
    return (
        '<div class="tech-layer">'
        '<div class="tech-label">%s</div>'
        '<pre>%s</pre>'
        '</div>'
    ) % (_e(label), _e(raw_text))


def _section_header(plain_name, tech_name, status, page_break=False):
    pb = '<div class="page-break"></div>\n' if page_break else ""
    chip = _pill(status)
    return (
        pb +
        '<div class="section-title-row">'
        '<div class="section-title-left">'
        '<div class="section-title-plain">%s</div>'
        '<div class="section-title-tech">Technical reference: %s</div>'
        '</div>'
        '<div class="section-title-chip">%s</div>'
        '</div>'
    ) % (_e(plain_name), _e(tech_name), chip)


# ── CSS ──────────────────────────────────────────────────────────────────────

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.65;
  color: #1a1a1a;
  background: #fff;
}

@page {
  size: A4;
  margin: 16mm 15mm 20mm 15mm;
  @bottom-center {
    content: "Titanos  ABN 34 318 502 254  Every claim independently verifiable  page " counter(page) " of " counter(pages);
    font-size: 7.5pt;
    color: #999;
    font-family: 'Inter', sans-serif;
  }
  @top-right {
    content: "SAMPLE - REDACTED";
    font-size: 7.5pt;
    color: #ccc;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.08em;
  }
}

/* Cover */
.cover {
  padding: 28mm 8mm 16mm;
  page-break-after: always;
  min-height: 220mm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.cover-badges { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.badge {
  display: inline-block;
  font-size: 7.5pt;
  font-weight: 600;
  letter-spacing: 0.10em;
  padding: 3px 9px;
  border: 1.5px solid #c8a84b;
  border-radius: 3px;
  color: #c8a84b;
  text-transform: uppercase;
}
.cover h1 {
  font-family: 'Merriweather', Georgia, serif;
  font-size: 24pt;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.25;
  margin-bottom: 10px;
}
.cover-sub { font-size: 11pt; color: #444; margin-bottom: 24px; line-height: 1.55; }
.cover-meta {
  border-left: 3px solid #c8a84b;
  padding: 10px 14px;
  background: #fffbf0;
  font-size: 9.5pt;
  color: #555;
  line-height: 1.85;
  margin-bottom: 22px;
}
.cover-meta strong { color: #1a1a1a; }
.cover-callout {
  background: #f8f8f8;
  border-radius: 6px;
  padding: 14px 16px;
  font-size: 9.5pt;
  color: #444;
  line-height: 1.7;
}
.cover-callout strong { color: #1a1a1a; }
.cover-footer {
  font-size: 8.5pt;
  color: #999;
  margin-top: 16px;
  border-top: 1px solid #eee;
  padding-top: 10px;
}

/* Scorecard page */
.scorecard-page { page-break-after: always; }
.scorecard-headline {
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  font-size: 12pt;
  font-weight: 700;
  line-height: 1.5;
}
.scorecard-headline.green { background: #e8f5ea; color: #1e6e30; border: 1.5px solid #5cb870; }
.scorecard-headline.amber { background: #fff8e1; color: #7a5c00; border: 1.5px solid #e6b800; }
.scorecard-headline.red   { background: #fde8e8; color: #a00;    border: 1.5px solid #e53935; }
.scorecard-page h2 {
  font-family: 'Merriweather', Georgia, serif;
  font-size: 15pt;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #c8a84b;
}
.sc-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 18px;
  font-size: 10pt;
}
.sc-table thead tr { background: #2a2a2a; color: #fff; }
.sc-table thead th {
  padding: 8px 12px;
  text-align: left;
  font-size: 8.5pt;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.sc-table tbody tr:nth-child(even) { background: #fafafa; }
.sc-table tbody tr:nth-child(odd)  { background: #fff; }
.sc-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}
.sc-table td:first-child { font-weight: 600; width: 30%; }
.sc-table td:nth-child(2) { width: 16%; white-space: nowrap; }
.sc-table td:last-child { font-size: 9.5pt; color: #444; }

.next-actions-box {
  border: 1.5px solid #c8a84b;
  border-radius: 8px;
  padding: 14px 18px;
  background: #fffbf0;
}
.next-actions-box h3 {
  font-size: 10pt;
  font-weight: 700;
  color: #b8922a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.next-action-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  font-size: 9.5pt;
  align-items: flex-start;
}
.action-num {
  min-width: 22px;
  height: 22px;
  background: #c8a84b;
  color: #fff;
  border-radius: 50%;
  font-size: 8pt;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
  flex-shrink: 0;
}
.action-body { flex: 1; }
.action-chips { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
.action-chip {
  font-size: 7.5pt;
  padding: 2px 7px;
  border-radius: 3px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: #f0f0f0;
  color: #555;
}
.action-chip.who    { background: #e8f0ff; color: #2c5aa0; }
.action-chip.effort { background: #e8f5ea; color: #1e6e30; }

/* Section title two-layer pattern */
.section-block { margin-bottom: 24px; }
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1.5px solid #e8d8a0;
  gap: 12px;
}
.section-title-left { flex: 1; }
.section-title-plain {
  font-family: 'Merriweather', Georgia, serif;
  font-size: 13pt;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.3;
}
.section-title-tech { font-size: 8pt; color: #999; margin-top: 3px; }
.section-title-chip { padding-top: 2px; flex-shrink: 0; }

/* Owner layer */
.owner-layer {
  background: #fffbf0;
  border-left: 3px solid #c8a84b;
  border-radius: 0 5px 5px 0;
  padding: 11px 15px;
  margin: 9px 0 5px;
  font-size: 10pt;
  line-height: 1.7;
  color: #222;
}
.layer-label {
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #b8922a;
  text-transform: uppercase;
  margin-bottom: 6px;
}

/* Tech layer */
.tech-layer {
  background: #f3f3f3;
  border-left: 3px solid #ccc;
  border-radius: 0 5px 5px 0;
  padding: 9px 14px;
  margin: 0 0 10px;
}
.tech-label {
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #aaa;
  text-transform: uppercase;
  margin-bottom: 6px;
  font-family: 'Inter', sans-serif;
}
.tech-layer pre {
  font-family: 'Courier New', Courier, monospace;
  font-size: 7.5pt;
  color: #555;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Pills */
.pill {
  display: inline-block;
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 3px 9px;
  border-radius: 20px;
  white-space: nowrap;
}
.pill-green { background: #e6f4ea; color: #1e7e34; }
.pill-amber { background: #fff3cd; color: #856404; }
.pill-red   { background: #fde8e8; color: #c0392b; }
.pill-grey  { background: #f0f0f0; color: #555; }

/* Tables */
.data-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
  font-size: 9.5pt;
}
.data-table thead tr { background: #2a2a2a; color: #fff; }
.data-table thead th {
  padding: 8px 11px;
  text-align: left;
  font-size: 8pt;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.data-table tbody tr:nth-child(even) { background: #fafafa; }
.data-table tbody tr:nth-child(odd)  { background: #fff; }
.data-table td {
  padding: 8px 11px;
  border-bottom: 1px solid #eee;
  vertical-align: top;
}

/* Callout boxes */
.callout {
  border-left: 3px solid #c8a84b;
  background: #fffbf0;
  padding: 11px 15px;
  margin: 10px 0 13px;
  font-size: 9.5pt;
  color: #444;
  line-height: 1.7;
  border-radius: 0 4px 4px 0;
}
.callout strong { color: #1a1a1a; }
.callout-green { border-left-color: #27ae60; background: #f0faf3; }
.callout-blue  { border-left-color: #2980b9; background: #f0f6ff; }

/* Finding cards */
.finding {
  border: 1.5px solid #e0e0e0;
  border-radius: 7px;
  margin-bottom: 14px;
  overflow: hidden;
  page-break-inside: avoid;
}
.finding-header {
  padding: 10px 14px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}
.finding-id-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 7px;
}
.finding-id { font-weight: 700; font-size: 8.5pt; color: #666; letter-spacing: 0.06em; flex-shrink: 0; }
.finding-title { font-weight: 700; font-size: 10.5pt; color: #1a1a1a; line-height: 1.35; }
.finding-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.finding-chip {
  font-size: 7pt;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 3px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.chip-amber { background: #fff3cd; color: #856404; }
.chip-grey  { background: #f0f0f0; color: #555; }
.chip-effort { background: #e8f0ff; color: #2c5aa0; }
.chip-who   { background: #f3e8ff; color: #5a2c8a; }

.finding-body { padding: 12px 14px; }
.finding-row {
  display: flex;
  gap: 0;
  margin-bottom: 10px;
  font-size: 9.5pt;
  line-height: 1.65;
}
.finding-label {
  font-weight: 700;
  font-size: 7.5pt;
  letter-spacing: 0.09em;
  color: #b8922a;
  text-transform: uppercase;
  min-width: 105px;
  padding-right: 12px;
  padding-top: 2px;
  flex-shrink: 0;
}
.finding-value { color: #333; flex: 1; }

/* Two-column split */
.split { display: flex; gap: 12px; margin-bottom: 14px; }
.split-col {
  flex: 1;
  border: 1.5px solid #e0e0e0;
  border-radius: 6px;
  padding: 11px 13px;
  font-size: 9pt;
}
.split-col h4 {
  font-size: 8pt;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  margin-bottom: 9px;
  padding-bottom: 5px;
  border-bottom: 1.5px solid #e0e0e0;
}
.split-col.gold  h4 { color: #b8922a; border-color: #e8d8a0; }
.split-col.slate h4 { color: #4a6fa5; border-color: #c5d8f0; }
.split-col ul { margin-left: 13px; }
.split-col li { font-size: 9pt; color: #333; margin-bottom: 6px; }

/* Sign-off */
.signoff {
  border: 1.5px solid #c8a84b;
  border-radius: 6px;
  padding: 14px 18px;
  background: #fffbf0;
  margin-top: 12px;
  font-size: 9.5pt;
  line-height: 1.7;
  color: #333;
}
.signoff .sig-name { font-size: 12pt; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }

/* Glossary */
.glossary-entry {
  display: flex;
  gap: 14px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 9.5pt;
}
.glossary-term { font-weight: 700; color: #1a1a1a; min-width: 90px; flex-shrink: 0; }
.glossary-plain { color: #444; flex: 1; }

/* Prose helpers */
p { margin-bottom: 9px; }
ul { margin: 7px 0 9px 17px; }
li { margin-bottom: 5px; line-height: 1.6; color: #333; }
li strong { color: #1a1a1a; }
hr { border: 0; border-top: 1px solid #eee; margin: 16px 0; }
.page-break { page-break-before: always; }
.no-break { page-break-inside: avoid; }
.section-lead { color: #555; font-size: 9.5pt; margin-bottom: 12px; line-height: 1.65; }
"""


# ── Section builders ──────────────────────────────────────────────────────────

def _cover(d):
    c = d["client"]
    if c["mode"] == "sample":
        mode_badge = "Sample &middot; Redacted &middot; Own infrastructure"
        section_note = "Sections shown: 01 &middot; 02 &middot; 04 &middot; 05 &middot; 06 &middot; 09 &middot; 10 &middot; 12 &middot; 13"
        callout_note = (
            "<strong>This is a sample</strong> &mdash; produced from our own infrastructure, titanos.tech. "
            "The format, structure, and level of detail here is identical to every client engagement. "
            "The five operational sections specific to each client (privacy policy, breach plan, staff access record, "
            "government security checklist, and monitoring evidence) are built from your own data during the engagement "
            "&mdash; we don&rsquo;t fabricate sample versions of those because a compliance document with invented data defeats the purpose."
        )
    else:
        mode_badge = "Engagement &middot; %s" % _e(c["business_name"])
        section_note = "All 13 sections"
        callout_note = (
            "<strong>Prepared for %s.</strong> Every finding in this report was identified from a real external "
            "scan of %s on %s." % (_e(c["business_name"]), _e(c["domain"]), _e(c["scan_date"]))
        )

    return """
<div class="cover">
  <div>
    <div class="cover-badges">
      <span class="badge">%s</span>
      <span class="badge">%s</span>
    </div>

    <h1>Security &amp; Compliance<br>Evidence Pack</h1>
    <p class="cover-sub">
      A plain-English security report &mdash; what was checked, what was found,
      and what it means for the business. No technical background needed.
    </p>

    <div class="cover-meta">
      <strong>Business scanned:</strong> %s (%s)<br>
      <strong>Date of scan:</strong> %s<br>
      <strong>Prepared by:</strong> %s &nbsp;&middot;&nbsp; <strong>ABN:</strong> %s<br>
      <strong>Method:</strong> External passive assessment &mdash; no login attempts, no exploitation
    </div>

    <div class="cover-callout">
      <strong>What you&rsquo;re holding:</strong> This is a two-layer report. The plain-English sections
      are written for you &mdash; the business owner &mdash; so you can understand your security posture
      without needing a technical background. Each section also includes a
      <em>technical detail</em> block (clearly labelled, visually separate) that your IT person
      can read and independently verify. You don&rsquo;t need to read those parts &mdash; they&rsquo;re there so
      nobody has to take our word for anything.<br><br>
      %s
    </div>
  </div>
  <div class="cover-footer">
    Titanos &nbsp;&middot;&nbsp; ABN 34 318 502 254 &nbsp;&middot;&nbsp; titanos.tech/our-evidence-pack &nbsp;&middot;&nbsp; Issued %s
  </div>
</div>""" % (
        mode_badge, section_note,
        _e(c["domain"]), _e(c["engagement_type"]),
        _e(c["scan_date"]),
        _e(c["prepared_by"]), _e(c["abn"]),
        callout_note,
        _e(c["scan_date"]),
    )


def _scorecard(d):
    ov = d["overall"]
    sc_rows = ""
    for row in d["scorecard"]:
        sc_rows += (
            "<tr><td>%s</td><td>%s</td><td>%s</td></tr>"
            % (_e(row["area"]), _e(row["label"]), _e(row["meaning"]))
        )

    actions_html = ""
    for i, a in enumerate(d["next_actions"], 1):
        actions_html += (
            '<div class="next-action-row">'
            '<div class="action-num">%d</div>'
            '<div class="action-body">'
            '<strong>%s</strong>'
            '<div class="action-chips">'
            '<span class="action-chip who">&#128100; %s</span>'
            '<span class="action-chip effort">&#8987; %s</span>'
            '<span class="action-chip">%s</span>'
            '</div>'
            '</div>'
            '</div>'
        ) % (i, _e(a["action"]), _e(a["who"]), _e(a["effort"]), _e(a["where"]))

    return """
<div class="scorecard-page">
  <h2>Your security posture at a glance</h2>

  <div class="scorecard-headline %s">
    Your external security posture is <strong>%s</strong>.<br>
    <span style="font-size:10.5pt;font-weight:500">%s</span>
  </div>

  <table class="sc-table">
    <thead>
      <tr>
        <th style="width:30%%">Area checked</th>
        <th style="width:15%%">Result</th>
        <th>What it means in plain English</th>
      </tr>
    </thead>
    <tbody>%s</tbody>
  </table>

  <div class="next-actions-box">
    <h3>What you should do next (if anything)</h3>
    %s
    <div style="margin-top:12px;font-size:8.5pt;color:#888;border-top:1px solid #e8d8a0;padding-top:8px">
      All three items above are low-risk housekeeping &mdash; none represent an active vulnerability.
      We walk through these on the first working call together.
    </div>
  </div>
</div>""" % (
        ov["posture_status"],
        _e(ov["posture"]),
        _e(ov["summary"]),
        sc_rows,
        actions_html,
    )


def _section_01_summary(d):
    ov = d["overall"]
    c  = d["client"]
    sc_rows = "".join(
        "<tr><td>%s</td><td>%s</td><td>%s</td></tr>"
        % (_e(r["area"]), _e(r["label"]), _e(r["meaning"]))
        for r in d["scorecard"]
    )
    owner_text = (
        "<strong>Overall result: %s.</strong><br>%s<br><br>"
        "Breakdown: <strong>%d critical</strong> &middot; <strong>%d high</strong> "
        "&middot; <strong>%d medium</strong> &middot; <strong>%d low</strong> "
        "&middot; <strong>%d informational</strong>"
    ) % (
        _e(ov["posture"]), _e(ov["summary"]),
        ov["critical"], ov["high"], ov["medium"], ov["low"], ov["info"],
    )
    header = _section_header(
        "01 \u2014 What we found: the quick summary",
        "Executive summary / finding overview",
        ov["posture_status"],
    )
    owner  = _owner_block(owner_text)
    return """
<div class="section-block no-break">
  %s
  <p class="section-lead">
    A plain-English overview of the external check run on %s on %s.
    Suitable for sharing with an insurer, prospective enterprise client, or regulator.
  </p>
  %s
  <table class="data-table">
    <thead><tr><th style="width:30%%">Area checked</th><th style="width:15%%">Result</th><th>Plain-English meaning</th></tr></thead>
    <tbody>%s</tbody>
  </table>
</div>
<hr>""" % (header, _e(c["domain"]), _e(c["scan_date"]), owner, sc_rows)


def _section_02_method(d):
    header = _section_header(
        "02 \u2014 How this check was run (and what we didn\u2019t do)",
        "Assessment methodology / scope",
        "green",
    )
    owner = _owner_block(
        "This is an <strong>external, passive assessment</strong> &mdash; we ran the check from outside "
        "the business, looking at the same information any attacker, enterprise client, or government "
        "agency would see when looking up your business online. We did not attempt to log in to anything, "
        "did not try to break anything, and did not access any private data.<br><br>"
        "<strong>Think of it this way:</strong> A building inspector walking around the outside of your "
        "premises, checking the locks on the doors visible from the street &mdash; not breaking in, "
        "not going through drawers. Everything in this report is visible to anyone with internet access."
    )
    tech = _tech_block(
        "Scope: passive external reconnaissance only. No authentication attempts. No exploitation.\n"
        "Tools: nmap (port scan), openssl (TLS/certificate analysis), curl (HTTP headers),\n"
        "       python3 + dnspython (DNS records: SPF, DMARC, DKIM, CAA).\n\n"
        "All checks run from external IP. Scan authorised on own infrastructure (titanos.tech).\n"
        "Assessment date: 27 June 2026."
    )
    return """
<div class="section-block no-break">
  %s
  <p class="section-lead">What we actually did &mdash; and what we deliberately did not do.</p>
  %s
  <p><strong>What we checked:</strong></p>
  <ul>
    <li><strong>Website connection security</strong> &mdash; how your website encrypts data between itself and visitors</li>
    <li><strong>Email fraud protection</strong> &mdash; whether your domain prevents fake emails
      (SPF, DKIM, DMARC &mdash; explained in Section 06)</li>
    <li><strong>DNS records</strong> (your domain&rsquo;s internet address book entries) &mdash; affect email security
      and certificate authority control</li>
    <li><strong>Security settings sent to browsers</strong> &mdash; instructions your website gives to visitors&rsquo;
      browsers about what it&rsquo;s allowed to do</li>
    <li><strong>What&rsquo;s publicly visible about your website&rsquo;s infrastructure</strong> &mdash; what an attacker
      can learn about how your site is hosted</li>
  </ul>
  <div class="callout callout-blue">
    <strong>90-day responsible disclosure:</strong> For any significant finding identified during a client
    engagement, we notify the business and allow 90 days to fix it before making any public reference.
    This sample contains only our own infrastructure findings.
  </div>
  %s
</div>""" % (header, owner, tech)


def _section_04_ports(d):
    p = d["ports"]
    rows = ""
    for r in p["results"]:
        rows += (
            "<tr><td>%d/tcp</td>"
            '<td><span class="pill pill-green">Open &mdash; Cloudflare</span></td>'
            "<td>%s</td></tr>"
        ) % (r["port"], _e(r["meaning"]))

    header = _section_header(
        "04 \u2014 Your website\u2019s connection points",
        "Open ports / network exposure",
        "green",
        page_break=True,
    )
    owner = _owner_block(
        "<strong>All four connection points are answered by Cloudflare &mdash; not your actual web server.</strong> "
        "The two standard ports (80 and 443) handle regular and encrypted web traffic. The other two (8080 and 8443) "
        "are Cloudflare&rsquo;s backup ports and are also handled by Cloudflare. Your actual server is not directly "
        "reachable from the internet &mdash; visitors must go through Cloudflare&rsquo;s protections first. "
        "This is the correct and secure configuration."
    )
    tech = _tech_block(p["scan_raw"])
    return """
<div class="section-block no-break">
  %s
  <p class="section-lead">
    We checked which &ldquo;doors&rdquo; to your website are open on the internet, who&rsquo;s answering them,
    and whether your actual web server is protected.
  </p>
  %s
  <table class="data-table">
    <thead><tr><th style="width:18%%">Connection point</th><th style="width:24%%">Status</th><th>What this means</th></tr></thead>
    <tbody>%s</tbody>
  </table>
  <div class="callout callout-green">
    <strong>Key finding:</strong> Your actual web server (GitHub Pages) is not directly visible from our
    vantage point. All traffic goes through Cloudflare first. An attacker cannot reach your server
    directly &mdash; they face Cloudflare&rsquo;s full protection layer.
  </div>
  %s
</div>
<hr>""" % (header, owner, rows, tech)


def _section_05_tls(d):
    t = d["tls"]
    rows = [
        ("Certificate issued by",  t["issuer"],   "A major, publicly trusted certificate authority."),
        ("Covers",                 t["sans"],      "The main site and all subdomains (e.g. api.titanos.tech)."),
        ("Valid until",            t["valid_until"], "Actively monitored &mdash; auto-renews on a 90-day cycle."),
        ("Encryption strength",    t["cipher"] + " (TLS &mdash; your website&rsquo;s encryption)",
         "The strongest currently available standard. Same level as major banks and government websites."),
        ("Encryption version",     t["protocol"],
         "The current standard. Older, weaker versions are not accepted."),
        ("Browser lock-in (HSTS &mdash; HTTP Strict Transport Security)", "Active &mdash; preload list",
         "Browsers are permanently instructed to use only the secure version. Even if someone tries to redirect "
         "a visitor to an unencrypted connection, it fails. Registered on the global browser preload list."),
    ]
    row_html = "".join(
        "<tr><td><strong>%s</strong></td><td>%s &mdash; <em style='color:#666;font-size:9pt'>%s</em></td></tr>"
        % (label, val, note)
        for label, val, note in rows
    )
    tech_raw = "\n\n".join([t["tech_protocol_raw"], t["tech_dates_raw"], t["tech_hsts_raw"]])
    header = _section_header(
        "05 \u2014 Your website\u2019s encryption (the \u201cpadlock\u201d)",
        "TLS / SSL posture + certificate audit",
        "green",
    )
    owner = _owner_block(
        "When someone visits your website, their connection is as secure as a visit to their online banking. "
        "The certificate is current, issued by a trusted authority (Google Trust Services), and uses the "
        "strongest available encryption. Browsers are locked to the secure version and cannot be tricked "
        "into using an unencrypted connection &mdash; even if an attacker tries to intercept traffic."
    )
    tech = _tech_block(tech_raw)
    return """
<div class="section-block no-break">
  %s
  <p class="section-lead">We verified the security certificate that protects all connections to the website.</p>
  %s
  <table class="data-table">
    <thead><tr><th style="width:32%%">What we checked</th><th>What we found</th></tr></thead>
    <tbody>%s</tbody>
  </table>
  %s
</div>
<hr>""" % (header, owner, row_html, tech)


def _section_06_email(d):
    e = d["email_auth"]
    rows = [
        (
            "SPF (Sender Policy Framework \u2014 who\u2019s allowed to send email from your domain)",
            e["spf"]["status"],
            _e(e["spf"]["record"]),
            "A record that says \u2018only Google\u2019s and Cloudflare\u2019s mail servers are authorised to send email from this domain.\u2019 Anyone else attempting to send from this domain will be rejected. Set to the strictest level.",
        ),
        (
            "DKIM (email signing \u2014 a digital signature on every email you send)",
            e["dkim"]["status"],
            "Selector: %s &middot; Key type: %s" % (_e(e["dkim"]["selector"]), _e(e["dkim"]["key_type"])),
            "A digital signature applied to every outbound email. The recipient\u2019s email provider can verify the signature to confirm the email genuinely came from this domain and wasn\u2019t modified in transit.",
        ),
        (
            "DMARC (the overall fraud policy \u2014 stops scammers sending email pretending to be you)",
            e["dmarc"]["status"],
            "Policy: %s" % _e(e["dmarc"]["policy"]),
            "Tells email providers what to do with emails that fail the checks above. Set to \u2018reject\u2019 &mdash; fake emails are blocked outright, not just flagged. %s." % _e(e["dmarc"]["reporting"]),
        ),
        (
            "CAA record (limits who can issue security certificates for your domain)",
            e["caa"]["status"],
            "Not published",
            "A record that restricts which certificate authorities are allowed to issue a security certificate for this domain. Currently absent &mdash; not a vulnerability, but a best-practice hardening step. See finding F-01.",
        ),
    ]
    row_html = "".join(
        "<tr><td><strong>%s</strong></td><td>%s</td><td><em style='font-size:9pt;color:#555'>%s</em><br>%s</td></tr>"
        % (label, _pill(status), value, meaning)
        for label, status, value, meaning in rows
    )
    header = _section_header(
        "06 \u2014 Email fraud protection",
        "SPF / DKIM / DMARC / CAA email-auth posture",
        "green",
    )
    owner = _owner_block(
        "<strong>Why this matters:</strong> \u201cEmail spoofing\u201d is when an attacker sends an email that "
        "appears to come from your business &mdash; your domain, your branding &mdash; but didn\u2019t. "
        "Common uses: fake invoices sent to your clients in your name, phishing emails to your staff "
        "pretending to be you, supplier fraud. Three technical records (SPF, DKIM, DMARC) block this at "
        "the email provider level. If they\u2019re set correctly, Gmail, Outlook, and most major providers "
        "reject the fake email before it reaches anyone."
    )
    tech = _tech_block(e["tech_raw"])
    return """
<div class="section-block">
  %s
  <p class="section-lead">
    We checked whether the domain is protected against email impersonation &mdash; one of the most
    common techniques used in invoice fraud and phishing attacks on small businesses.
  </p>
  %s
  <table class="data-table">
    <thead><tr><th style="width:35%%">Protection</th><th style="width:12%%">Status</th><th>What it does &amp; what we found</th></tr></thead>
    <tbody>%s</tbody>
  </table>
  <div class="callout callout-green">
    <strong>In plain terms:</strong> The email fraud protection for this domain is at the strongest
    practical configuration. If anyone tries to send a fake email from this address, Gmail, Outlook,
    and most major providers will reject it before it reaches the recipient. A daily failure report
    is also received so any attempts are tracked.
  </div>
  %s
</div>""" % (header, owner, row_html, tech)


def _section_09_split(d):
    header = _section_header(
        "09 \u2014 What you control vs what your provider controls",
        "Responsibility boundary / shared-security model",
        "green",
        page_break=True,
    )
    return """
<div class="section-block no-break">
  %s
  <p class="section-lead">
    One of the most important things a compliance report clarifies: which security settings are
    yours to manage, and which are controlled by your hosting or technology providers.
    This matters because the <em>reasonable steps</em> test under Australian privacy law only
    applies to things you can actually control.
  </p>
  <div class="split">
    <div class="split-col gold">
      <h4>You control</h4>
      <ul>
        <li>Your email security records (SPF, DKIM, DMARC) &mdash; set in your domain&rsquo;s DNS settings</li>
        <li>Your domain registrar account security (lock status, two-factor login)</li>
        <li>The security settings built into your website&rsquo;s code</li>
        <li>Your privacy policy content and the AI disclosure in it</li>
        <li>Who has access to your accounts and when access is removed</li>
        <li>Your data breach response plan</li>
        <li>CAA record &mdash; limiting who can issue your certificates</li>
      </ul>
    </div>
    <div class="split-col slate">
      <h4>Cloudflare + GitHub Pages control</h4>
      <ul>
        <li>The website&rsquo;s encrypted connection (the padlock)</li>
        <li>Protection against large-scale traffic attacks on the server</li>
        <li>Some browser security headers that need to be set at the server level</li>
        <li>Physical infrastructure and server-level hardening</li>
        <li>DDoS (distributed denial-of-service &mdash; large coordinated attack) protection</li>
      </ul>
    </div>
  </div>
  <div class="callout">
    <strong>Why this matters for your compliance:</strong> For any item in the provider column,
    the engagement gives you the exact written request to send to your provider. If they refuse
    or it&rsquo;s not possible to implement, that refusal is documented in your evidence pack as
    <em>reasonable steps taken</em> &mdash; the standard Australian regulators actually assess against.
    You are never left responsible for something outside your control.
  </div>
</div>
<hr>""" % header


def _section_10_findings(d):
    cards = ""
    for f in d["findings"]:
        sev_cls = "chip-amber" if f["status"] == "amber" else "chip-grey"
        tech_inner = _tech_block(f["how_fix_tech"], label="Technical: %s" % f["tech_title"])
        cards += """
  <div class="finding">
    <div class="finding-header">
      <div class="finding-id-title">
        <span class="finding-id">%s</span>
        <span class="finding-title">%s</span>
      </div>
      <div class="finding-chips">
        <span class="finding-chip %s">%s</span>
        <span class="finding-chip chip-effort">&#8987; %s</span>
        <span class="finding-chip chip-who">&#128100; %s</span>
      </div>
    </div>
    <div class="finding-body">
      <div class="finding-row">
        <span class="finding-label">What it means</span>
        <span class="finding-value">%s</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Real-world impact</span>
        <span class="finding-value">%s</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">How it&rsquo;s fixed</span>
        <span class="finding-value">%s</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Technical ref</span>
        <span class="finding-value">%s</span>
      </div>
      <div class="finding-row">
        <span class="finding-label">Status</span>
        <span class="finding-value">%s</span>
      </div>
    </div>
  </div>""" % (
            _e(f["id"]),
            _e(f["plain_title"]),
            sev_cls,
            _e(f["severity_plain"]),
            _e(f["effort"]),
            _e(f["who"]),
            _e(f["what_means"]),
            _e(f["real_world"]),
            _e(f["how_fix_plain"]),
            tech_inner,
            _pill(f["action_status_color"], f["action_status"]),
        )

    header = _section_header(
        "10 \u2014 What needs attention: findings list",
        "Findings \u2014 F-01 through F-05",
        "amber",
    )
    return """
<div class="section-block">
  %s
  <p class="section-lead">
    Five items were logged from this scan. All are low-severity or informational &mdash; no urgent or
    high-risk issues were found. Each card shows what it means, who fixes it, and how much effort
    is involved. The technical detail for your IT person is inside each card.
  </p>
  %s
</div>""" % (header, cards)


def _section_12_verify(d):
    commands = (
        "# Reproduce this report yourself\n"
        "# Run from any internet-connected machine. Compare output to this report.\n\n"
        "# 1. Port scan\n"
        "nmap -sV -p 80,443,8080,8443 titanos.tech\n\n"
        "# 2. TLS protocol + cipher\n"
        "echo | openssl s_client -connect titanos.tech:443 -servername titanos.tech 2>/dev/null \\\n"
        "    | grep -E 'Protocol|Cipher|subject|issuer'\n\n"
        "# 3. Certificate dates\n"
        "echo | openssl s_client -connect titanos.tech:443 2>/dev/null \\\n"
        "    | openssl x509 -noout -dates\n\n"
        "# 4. HTTP security headers\n"
        "curl -sI https://titanos.tech\n\n"
        "# 5. SPF record (email sender policy)\n"
        "python3 -c \"import dns.resolver; [print(r.to_text()) for r in \\\n"
        "    dns.resolver.resolve('titanos.tech','TXT') if 'spf' in r.to_text()]\"\n\n"
        "# 6. DMARC policy\n"
        "python3 -c \"import dns.resolver; [print(r.to_text()) for r in \\\n"
        "    dns.resolver.resolve('_dmarc.titanos.tech','TXT')]\"\n\n"
        "# 7. DKIM key (email signing)\n"
        "python3 -c \"import dns.resolver; [print(r.to_text()[:80]+'...') for r in \\\n"
        "    dns.resolver.resolve('google._domainkey.titanos.tech','TXT')]\"\n\n"
        "# 8. CAA record (certificate authority restriction)\n"
        "python3 -c \"import dns.resolver; [print(r) for r in dns.resolver.resolve('titanos.tech','CAA')]\"\n"
        "# Expected: NXDOMAIN or timeout -- CAA not yet published (see F-01)"
    )
    header = _section_header(
        "12 \u2014 Don\u2019t just take our word for it: how to verify independently",
        "Reproducible methodology / independent verification appendix",
        "green",
        page_break=True,
    )
    owner = _owner_block(
        "<strong>Don\u2019t just take our word for it.</strong> Your IT person can re-run any command below "
        "and get exactly the same result. That\u2019s the point &mdash; every claim in this report is "
        "independently checkable. This is what separates a compliance document that <em>says</em> something "
        "was done from one that <em>proves</em> it.<br><br>"
        "If a regulator, insurer, or enterprise client questions a claim &mdash; \u201cdid you really fix "
        "the email fraud protection?\u201d &mdash; you can point to a command they can run themselves to verify it."
    )
    tech = _tech_block(
        commands,
        label="Reproducible commands \u2014 run any of these to independently verify findings",
    )
    return """
<div class="section-block no-break">
  %s
  <p class="section-lead">
    Every finding in this report is based on publicly accessible information. If you, your IT provider,
    or a prospective client wants to independently verify any claim, the information is available to
    anyone with internet access.
  </p>
  %s
  %s
</div>
<hr>""" % (header, owner, tech)


def _section_13_signoff(d):
    c = d["client"]
    header = _section_header(
        "13 \u2014 How this was produced and our commitment",
        "Attestation / responsible disclosure / sign-off",
        "green",
    )
    return """
<div class="section-block no-break">
  %s
  <p><strong>What we scan:</strong></p>
  <ul>
    <li>Our own infrastructure (this sample report)</li>
    <li>Any domain we are explicitly authorised to scan &mdash; every paying client engagement,
      plus businesses that have requested a free scan via titanos.tech/our-scan</li>
  </ul>
  <p style="margin-top:10px"><strong>What we never do:</strong></p>
  <ul>
    <li>Attempt to log in to anything</li>
    <li>Try to exploit any vulnerability</li>
    <li>Cause any disruption to the business being scanned</li>
    <li>Access private data</li>
  </ul>
  <p style="margin-top:10px">
    <strong>90-day responsible disclosure:</strong> For any significant finding identified during a client
    engagement, we notify the affected business and allow at least 90 days to fix the issue before
    making any public reference to it.
  </p>
  <p style="margin-top:10px">
    <strong>About this sample:</strong> The sections not shown here &mdash;
    your privacy policy review, breach response plan, staff access record, Microsoft 365 / Google Workspace
    hardening evidence, two-factor login proof, backup plan, software update schedule, signed government
    security checklist (Essential Eight &mdash; the Australian Government\u2019s baseline security framework),
    and privacy law compliance letter &mdash; are produced from each client\u2019s own business data during
    the engagement. We don\u2019t fabricate sample versions because a compliance document with invented
    data defeats the purpose.
  </p>
  <div class="signoff">
    <div class="sig-name">%s</div>
    <div style="font-size:9pt;color:#555;margin-bottom:8px">
      ABN %s &nbsp;&middot;&nbsp; titanos.tech &nbsp;&middot;&nbsp; kyle@titanos.tech
    </div>
    <div style="font-size:9pt;color:#555">
      Every finding in this report is personally reviewed before it leaves our hands.
      The technical checks are run by automated tools, but the interpretation, the plain-English
      explanation, and the sign-off are mine. If something in this report is wrong, that\u2019s on
      me &mdash; and I give you the tools to check it yourself so you don\u2019t have to take my word for it.
    </div>
    <div style="margin-top:10px;font-size:8pt;color:#aaa">
      Issued %s. Assessment methodology: titanos.tech/methodology.
    </div>
  </div>
</div>""" % (header, _e(c["prepared_by"]), _e(c["abn"]), _e(c["scan_date"]))


def _glossary():
    terms = [
        ("ABN",           "Australian Business Number \u2014 the unique identifier issued by the ATO to every registered business."),
        ("ADM",           "Automated Decision-Making \u2014 automated processes (including AI) that make or assist decisions about individuals. The updated Privacy Act requires businesses to disclose ADM in their privacy policies."),
        ("CAA",           "Certificate Authority Authorisation \u2014 a DNS record that limits which companies are allowed to issue security certificates (the padlock) for your domain. Prevents unauthorised certificate issuance."),
        ("CSP",           "Content Security Policy \u2014 an instruction sent to browsers that tells them exactly which content (scripts, images, fonts) is allowed to load on your website. Defends against content injection attacks."),
        ("DDoS",          "Distributed Denial of Service \u2014 an attack where large numbers of computers simultaneously flood a website with traffic to make it unavailable. Cloudflare provides DDoS protection."),
        ("DKIM",          "DomainKeys Identified Mail \u2014 a digital signature attached to every outbound email from your domain, allowing recipients to verify the email genuinely came from you and wasn\u2019t altered in transit."),
        ("DMARC",         "Domain-based Message Authentication, Reporting, and Conformance \u2014 an email policy record that tells providers what to do with emails that fail SPF or DKIM checks. \u2018Reject\u2019 policy means fake emails are blocked outright."),
        ("DNS",           "Domain Name System \u2014 the internet\u2019s address book. Translates domain names (like titanos.tech) into IP addresses, and stores records including SPF, DMARC, DKIM, and CAA."),
        ("Essential Eight", "The Australian Government\u2019s baseline cybersecurity framework, published by the ACSC. Eight mitigation strategies that form the recommended minimum standard for all Australian businesses."),
        ("HSTS",          "HTTP Strict Transport Security \u2014 a setting that permanently instructs browsers to only ever use the secure (HTTPS) version of your website, even if a link or redirect attempts to use the unencrypted version."),
        ("NDB",           "Notifiable Data Breaches \u2014 the mandatory scheme under the Privacy Act 1988 (Cth) requiring businesses to notify the OAIC and affected individuals when a data breach is likely to cause serious harm."),
        ("OAIC",          "Office of the Australian Information Commissioner \u2014 the federal regulator responsible for privacy and freedom of information. Oversees the Privacy Act and NDB scheme."),
        ("SPF",           "Sender Policy Framework \u2014 a DNS record that publishes which mail servers are authorised to send email from your domain. Prevents others from sending email that appears to come from you."),
        ("TLS",           "Transport Layer Security \u2014 the encryption standard that creates the secure connection between a website and its visitors (what you see as the padlock in your browser). TLS 1.3 is the current strongest version."),
    ]
    rows = "".join(
        '<div class="glossary-entry"><div class="glossary-term">%s</div><div class="glossary-plain">%s</div></div>'
        % (_e(term), _e(defn))
        for term, defn in terms
    )
    return """
<div class="page-break"></div>
<div class="section-block">
  <div class="section-title-row">
    <div class="section-title-left">
      <div class="section-title-plain">Plain-English glossary</div>
      <div class="section-title-tech">All acronyms used in this report, defined in plain language</div>
    </div>
  </div>
  <p class="section-lead" style="margin-top:8px">
    Every acronym in this report is defined here. On first use in the main body, each acronym is also
    explained inline &mdash; you never have to guess what something means.
  </p>
  %s
</div>""" % rows


# ── Main ─────────────────────────────────────────────────────────────────────

def build_html(data, mode="sample"):
    sections = "\n".join([
        _cover(data),
        _scorecard(data),
        _section_01_summary(data),
        _section_02_method(data),
        _section_04_ports(data),
        _section_05_tls(data),
        _section_06_email(data),
        _section_09_split(data),
        _section_10_findings(data),
        _section_12_verify(data),
        _section_13_signoff(data),
        _glossary(),
    ])

    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Security &amp; Compliance Evidence Pack &mdash; %s</title>
<style>
%s
</style>
</head>
<body>
%s
</body>
</html>""" % (_e(data["client"]["domain"]), CSS, sections)
