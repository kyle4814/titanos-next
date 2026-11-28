# 06. GitHub publication plan for the free tools (PLAN ONLY: nothing is published)

Publishing a repo is public and effectively irreversible (GATE4 and GATE5). Kyle approves each repo by name; account creation is also his. Org or user: the GitHub account kyle4814 already holds titanos-next (private); recommend a new org "titanos-tech" only if Kyle wants it (creating it is an account action, not done here). Licence default: MIT for code (OSI approved, https://opensource.org/license/mit [V]); CC BY 4.0 for data and text (https://creativecommons.org/licenses/by/4.0/ [V]). Copyright holder line: "Kyle Deligny (Titanos)". Check with the repo owner that no client data, keys or internal paths are in history: publish from a fresh `git init` of a clean export, never a fork of the private repo.

## Pre-publication gate for every repo (all must be ticked)
1. Fresh export with no private history; secrets scan (gitleaks) clean; no client domain names, no internal hostnames, no ~/.titanos_env references.
2. Tests pass from a clean clone; README states what it checks, what it does not, and that it is passive.
3. Passive-only: public DNS records via DNS-over-HTTPS; no probing of third-party servers (DEL1).
4. Licence file, SECURITY.md (contact route), no analytics, no phone-home.
5. README links to the matching free tool and /shop product with one plain sentence each; no marketing claims; "not legal advice" where legal-adjacent.
6. Kyle taps approve on the card for that repo.

## Repos
| # | Repo name | What it is | Source in our code | Licence | Status / blocker |
|---|---|---|---|---|---|
| 1 | titanos-spoofguard | Passive SPF, DKIM and DMARC checker (TypeScript, zero dependencies, runs in browser or Node) | lib/guestscan/scan.ts and spfnest.ts, meter.ts (port of the SpoofGuard checks; fixtures in lib/guestscan/fixtures.ts) | MIT | READY after export; the Python halo_spoofguard.py is NOT included (it holds HaloPSA integration and internal imports) |
| 2 | essential-eight-self-assessment | Ten-question self-score data as JSON and CSV, with ASD source per control | the logic in the Essential Eight tool lane (branch seo/tool-e8, unmerged) | CC BY 4.0 data, MIT code | WAIT: the tool branch must merge first; paid workbook stays on /shop, not in the repo |
| 3 | privacy-act-small-business-checker | The coverage decision flow (exemption and its exceptions) as plain JSON plus a tiny runner | app/tools/privacy-act-checker/logic.ts (branch seo/tool-privacy-2026-11-28) | MIT | WAIT: lawyer glance recommended; disclaimer in README |
| 4 | privacy-policy-adm-clauses-au | Plain-English clause snippets for the 10 December 2026 automated-decision line | to be written from the guide on titanos.tech | CC BY 4.0 | HOLD: legal accuracy risk; Kyle decides whether a lawyer reads it first (GATE3 flavour) |
| 5 | anz-smb-email-security-study | Method note, per-band table, verification script (verify_study.py), no domain-level data | docs/seo/pr/verify_study.py and the corrected tables | CC BY 4.0 text, MIT script | WAIT: pooled figure on the blog is corrected first; domain-level files stay private |
| 6 | missed-call-cost-calculator | The calculator logic (user supplies own numbers) | app/tools/missed-call-calculator/calc.ts (branch seo/tool-missedcall-2026-11-28) | MIT | READY after export; inputs only, no invented defaults |

## README skeleton (each repo)
Title; one-sentence purpose; "What it checks / what it does not"; install and run in three commands; example output (with a documentation-reserved domain such as example.com, https://www.rfc-editor.org/rfc/rfc2606 [V]); method and sources linked; limits; licence; "Built by Titanos, Brisbane. Free web version: https://titanos.tech/tools/<name>"; contributing note (issues welcome, no promises on timing).
Topics (GitHub repository topics, max 20): dmarc, spf, dkim, email-security, australia, small-business, essential-eight, privacy-act. Add only those that are true for the repo.

## After publication (each needs its own approval; pacing 5 link actions a week)
Submit only where the list's rules fit: awesome-lists (open a PR only if the criteria match), Show HN with an honest title (BACKLINKS item 21), dev.to post with canonical to titanos.tech (item 51), npm or PyPI CLI package (item 50). Track GitHub referrals in Search Console links report; kill test: fewer than 3 referring domains from GitHub-related actions after 8 weeks means stop spending time here.

## Sources
GitHub licensing docs https://docs.github.com/en/repositories/managing-your-repository-settings-and-features/customizing-your-repository/licensing-a-repository [V]; topics https://docs.github.com/en/repositories/managing-your-repository-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics [V]; RFC 9116 and RFC 7489 as in 01. SEO plan: BACKLINKS.md items 46 to 52 and PLAN_90D weeks 7 and 10.
