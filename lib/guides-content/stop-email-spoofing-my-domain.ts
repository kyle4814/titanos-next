import type { Guide } from "@/lib/guides";

export const stopEmailSpoofing: Guide = {
  slug: "stop-email-spoofing-my-domain",
  seoTitle: "Stop Email Spoofing of Your Domain: Plain Guide",
  h1: "How to Stop Email Spoofing of Your Domain: A Plain Guide for Small Business",
  description:
    "How to stop someone sending email as your business domain: check your SPF, DKIM and DMARC records, fix them in a safe order and cover what DMARC cannot stop.",
  cluster: "Stop spoofing",
  targetTerms: ["stop email spoofing my domain", "how to stop someone spoofing my email address", "someone is sending emails from my domain", "prevent email spoofing small business australia"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "If a customer tells you they received an email that looked like it came from your business, and you did not send it, you are looking at email spoofing. Someone has typed your domain into the From line of a message. Email was designed in an era when nobody checked that line, so by default anyone can do this, from anywhere, without touching your accounts.",
    },
    {
      t: "p",
      x: "The good news is that for the exact domain you own, spoofing is a solvable problem. Three DNS records, SPF, DKIM and DMARC, let receiving mail systems check whether a message really came from you and decide what to do when it did not. This guide explains how to find out where you stand, how to fix it in an order that does not break your own email, and what those records cannot stop, so you know where the remaining risk sits.",
    },
    {
      t: "note",
      title: "The short version",
      x: "Publish SPF and DKIM for every service that sends as you, publish DMARC at p=none with a reporting address, read the reports, then move to p=quarantine and finally p=reject. Add multi-factor authentication on your mailboxes and a phone call rule for bank detail changes. Start with the [free email spoofing check](/tools/email-spoofing-check) to see your current records.",
    },
  ],
  sections: [
    {
      id: "what-spoofing-is",
      h2: "What email spoofing actually is",
      blocks: [
        { t: "p", x: "An email carries two sender addresses. The envelope sender is used between mail servers and is mostly invisible. The From header is what your customer sees in their inbox. Spoofing means forging the From header so it shows your domain. The sender needs no password for your mailbox and no access to your systems, which is why the attack is so cheap." },
        { t: "p", x: "It helps to separate spoofing from three other things that get confused with it." },
        {
          t: "ul",
          x: [
            "**Spoofing of your exact domain.** The From address is name@yourbusiness.com.au but the message never passed through your mail system. SPF, DKIM and DMARC address this.",
            "**Lookalike domains.** The From address is name@yourbusines.com.au or name@your-business.com.au. This is a different domain that the attacker owns, so it passes its own authentication. DMARC on your domain does not touch it.",
            "**Account takeover.** A real mailbox of yours was accessed with a stolen password and the attacker is sending genuine mail from it. Authentication records cannot tell this from your normal mail. Multi-factor authentication addresses this.",
            "**Display name tricks.** The visible name says your business but the address behind it is something unrelated. Mail clients that show only the name hide this, especially on phones.",
          ],
        },
        { t: "p", x: "When someone says \"my email is being spoofed\", it is worth working out which of these four is happening, because the fixes differ. The tests in the next section separate them." },
      ],
    },
    {
      id: "how-to-check",
      h2: "Step 1: Find out what is published today",
      blocks: [
        { t: "p", x: "You can see your current setup from public DNS without logging in anywhere. Our [email spoofing check](/tools/email-spoofing-check) and the [free security scan](/scan) read the same public records a receiving mail server reads. If you prefer to look yourself, a DNS lookup tool or the command line shows each record." },
        {
          t: "table",
          caption: "The three records and where they live",
          head: ["Record", "Where it is published", "What it should look like"],
          rows: [
            ["SPF", "A TXT record on your domain, for example yourbusiness.com.au", "Starts with v=spf1, lists the services allowed to send, and ends with ~all or -all"],
            ["DKIM", "A TXT or CNAME record at selector._domainkey.yourbusiness.com.au", "Contains a public key (p=...) or points to your mail provider, who holds the key"],
            ["DMARC", "A TXT record at _dmarc.yourbusiness.com.au", "Starts with v=DMARC1 and has a policy of p=none, p=quarantine or p=reject, plus a reporting address"],
          ],
        },
        { t: "p", x: "Three results are common on small business domains. The first is no DMARC record at all, which means receivers have no instruction from you and make their own call. The second is a DMARC record at p=none, which means you are monitoring but nothing is blocked. The third is a record at quarantine or reject, which means the protection is switched on. Only the third stops a forged message from your exact domain being delivered normally." },
        { t: "p", x: "Our own measurement of Australian and New Zealand small business domains is described in [ANZ small business email security, measured](/blog/anz-smb-email-security-double-gap-measured), including the sampling method and its limits. We cite the method rather than a headline number here, because the point for you is your own domain, not an average." },
      ],
    },
    {
      id: "list-senders",
      h2: "Step 2: List everything that sends as you",
      blocks: [
        { t: "p", x: "The most common reason a DMARC rollout goes wrong is a forgotten sender. Before you change any record, write down every service that sends email using your domain in the From address. A typical tradie or office business has more than they remember." },
        {
          t: "ul",
          x: [
            "Your main mailboxes: Microsoft 365, Google Workspace or a hosting provider's mail.",
            "Your accounting package, which sends invoices and statements.",
            "Your job management or quoting software, which sends quotes, bookings and reminders.",
            "Your website contact forms and online booking tool.",
            "Your newsletter or marketing platform.",
            "Your payment processor, which may send receipts.",
            "Scanners, printers and alarm systems that email you or your customers.",
            "Any IT provider or web developer who set something up for you years ago.",
          ],
        },
        { t: "p", x: "Each of these either needs to be listed in your SPF record, sign with DKIM using your domain, or both. Sending from a third-party address such as a software vendor's own domain is fine and needs no work from you, but then your customers see that vendor's address, not yours." },
        { t: "p", x: "A good source for finding forgotten senders is DMARC reporting itself. If you publish a record at p=none with a reporting address, receivers send you daily summaries listing every server that sent mail claiming your domain, and whether it passed. Within two weeks you usually have the full list." },
      ],
    },
    {
      id: "spf",
      h2: "Step 3: Set up SPF",
      blocks: [
        { t: "p", x: "SPF, defined in [RFC 7208](https://datatracker.ietf.org/doc/html/rfc7208), is a list published in DNS of the servers allowed to send mail for your domain. A receiving server looks at the connecting server and checks it against your list." },
        {
          t: "example",
          title: "A typical SPF record for a Microsoft 365 business that also uses an accounting package",
          x: [
            "v=spf1 include:spf.protection.outlook.com include:_spf.example-accounting.com ~all",
            "The first include authorises Microsoft 365. The second is a placeholder for a vendor's published include, which the vendor's help page tells you to copy exactly. The ~all at the end means \"treat everything else as a soft fail\".",
          ],
        },
        { t: "p", x: "Three rules keep SPF working." },
        {
          t: "ol",
          x: [
            "**One SPF record per domain.** Two records beginning v=spf1 on the same name cause a permanent error and receivers may ignore both. If you need to add a service, edit the existing record.",
            "**Ten DNS lookups at most.** Each include, a, mx and redirect counts toward a limit of ten in the specification. Go over it and SPF fails with a permanent error, even if every sender is genuine. Remove services you no longer use.",
            "**End with an explicit rule.** Use ~all while you are testing and -all when you are confident you have listed every sender. DMARC does the real enforcing, so many businesses stay on ~all.",
          ],
        },
        { t: "p", x: "SPF has a weakness that matters for spoofing. It checks the envelope sender, not the From header your customer sees. An attacker can pass SPF for their own domain while showing yours in the From line. This is why SPF alone does not stop the visible forgery, and why DMARC exists." },
      ],
    },
    {
      id: "dkim",
      h2: "Step 4: Set up DKIM",
      blocks: [
        { t: "p", x: "DKIM, defined in [RFC 6376](https://datatracker.ietf.org/doc/html/rfc6376), adds a digital signature to each outgoing message. Your mail system signs with a private key it keeps secret. The matching public key is published in your DNS under a name that includes a selector, such as selector1._domainkey.yourbusiness.com.au. The receiver fetches the public key, checks the signature and learns two things: the message was signed by a system with access to your key, and the signed parts were not altered on the way." },
        { t: "p", x: "Most business mail platforms handle the key for you. In Microsoft 365 you publish two CNAME records and switch signing on. In Google Workspace you generate a key in the admin console and publish it as a TXT record. Third-party senders such as accounting or newsletter platforms each have their own DKIM setup page, and you must complete it for your own domain, otherwise they sign with their domain and DMARC alignment fails. We cover the mechanics in [what a DKIM record is](/guides/what-is-a-dkim-record), and the Microsoft 365 specifics in [DMARC for Microsoft 365](/guides/dmarc-for-microsoft-365)." },
      ],
    },
    {
      id: "dmarc",
      h2: "Step 5: Publish DMARC and move to enforcement",
      blocks: [
        { t: "p", x: "DMARC, defined in [RFC 7489](https://datatracker.ietf.org/doc/html/rfc7489), ties the two checks to the visible From address. A message passes DMARC when SPF or DKIM passes and the domain that passed matches (aligns with) the domain in the From header. The record also tells receivers what to do with a failure, and where to send reports." },
        {
          t: "table",
          caption: "The three DMARC policies",
          head: ["Policy", "What receivers are asked to do", "When to use it"],
          rows: [
            ["p=none", "Deliver as normal, but send reports", "First, for about two to four weeks, while you find every sender"],
            ["p=quarantine", "Treat failures as suspicious, usually spam or junk", "Next, once reports show your real mail passes"],
            ["p=reject", "Refuse failures at the door", "The target. This is the setting that stops forged mail being delivered"],
          ],
        },
        {
          t: "example",
          title: "A starting DMARC record",
          x: [
            "Name: _dmarc",
            "Type: TXT",
            "Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
            "The rua address receives daily summary files. Use a shared mailbox, not a personal one, because the files arrive every day from many receivers.",
          ],
        },
        { t: "p", x: "Microsoft's own guidance for rolling out DMARC recommends the same sequence: start with p=none and monitor, then raise to p=quarantine, then p=reject, and use the pct tag to apply a policy to a growing share of failing mail while you check results. The pct tag runs in steps such as 10, 25, 50, 75 and 100. See Microsoft's [DMARC setup guidance](https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure)." },
        { t: "p", x: "Moving too fast is the one real risk. If you publish p=reject before every legitimate sender passes, your own invoices or quotes can be refused by customers' mail systems. The reports are your safety net: when every legitimate source shows as passing for a few weeks, you can tighten the policy." },
        { t: "h3", x: "Subdomains and unused domains" },
        { t: "p", x: "A DMARC record on your main domain also covers subdomains that have no record of their own, including subdomains that do not exist. Attackers like to use made-up subdomains, so this inheritance helps. If you own domains you never send email from, such as an old trading name, publish a record of v=DMARC1; p=reject on each so nobody can use them to forge mail. An SPF record of v=spf1 -all on those domains adds a second signal that no mail should come from them." },
      ],
    },
    {
      id: "what-it-wont-stop",
      h2: "What DMARC will not stop",
      blocks: [
        { t: "p", x: "Reaching p=reject is a real milestone, and it does not make your business immune to email fraud. Be clear about what is still open." },
        {
          t: "ul",
          x: [
            "**Lookalike domains.** An attacker can register a near-match of your name and enrol it with its own SPF, DKIM and DMARC. The mail will pass authentication for the wrong domain. Staff and customers need to check the address, not only the name.",
            "**Hacked mailboxes.** If an attacker is inside a real account, messages come from your own servers with valid signatures. Turn on multi-factor authentication, check for hidden forwarding rules after any suspected breach and review which apps have access to the mailbox.",
            "**Forwarded and mailing list mail.** Forwarding can break SPF and sometimes DKIM. This is why DMARC takes either check to pass, and why DKIM is the more reliable of the two.",
            "**Customer side behaviour.** Some small receivers do not check DMARC at all. Your policy is a request to receivers, and no sender can promise every receiving system acts on it the same way.",
          ],
        },
        { t: "p", x: "For lookalike risk, one defensive option is to register the most obvious variants of your domain and publish a reject policy on them. It rarely justifies a large spend for a small business. A written rule that staff and customers confirm bank detail changes by phone, using a number you already hold, is worth more." },
      ],
    },
    {
      id: "if-it-happened",
      h2: "If someone is already spoofing you",
      blocks: [
        { t: "p", x: "If customers have received forged mail from your domain right now, work through the following in order." },
        {
          t: "ol",
          x: [
            "Check your DMARC record. If it is missing or at p=none, publish it or move it to enforcement as above. Do this in stages if you have not yet found all your senders.",
            "Check your mailboxes. Look for sign-in activity you do not recognise, forwarding rules you did not create and recent password resets. If anything looks wrong, change passwords, enable multi-factor authentication and treat it as an account takeover.",
            "Tell affected customers plainly. Say that you did not send the message, what to ignore and how they can verify you, such as a phone number on your website. You do not need to say more than that.",
            "Report it. In Australia, the Australian Cyber Security Centre runs [ReportCyber](https://www.cyber.gov.au/report-and-recover/report) for cybercrime reports, and the ACCC's [Scamwatch](https://www.scamwatch.gov.au) takes scam reports and publishes warnings. Reporting helps others and creates a record if money was lost.",
            "If a customer paid money to a forged request, tell them to contact their bank immediately and ask for a recall. Speed matters most in the first hours.",
            "If personal information was exposed, for example because a mailbox was accessed, read [the Privacy Act guide](/guides/privacy-act-small-business-australia) to see whether the notifiable data breach rules apply.",
          ],
        },
        { t: "p", x: "Our post [Can someone send an email pretending to be my business?](/blog/can-someone-send-email-pretending-to-be-my-business) walks through the same situation from the customer's point of view, and [invoice scams aimed at tradies](/blog/invoice-scam-tradies) shows what the forged message often asks for." },
      ],
    },
    {
      id: "keeping-it-working",
      h2: "Keeping it working",
      blocks: [
        { t: "p", x: "Records drift. A new software tool starts sending as you, a vendor changes its servers, or an IT provider adds an SPF include and pushes you past the lookup limit. Three habits keep the protection in place." },
        {
          t: "ul",
          x: [
            "Read the DMARC summary reports, or have a reporting tool read them, at least monthly.",
            "Re-run the free check each quarter and every time you add or remove a service that sends mail.",
            "Keep a one-page list of who sends as you, who owns each service and the date you last confirmed its records.",
          ],
        },
        { t: "p", x: "If you want the records checked on a schedule, the [Compliance Monitor](/monitor) does external checks automatically, and the [DMARC and SPF setup guide](/products/dmarc-setup-guide) gives the DNS entries and a safe rollout order. For a written report on one domain, there is also the [Instant Email Domain Check](/offers/instant-email-domain-check)." },
      ],
    },
  ],
  faq: [
    {
      q: "Can I stop someone using my email address as the sender?",
      a: "For your exact domain, yes, once SPF, DKIM and DMARC are set up and DMARC is at p=quarantine or p=reject. Receivers that honour the policy will then junk or refuse messages that fail. You cannot stop someone typing your address, but you can stop those messages being delivered as if they were yours.",
    },
    {
      q: "How do I know if my domain is being spoofed?",
      a: "Publish a DMARC record with a reporting address. Receivers send daily aggregate reports listing every server that sent mail claiming your domain and whether it passed. Unknown servers with failing results are the evidence. Customers forwarding you suspicious messages is the other common sign.",
    },
    {
      q: "Will a DMARC record at p=none stop spoofing?",
      a: "No. At p=none receivers are asked to take no action on failures, so forged messages can still arrive. The setting is for monitoring. Spoofing of your exact domain is only blocked at p=quarantine or p=reject.",
    },
    {
      q: "Is email spoofing the same as my account being hacked?",
      a: "No. Spoofing forges the From line without access to your account. A hack means someone is using your real mailbox. Authentication records help with the first and do not detect the second, so you need multi-factor authentication as well.",
    },
    {
      q: "Does email spoofing mean my business has been breached?",
      a: "Not on its own. Spoofing needs no access to your systems. It does mean your domain has no enforced protection, so treat it as a prompt to fix your records, and check your mailboxes anyway to rule out a separate compromise.",
    },
    {
      q: "How long does it take to stop spoofing of my domain?",
      a: "Publishing the records takes under an hour. Getting from p=none to p=reject safely usually takes several weeks, because you need time in monitoring to find every legitimate sender. Rushing the last step is how businesses block their own invoices.",
    },
    {
      q: "What does it cost?",
      a: "SPF, DKIM and DMARC are DNS records, so they cost nothing to publish. Some businesses pay a reporting service to turn the report files into a readable dashboard, or an IT provider for setup time. A self-check with our free scan costs nothing.",
    },
  ],
  sources: [
    { label: "RFC 7489: Domain-based Message Authentication, Reporting and Conformance (DMARC)", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "The DMARC specification, including policies and subdomain handling" },
    { label: "RFC 7208: Sender Policy Framework (SPF)", url: "https://datatracker.ietf.org/doc/html/rfc7208", note: "Including the limit of 10 DNS lookups" },
    { label: "RFC 6376: DomainKeys Identified Mail (DKIM) Signatures", url: "https://datatracker.ietf.org/doc/html/rfc6376", note: "The DKIM specification" },
    { label: "Microsoft: Set up DMARC to validate email in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure", note: "Staged rollout from p=none to p=reject, pct tag, parked domains" },
    { label: "Google: Email sender guidelines", url: "https://support.google.com/a/answer/81126", note: "Authentication requirements for bulk senders" },
    { label: "ACSC: Report and recover", url: "https://www.cyber.gov.au/report-and-recover/report", note: "ReportCyber, the national cybercrime reporting service" },
    { label: "Scamwatch (ACCC)", url: "https://www.scamwatch.gov.au", note: "Current scams and how to report them" },
    { label: "Titanos: ANZ small-business email security, measured", url: "https://titanos.tech/blog/anz-smb-email-security-double-gap-measured", note: "Our own sampling method, results and limitations" },
  ],
  related: {
    posts: ["can-someone-send-email-pretending-to-be-my-business", "invoice-scam-tradies", "anz-smb-email-security-double-gap-measured", "the-bank-details-email-accountants-and-bookkeepers"],
    tools: [
      { label: "Email spoofing check", href: "/tools/email-spoofing-check", blurb: "Look up your domain's public SPF, DKIM and DMARC records and see whether someone could send as you." },
      { label: "Free security scan", href: "/scan", blurb: "Reads your public settings and explains each result in plain words." },
      { label: "Instant Email Domain Check", href: "/offers/instant-email-domain-check", blurb: "A one-page written report on whether scammers can send as you, with exact fixes." },
      { label: "Compliance Monitor", href: "/monitor", blurb: "Scheduled external checks so records do not drift." },
    ],
    products: [
      { label: "DMARC and SPF Setup Guide", href: "/products/dmarc-setup-guide", blurb: "Step-by-step DNS changes in a safe rollout order." },
      { label: "Email Spoofing Self-Check Checklist", href: "/products/spoofguard-self-check-checklist", blurb: "Ten checks using public records only." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Check your domain now",
    href: "/tools/email-spoofing-check",
    text: "See in under a minute whether someone could send email as your business. The check reads public DNS records only, touches nothing of yours and explains each result.",
  },
};
