import type { Guide } from "@/lib/guides";

export const emailSecurity: Guide = {
  slug: "email-security-small-business-australia",
  seoTitle: "Email Security for Small Business: DMARC Guide",
  h1: "Email Security for Small Business: SPF, DKIM, DMARC and Invoice Scams",
  description:
    "How to stop someone sending fake email as your business: SPF, DKIM and DMARC step by step, plus how to stop bank-detail and invoice scams in Australia.",
  cluster: "Email security",
  targetTerms: ["dmarc small business australia", "spf dkim dmarc explained", "can someone send email pretending to be my business", "business email compromise australia"],
  date: "2026-11-28",
  updated: "2026-11-28",
  intro: [
    {
      t: "p",
      x: "Email was designed in an era when nobody checked who a message was really from. Anyone can type your business name into the \"From\" line of a message, and unless your domain has the right records, the receiving mail server has no rule telling it to reject the fake. That gap is behind the invoice scams, bank-detail swaps and fake quotes that cost Australian businesses real money every week.",
    },
    {
      t: "p",
      x: "This guide explains the three DNS records that close the gap, **SPF, DKIM and DMARC**, in plain language. It gives a rollout plan that keeps your real mail flowing, covers the mistakes that break delivery, and then moves to the human side: how to stop a scammer talking you or your customers into paying the wrong account. You do not need to be technical to follow it, and you can check most of it for free.",
    },
    {
      t: "note",
      title: "What we measured",
      x: "In our own sample of small-business domains across eight bands of the Australian .com.au namespace, 47.5% (172 of 362 with both checks confirmed) had no enforced DMARC policy and no published security.txt file. It is a conservative snapshot from independent DNS lookups, not a census. Method and limits are in [the full report](/blog/anz-smb-email-security-double-gap-measured).",
    },
  ],
  sections: [
    {
      id: "how-spoofing-works",
      h2: "How someone sends email as your business",
      blocks: [
        { t: "p", x: "There are two different attacks, and the fixes differ." },
        {
          t: "ol",
          x: [
            "**Spoofing your exact domain.** A scammer sends a message that shows your address, for example accounts@yourbusiness.com.au, from their own server. If your domain does not publish and enforce authentication rules, many receiving systems will deliver it.",
            "**Lookalike domains and compromised accounts.** The scammer registers yourbusiness-accounts.com.au, or breaks into your real mailbox, or a customer's, and sends from there. DMARC does not stop lookalikes. Passwords, MFA and verification habits do.",
          ],
        },
        { t: "p", x: "Our post [Can someone send email pretending to be my business?](/blog/can-someone-send-email-pretending-to-be-my-business) answers the first question in plain words. The three records below are the fix for it." },
      ],
    },
    {
      id: "spf-dkim-dmarc",
      h2: "SPF, DKIM and DMARC in plain language",
      blocks: [
        {
          t: "table",
          caption: "The three records",
          head: ["Record", "Question it answers", "Where it lives", "Analogy"],
          rows: [
            ["SPF (RFC 7208)", "Is this server allowed to send mail for this domain?", "One TXT record on your domain", "A list of the couriers you have authorised."],
            ["DKIM (RFC 6376)", "Was this message signed by the domain, and has it been changed on the way?", "A public key in DNS, a signature in each message", "A tamper-evident seal."],
            ["DMARC (RFC 7489)", "What should a receiver do when SPF and DKIM fail to line up with the From address, and who should be told?", "One TXT record at _dmarc.yourdomain", "The instruction on the envelope: if the seal is broken, bin it and tell me."],
          ],
        },
        { t: "p", x: "SPF and DKIM on their own only produce a pass or fail. **DMARC is what ties them to the visible From address and tells receivers what to do with failures.** Without DMARC at an enforcing policy, a failure is usually just noted and the message is still delivered." },
        { t: "h3", x: "The DMARC policy ladder" },
        {
          t: "table",
          caption: "DMARC policies",
          head: ["Policy", "What receivers do with failing mail", "When to use it"],
          rows: [
            ["p=none", "Deliver it, but send you reports.", "Start here. It is monitoring only and does not protect you yet."],
            ["p=quarantine", "Treat it as suspicious, typically the spam folder.", "Once reports show your real senders pass."],
            ["p=reject", "Refuse delivery.", "The goal. This is what stops fake mail using your exact domain."],
          ],
        },
        { t: "p", x: "Many domains that have a DMARC record are still stuck at p=none, which is why in our sample we counted monitor-only as a gap. A record that never moves past monitoring is a record that protects nobody." },
      ],
    },
    {
      id: "free-check",
      h2: "Check your domain in two minutes, free",
      blocks: [
        { t: "p", x: "You can see what the world sees about your domain without logging in to anything. All of these checks use public DNS." },
        {
          t: "ol",
          x: [
            "Run our [free security scan](/scan). It reads your domain's public SPF, DKIM and DMARC settings, explains the result in plain words and does nothing to your systems.",
            "Or ask a DNS lookup tool for the TXT records on your domain and on _dmarc.yourdomain. A line starting v=spf1 is SPF. A line starting v=DMARC1 is DMARC.",
            "Send an email from your business address to a personal Gmail account, open the message, choose Show original, and look for SPF, DKIM and DMARC lines saying PASS.",
          ],
        },
        { t: "p", x: "If there is no DMARC record at all, or p=none, you have the gap. A paid [instant email domain check](/offers/instant-email-domain-check) gives a one-page written report with the exact fixes, and the [spoofing self-check checklist](/products/spoofguard-self-check-checklist) teaches you to run the checks yourself." },
      ],
    },
    {
      id: "rollout",
      h2: "A safe rollout, in order",
      blocks: [
        { t: "p", x: "The trap with DMARC is turning on enforcement before you know every system that sends mail for you. Your invoicing software, newsletter tool, job management app, website contact form and your accountant may all send as your domain. If one fails authentication and you jump straight to p=reject, those messages vanish." },
        { t: "h3", x: "Step 1: list everything that sends as you" },
        { t: "p", x: "Write down each: your mail platform (Microsoft 365, Google Workspace or a host's mail), accounting package, job management software, email marketing tool, website forms, CRM, helpdesk and any AI tools that email customers. Ask each vendor for their \"authentication\" or \"SPF and DKIM\" setup instructions." },
        { t: "h3", x: "Step 2: publish SPF" },
        { t: "p", x: "One SPF record per domain, listing the services that may send for you, ending in a policy such as ~all (soft fail) or -all (hard fail). Common mistakes: two SPF records (invalid, and receivers may ignore both), and exceeding the limit of 10 DNS lookups in the SPF evaluation, which makes SPF fail for everything." },
        { t: "h3", x: "Step 3: turn on DKIM for every sender" },
        { t: "p", x: "Your mail platform and each third-party sender provide a key to publish in DNS. Enable signing in each product and confirm it works by sending yourself a test and reading the headers." },
        { t: "h3", x: "Step 4: publish DMARC at p=none with reporting" },
        { t: "p", x: "A starting record looks like: v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain. The rua address receives daily summary reports. Raw reports are hard to read, and a free reporting service can summarise them. Leave it for two to four weeks." },
        { t: "h3", x: "Step 5: fix what the reports show" },
        { t: "p", x: "Reports will list sending sources. Match each to a legitimate sender you know about. Fix SPF or DKIM for anything legitimate that fails. Sources you do not recognise are the attackers or forgotten tools." },
        { t: "h3", x: "Step 6: move to quarantine, then reject" },
        { t: "p", x: "Go to p=quarantine, optionally with pct=25 first so only a quarter of failing mail is affected, and watch for complaints. After a few clean weeks go to p=reject. Keep reading reports each month, because a new tool added next year can break mail again." },
        {
          t: "note",
          title: "Do not skip the order",
          x: "The most common DMARC disaster is a business that set p=reject on day one and then wondered why invoices stopped arriving. Monitor first, enforce later.",
        },
        { t: "p", x: "Our [DMARC and SPF setup guide](/products/dmarc-setup-guide) walks through each step with checklists for the common mail providers. Registrar-specific screens vary, so the same steps appear in different menus at GoDaddy, Crazy Domains, VentraIP, Netregistry or Cloudflare." },
      ],
    },
    {
      id: "why-it-matters-now",
      h2: "Why large mailbox providers raised the bar",
      blocks: [
        { t: "p", x: "From February 2024, Google requires senders of more than 5,000 messages a day to Gmail addresses to have SPF, DKIM and DMARC in place, with one-click unsubscribe for marketing mail. Yahoo introduced matching rules, and Microsoft has announced similar requirements for high-volume senders to its consumer mail services. Most small businesses send far below that volume, but the direction is clear: unauthenticated mail is treated with growing suspicion, and a missing DMARC record can mean your genuine invoices drift to junk." },
        { t: "p", x: "Google's [email sender guidelines](https://support.google.com/a/answer/81126) set out the current requirements and are written for administrators who are not email specialists." },
      ],
    },
    {
      id: "invoice-scams",
      h2: "Invoice and bank-detail scams: the human controls",
      blocks: [
        { t: "p", x: "DMARC stops forgery of your exact domain. The other half of the risk is a scammer who has got into someone's mailbox, yours, your customer's or your accountant's, or who sends from a lookalike domain. These are called business email compromise, and the typical forms are:" },
        {
          t: "ul",
          x: [
            "**The changed bank details.** A genuine invoice is intercepted or copied and the account number is changed. See [the invoice scam hitting Australian trade businesses](/blog/invoice-scam-tradies).",
            "**The settlement day email.** A message to a home buyer, apparently from their conveyancer, with new bank details. See [Settlement is Friday](/blog/settlement-day-scam-property-and-conveyancing).",
            "**The \"we've changed banks\" email to a bookkeeper or accountant.** Covered in [this post for accountants and bookkeepers](/blog/the-bank-details-email-accountants-and-bookkeepers).",
            "**The urgent request from the boss.** A fake message from a director asking a staff member to pay a supplier immediately.",
          ],
        },
        { t: "h3", x: "Seven habits that stop most of it" },
        {
          t: "ol",
          x: [
            "**Verify any change to bank details by phone,** using a number you already hold, never one in the email. No exceptions, including for people you know.",
            "**Print your bank details on every invoice and publish a notice,** such as \"We will never change our bank details by email. If you receive an email saying otherwise, ring us.\"",
            "**Turn on multi-factor authentication** for email and accounting. Most compromised mailboxes had only a password.",
            "**Check for forwarding rules.** Attackers often add a hidden rule that copies your mail to them. Review rules and delegated access monthly.",
            "**Watch the sender address, not the display name.** On a phone, tap the name to see the actual address. Look for one letter changed.",
            "**Slow down on urgency.** Pressure to pay today is a signature of the scam.",
            "**Report quickly.** If you pay the wrong account, ring your bank immediately and report to the police through ReportCyber and to Scamwatch. Speed matters.",
          ],
        },
        { t: "p", x: "The Australian Competition and Consumer Commission's [Scamwatch](https://www.scamwatch.gov.au) publishes current warnings and the [ReportCyber](https://www.cyber.gov.au/report-and-recover/report) service at the ACSC takes reports of cybercrime." },
      ],
    },
    {
      id: "beyond-dmarc",
      h2: "Beyond DMARC: the small extras worth doing",
      blocks: [
        {
          t: "ul",
          x: [
            "**security.txt.** A short file at /.well-known/security.txt that tells researchers how to report a problem with your site. It is standardised as RFC 9116 and takes minutes to publish. Its absence is one of the two gaps we counted in our sample.",
            "**Domain lock and registrar MFA.** If an attacker takes over your domain, they control email. Use a strong password and MFA at the registrar and enable the registrar lock.",
            "**Domain expiry.** Set auto-renew on and a reminder. A lapsed domain can be re-registered by someone else.",
            "**Defensive lookalike domains.** For some businesses, registering the obvious variants helps, though it rarely justifies a large spend.",
            "**Staff training.** A short session on the habits above beats any technology on its own.",
          ],
        },
        { t: "p", x: "Email security also sits inside the wider [Essential Eight](/guides/essential-eight-small-business): MFA, patching and backups. And if a mailbox is breached and customer information is exposed, the [Privacy Act breach rules](/guides/privacy-act-small-business-australia) may apply." },
      ],
    },
    {
      id: "monitoring",
      h2: "Keeping it working",
      blocks: [
        { t: "p", x: "Email authentication is not a one-off. Records drift: someone adds a new tool, a vendor changes its servers, a domain is renewed late. Three simple routines keep it healthy." },
        {
          t: "ol",
          x: [
            "Read your DMARC summary reports each month, even for ten minutes.",
            "Re-run the free scan each quarter, and any time you add or remove a service that sends email.",
            "Keep a one-page note of which services send as you and who owns each.",
          ],
        },
        { t: "p", x: "If you would rather not remember, the [Compliance Monitor](/monitor) checks external posture on a schedule, and the [Scam Shield for Tradies](/offers/scam-shield-for-tradies) offer checks every month whether someone could fake an email from your business and gives you a notice customers can trust." },
      ],
    },
  ],
  faq: [
    {
      q: "Can someone send an email that looks like it came from my business?",
      a: "Yes, if your domain does not publish and enforce DMARC. The fake message can show your address in the From line and be delivered to your customers. A DMARC record at p=quarantine or p=reject, with SPF and DKIM set up, stops this for your exact domain. It does not stop lookalike domains or a hacked mailbox.",
    },
    {
      q: "What is the difference between SPF, DKIM and DMARC?",
      a: "SPF lists the servers allowed to send for your domain. DKIM adds a cryptographic signature that proves a message came from your domain and was not altered. DMARC links both to the visible From address and tells receivers whether to deliver, quarantine or reject failures, and who to report to.",
    },
    {
      q: "Is a DMARC record enough?",
      a: "Only if its policy is quarantine or reject. A record at p=none only monitors. Even at reject it covers forgery of your exact domain, not hacked accounts or lookalike addresses, so you also need MFA and a rule that bank detail changes are confirmed by phone.",
    },
    {
      q: "Will turning on DMARC break my email?",
      a: "It can if you jump to enforcement before every sender passes authentication. Start at p=none with reports, fix any legitimate sender that fails, then move to quarantine and reject over several weeks. That order keeps your real mail flowing.",
    },
    {
      q: "What should I do if a customer paid a scammer's bank account?",
      a: "Ring your bank, and your customer's bank, immediately and ask for a recall. Report to ReportCyber and Scamwatch, change passwords and check for forwarding rules on the mailbox, and consider whether the incident is a notifiable data breach if personal information was exposed.",
    },
    {
      q: "How much does email security cost for a small business?",
      a: "The records themselves are free: SPF, DKIM and DMARC are DNS entries you or your IT provider add, and many mail platforms include DKIM. Some reporting services charge for dashboards, and an adviser may charge for setup time. A self-check costs nothing with our free scan.",
    },
  ],
  sources: [
    { label: "RFC 7489: Domain-based Message Authentication, Reporting and Conformance (DMARC)", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "The DMARC specification" },
    { label: "RFC 7208: Sender Policy Framework (SPF)", url: "https://datatracker.ietf.org/doc/html/rfc7208", note: "Including the limit of 10 DNS lookups" },
    { label: "RFC 6376: DomainKeys Identified Mail (DKIM) Signatures", url: "https://datatracker.ietf.org/doc/html/rfc6376", note: "The DKIM specification" },
    { label: "RFC 9116: A File Format to Aid in Security Vulnerability Disclosure", url: "https://datatracker.ietf.org/doc/html/rfc9116", note: "security.txt" },
    { label: "Google: Email sender guidelines", url: "https://support.google.com/a/answer/81126", note: "Requirements for bulk senders from February 2024" },
    { label: "Scamwatch (ACCC)", url: "https://www.scamwatch.gov.au", note: "Current scams and how to report them" },
    { label: "ACSC: Report and recover", url: "https://www.cyber.gov.au/report-and-recover/report", note: "ReportCyber, the national cybercrime reporting service" },
    { label: "Titanos: ANZ small-business email security, measured", url: "https://titanos.tech/blog/anz-smb-email-security-double-gap-measured", note: "Our own sampling method, results and limitations" },
  ],
  related: {
    posts: ["can-someone-send-email-pretending-to-be-my-business", "invoice-scam-tradies", "anz-smb-email-security-double-gap-measured", "the-bank-details-email-accountants-and-bookkeepers", "settlement-day-scam-property-and-conveyancing"],
    tools: [
      { label: "Free security scan", href: "/scan", blurb: "Reads your public SPF, DKIM and DMARC settings and explains them." },
      { label: "Instant Email Domain Check", href: "/offers/instant-email-domain-check", blurb: "A one-page written report on whether scammers can send as you, with exact fixes." },
      { label: "Scam Shield for Tradies", href: "/offers/scam-shield-for-tradies", blurb: "Monthly check, fix list and a notice customers can trust." },
      { label: "Compliance Monitor", href: "/monitor", blurb: "Scheduled external checks so records do not drift." },
    ],
    products: [
      { label: "DMARC and SPF Setup Guide", href: "/products/dmarc-setup-guide", blurb: "Step-by-step DNS changes in a safe rollout order." },
      { label: "Email Spoofing Self-Check Checklist", href: "/products/spoofguard-self-check-checklist", blurb: "Ten checks using public records only." },
      { label: "Course: Email Security for Owners", href: "/products/course-email-security-for-owners", blurb: "A short course for non-technical owners." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Run the free security scan",
    href: "/scan",
    text: "Find out in a couple of minutes whether someone could send email as your business. The scan uses public DNS records only, touches nothing of yours and explains each result in plain words.",
  },
};
