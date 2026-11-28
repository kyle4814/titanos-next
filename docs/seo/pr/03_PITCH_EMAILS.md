# 03. Six tailored pitch emails (DRAFTS, nothing sent)

Rules: send only after Kyle's approval card per email (GATE4) and after the L10 gate flips; one outlet at a time, hand-sent, never a mass send; never the same text twice. Editor names and tip addresses are NOT filled in because I have not verified them: take the contact from each outlet's own contact or tips page. Sign-off address placeholder is [KYLE_EMAIL] (the business address on /contact). Every figure is from 01_STUDY_VERIFICATION.md (153 of 318 = 48.1%). Offer: the method note, per-band table and a chart; domain-level data is not shared. Subject lines are 60 characters or fewer. No attachments on first contact.

## 1. SecurityBrief Australia (https://securitybrief.com.au), security trade audience
Subject: Passive DNS sample: about 48% of small .com.au sites lack DMARC

Hi [editor, confirm from site],

I run Titanos, a one-person practice in Brisbane. On 30 September and 1 October 2026 I ran a passive check of 318 small-business .com.au domains (Tranco ranks 200,000 to 1,000,000, brands and government removed, read by eye). About 48 per cent had no enforced DMARC policy (no record, or p=none) and no security.txt file. The eight sampling bands ran from 37.5 to 55.0 per cent.

Two details your readers may care about. Unknown results (timeouts, bot challenges) are excluded, so the figure is a floor. And two instrument effects are disclosed: Shopify storefront timeouts in one band, and a denylist bug I fixed mid-run in another.

The sample is not a census and not split by industry. NZ, Singapore and Canada runs with the same method are in the methodology: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured

Would it be useful to send the band table and a chart? No domain is named, and I am glad for you to challenge the method.

Kyle Deligny, Titanos (ABN 34 318 502 254), [KYLE_EMAIL]

## 2. SmartCompany (https://www.smartcompany.com.au), small business owners
Subject: Small business email spoofing gap, measured: about half

Hi [editor, confirm],

A measurement that may suit a small-business reader: in a passive sample of 318 small .com.au websites, about 48 per cent had no enforced DMARC email policy, which means mail imitating the business is not told to be rejected. Setting one is free at most mail providers; this is not a product pitch.

What it is and is not: public DNS lookups only, nothing contacted, no business named. It is a snapshot from 30 September and 1 October 2026, and a floor because unknown results were excluded.

There is a time hook. From 10 December 2026 the Privacy Act's new automated-decision transparency requirement starts (Privacy and Other Legislation Amendment Act 2024, legislation.gov.au C2024A00128), so owners will be reading about privacy that month; the email gap is the cheapest item on the list to fix.

I can write 600 words for an owner audience, or answer questions for yours. Method: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured

Kyle Deligny, Titanos, Brisbane, [KYLE_EMAIL]

## 3. Startup Daily (https://www.startupdaily.net), founders
Subject: Solo founder measured email security gaps across 318 sites

Hi [editor, confirm],

I am a solo founder in Brisbane building AI automation for small businesses, and I have published the data behind a first measurement rather than a pitch deck: about 48 per cent of 318 sampled small .com.au domains had no enforced DMARC policy and no security.txt file (30 September and 1 October 2026; 37.5 to 55.0 per cent across eight bands).

The story for founders is the practice as much as the number: the sample is cleaned with a public denylist, every unknown is excluded, two errors in my own tooling are disclosed in the post, and the same method was repeated for New Zealand, Singapore and Canada. I also found that my first published pooled count did not reconcile with the band tables and corrected it, which I am happy to discuss.

Nothing is sold in the study and no company is named: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured

Would a short founder Q&A be of interest?

Kyle Deligny, [KYLE_EMAIL]

## 4. iTnews (https://www.itnews.com.au), IT professionals and MSPs
Subject: Method note: 318 .com.au SMB domains, DMARC and security.txt

Hi [editor, confirm],

Method first, since your readers will ask. Seed: Tranco top-1M, .com.au, ranks 200,000 to 1,000,000 in eight bands; denylist of up to 1,163 terms (brands, government, media, hosting, registrars) plus a by-eye pass; evenly spaced sample of 37 to 43 live domains per band, 318 in all. DMARC: TXT at _dmarc.<domain> read from dns.google and cloudflare-dns.com; gap means absent or p=none. security.txt: one honest-User-Agent GET of /.well-known/security.txt (RFC 9116), absent only on a real 404 or a confirmed catch-all redirect.

Result: 153 of 318 (48.1 per cent) had both gaps; bands ran 37.5 to 55.0 per cent. UNKNOWN (timeouts, WAF challenges, soft 200s) is excluded, so it is a floor.

Caveats: popularity is not a census; one snapshot (30 September to 1 October 2026); sampling is evenly spaced rather than random. I would value your scrutiny. Write-up: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured

Kyle Deligny, Titanos, [KYLE_EMAIL]

## 5. CRN Australia (https://www.crn.com.au), channel and MSP partners
Subject: For MSPs: about 48% of small .com.au domains lack DMARC

Hi [editor, confirm],

Your readers manage many small-business domains. In a passive sample of 318 small .com.au domains taken on 30 September and 1 October 2026, about 48 per cent had no enforced DMARC policy and no security.txt file; bands ranged from 37.5 to 55.0 per cent.

The practical angle for partners is a repeatable, low-risk service line: moving a domain from p=none to quarantine after reading the reports, with the client's IT provider staying in charge. The sample does not show how many of these domains an MSP already manages, and I make no claim about it.

Public DNS only, nothing contacted, no business named, unknowns excluded. Method and limits: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured

Can I send the table and a one-page checklist partners could reuse?

Kyle Deligny, Titanos, [KYLE_EMAIL]

## 6. Trades publication (pick one after reading its contributor page; candidates Master Builders Queensland member magazine, Master Plumbers Queensland, NECA's Electrical Connection; none verified)
Subject: Invoice-redirect scams and the email setting that limits them

Hi [editor, confirm],

Trade businesses are a common target for "our bank details have changed" emails. The ACSC's Small Business Cyber Security Guide covers email scams; what I can add is a measurement: in a passive sample of 318 small .com.au websites, about 48 per cent had no enforced DMARC policy, so mail imitating their domain is not told to be rejected. The sample is not split by trade, so I cannot say what the figure is for builders or plumbers, and I will not guess.

I can write 500 words for your members: what DMARC is, a five-minute check, the phone-call rule for changed bank details, and what to ask the IT person. DMARC does not stop a lookalike domain, and the piece says so.

Sources: https://titanos.tech/blog/anz-smb-email-security-double-gap-measured ; ACSC guide https://www.cyber.gov.au/sites/default/files/2023-07/acsc_small_business_cyber_security_guide.pdf

Kyle Deligny, Titanos, Brisbane, [KYLE_EMAIL]
