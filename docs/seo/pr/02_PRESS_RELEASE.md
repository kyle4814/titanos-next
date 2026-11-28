# 02. Press release (DRAFT, not issued)

Hold until: Kyle approves, the L10 gate flips, and the blog's pooled figure is corrected (see 01). Embargo: none. AI disclosure: drafted with Claude from the study sources; Kyle reviews before release.

---
**FOR IMMEDIATE RELEASE** [date to be set on release]

## About half of small-business websites in Australia have no enforced email protection, a passive DNS sample finds

**Brisbane, QLD.** A passive measurement of 318 small-business .com.au domains found that about 48 per cent had no enforced DMARC email policy and no security.txt file. Rates across eight sampling bands ranged from 37.5 to 55.0 per cent.

DMARC is the standard that tells receiving mail servers what to do with email that claims to come from a domain but fails authentication. A policy of "none" only monitors. Without an enforced policy ("quarantine" or "reject"), mail that imitates the business can still be delivered. A security.txt file (RFC 9116) is the published place where a researcher can report a security problem.

"This is a measurement of a public gap, not a list of targets," said Kyle Deligny, founder of Titanos, a solo Brisbane practice that helps small businesses with AI automation and email security. "Every check was a public DNS lookup or a request for a file that is meant to be public. We contacted nobody, and no business is named."

**What was measured.** Domains came from the Tranco top-one-million ranking (ranks 200,000 to 1,000,000), filtered to .com.au and cleaned of brands, franchises, government, media and hosting companies, then read by eye. DMARC was checked against two public resolvers; security.txt by one request. Where a check timed out or was blocked, the domain was recorded as unknown and excluded, so the figures are a floor.

**Other markets.** The same method on New Zealand (.co.nz), Singapore (.com.sg and .sg) and Canada (.ca) gave rates in a similar range for the double gap, with larger unknown shares. Details and the per-batch counts are in the methodology.

**Limits.** Popularity is not a census of businesses. The result is one snapshot from late September to early October 2026, drawn at even spacing, not at random. It is not split by industry. It says nothing about whether any business has been attacked.

**What a business can do.** Check the domain for free with a public DNS tool, move any DMARC "none" policy to "quarantine" after reviewing the reports, and keep the IT provider in charge of changes. Titanos offers a free passive check at https://titanos.tech/scan; the method and counts are public at https://titanos.tech/blog/anz-smb-email-security-double-gap-measured.

**Background sources.** Tranco ranking https://tranco-list.eu/ ; RFC 7489 (DMARC) ; RFC 9116 (security.txt) ; ACSC Small Business Cyber Security Guide https://www.cyber.gov.au/sites/default/files/2023-07/acsc_small_business_cyber_security_guide.pdf

**About Titanos.** Titanos is a sole-trader practice in Brisbane (ABN 34 318 502 254) helping Australian small businesses with practical AI automation, Privacy Act compliance and external email-security checks, using public records only. https://titanos.tech

**Media contact.** Kyle Deligny, [KYLE_EMAIL: business address from /contact], [phone: Kyle to supply]. Method notes, the per-band table and a chart are available on request; the domain-level data is not shared.
---
Claims check: 48 per cent = 153/318 (verify_study.py); range 37.5 to 55.0 = bands 500k-600k and 600k-700k; "similar range" for NZ/SG and larger unknown shares = Q44/Q46/Q49/Q50/Q54 (NZ batch 1 had 40% UNKNOWN, Canada 48.1%). "Floor" = conservative exclusion of UNKNOWN. No dollar, victim or attack claim is made.
