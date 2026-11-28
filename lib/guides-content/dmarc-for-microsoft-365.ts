import type { Guide } from "@/lib/guides";

export const dmarcMicrosoft365: Guide = {
  slug: "dmarc-for-microsoft-365",
  seoTitle: "DMARC for Microsoft 365: Small Business Setup",
  h1: "DMARC for Microsoft 365: A Step-by-Step Setup Guide for Small Business",
  description:
    "How to set up SPF, DKIM and DMARC for Microsoft 365 on a custom domain: where each record goes, a safe p=none to p=reject rollout and how to fix failures.",
  cluster: "DMARC for Microsoft 365",
  targetTerms: ["dmarc microsoft 365", "set up dmarc office 365", "microsoft 365 dkim setup", "dmarc record microsoft 365 small business"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "Microsoft 365 signs some of your outgoing mail and publishes some of your DNS by default, but it does not turn on DMARC for your own domain. That is a common surprise. A business can pay for Microsoft 365 for years and still have no DMARC record on its domain, which means nothing stops a stranger sending email that looks like it came from you.",
    },
    {
      t: "p",
      x: "This guide takes you through the setup for a business using Microsoft 365 with its own domain name, for example yourbusiness.com.au. You will set up SPF, turn on DKIM signing for the custom domain, publish a DMARC record, and raise the policy in stages. It also covers the third-party senders that usually cause trouble, and how to read the failures when they happen. The steps follow Microsoft's own documentation, linked in the sources.",
    },
    {
      t: "note",
      title: "Where each piece lives",
      x: "SPF and DMARC are DNS records you publish at your domain registrar or DNS host. DKIM is switched on in the Microsoft Defender portal, after you publish two CNAME records at your DNS host. Microsoft 365 has no screen for managing DMARC records on a custom domain, so your registrar is where the work happens.",
    },
  ],
  sections: [
    {
      id: "before-you-start",
      h2: "Before you start",
      blocks: [
        { t: "p", x: "You need three things: administrator access to Microsoft 365, login access to wherever your domain's DNS is managed, and a list of everything that sends email as your business." },
        {
          t: "ul",
          x: [
            "**Microsoft 365 admin access.** You need the Global Administrator role or a role that can manage email authentication settings in the Defender portal.",
            "**DNS access.** DNS is usually managed at your domain registrar or your web host. If an IT provider or web developer set the domain up, you may need to ask them for access or send them the exact records from this guide.",
            "**A sender list.** Microsoft 365 mailboxes are one sender. Your accounting software, job management app, newsletter platform and website forms may be others. Each needs to pass authentication or be on the list before you enforce anything.",
          ],
        },
        { t: "p", x: "If you are not sure what your domain publishes today, run the [email spoofing check](/tools/email-spoofing-check) first. It reads the same public records and shows you SPF, DKIM and DMARC as a receiving mail server sees them. For the wider picture, see [how to stop email spoofing of your domain](/guides/stop-email-spoofing-my-domain)." },
      ],
    },
    {
      id: "spf",
      h2: "Step 1: SPF for Microsoft 365",
      blocks: [
        { t: "p", x: "SPF is a TXT record on your domain listing which servers may send for you. For a domain that sends mail only through Microsoft 365, the record Microsoft documents is:" },
        {
          t: "example",
          title: "SPF record for a Microsoft 365 only domain",
          x: [
            "Name: @ (the domain itself)",
            "Type: TXT",
            "Value: v=spf1 include:spf.protection.outlook.com -all",
          ],
        },
        { t: "p", x: "If other services also send as you, add their include entries before the all term, as each vendor's help page directs. Keep to one SPF record per domain, and stay within the specification's limit of ten DNS lookups; each include counts, and some vendors' includes use several. Our [SPF record guide](/guides/what-is-an-spf-record) explains the limit and how to check it." },
        { t: "p", x: "Many small businesses already have an SPF record from the day Microsoft 365 was connected. Check before adding a second one. Two SPF records on the same name is an error, not a bonus." },
      ],
    },
    {
      id: "dkim",
      h2: "Step 2: Turn on DKIM for your custom domain",
      blocks: [
        { t: "p", x: "Microsoft 365 automatically signs mail from your yourcompany.onmicrosoft.com address. It does not sign mail from your custom domain until you set that up, and without it DMARC has only SPF to lean on, which breaks when mail is forwarded. DKIM for a custom domain uses two CNAME records. You publish them, then enable signing." },
        { t: "ol", x: [
          "Open the Microsoft Defender portal at security.microsoft.com and go to Email & collaboration, then Policies & rules, then Threat policies, then Email authentication settings, then the DKIM tab.",
          "Select your custom domain. The panel shows the two CNAME records you need to publish, each with a hostname and a value. Use these exact values. Microsoft states that the examples in its documentation are for illustration and the portal gives the real ones for your organisation.",
          "At your DNS host, create the two CNAME records. The hostnames are selector1._domainkey and selector2._domainkey, and each points to the value the portal shows.",
          "Wait for DNS to update, usually minutes but occasionally longer, then return to the portal and switch the toggle for the domain to Enabled.",
        ] },
        { t: "p", x: "Microsoft publishes two selectors so it can rotate keys without a gap. You publish both and enable once. Some DNS hosts append your domain automatically to the hostname, so if the portal shows a long name ending in your domain, enter only the part before it, or the record ends up with the domain twice. This is the most common mistake in this step." },
        { t: "p", x: "Microsoft's PowerShell cmdlet for creating a signing configuration accepts key sizes of 1024 or 2048. Where you have a choice, 2048 is the stronger option. The [DKIM record guide](/guides/what-is-a-dkim-record) explains what the record does and how to verify it." },
        { t: "note", title: "Check that signing works", x: "Send a message from your Microsoft 365 mailbox to an outside address such as a free webmail account and open its full headers. Look for a DKIM-Signature header with d= set to your own domain, not onmicrosoft.com, and an Authentication-Results line with dkim=pass." },
      ],
    },
    {
      id: "dmarc-record",
      h2: "Step 3: Publish the DMARC record at p=none",
      blocks: [
        { t: "p", x: "A DMARC record is a TXT record at _dmarc.yourdomain. Microsoft's documentation gives the general form as v=DMARC1; p=<reject | quarantine | none>; pct=<0-100>; rua=mailto:<address>. Start in monitoring mode." },
        {
          t: "example",
          title: "Starting DMARC record",
          x: [
            "Name: _dmarc",
            "Type: TXT",
            "Value: v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
            "Use a shared mailbox or a Microsoft 365 Group for the report address rather than one person's inbox. Microsoft recommends a dedicated mailbox or group, because reports arrive daily.",
          ],
        },
        { t: "p", x: "At p=none nothing is blocked. Receivers that support DMARC reporting start sending you a daily XML file listing the servers that sent mail claiming your domain, how many messages and whether they passed. These are the files you will read to find forgotten senders. Raw XML is unpleasant to read, so most businesses use a reporting service, or a tool that turns the files into a table. Microsoft points to the DMARC reporting partners in its security partner catalogue for this." },
        { t: "p", x: "Microsoft 365 sends DMARC aggregate reports about mail it receives from other domains, but it does not send forensic (failure) reports. The ruf tag in your own record may therefore get no reports from Microsoft recipients. Many receivers do not send forensic reports at all. Start with rua only." },
      ],
    },
    {
      id: "read-reports",
      h2: "Step 4: Read the reports and fix legitimate senders",
      blocks: [
        { t: "p", x: "Leave the record at p=none for two to four weeks, or longer if your business has seasonal mail such as quarterly statements. Then go through the report entries." },
        {
          t: "table",
          caption: "What the reports usually show and what to do",
          head: ["What you see", "What it usually means", "What to do"],
          rows: [
            ["Microsoft 365 servers, passing", "Your normal mailboxes", "Nothing. This is healthy."],
            ["A known service, SPF passes but DMARC fails", "The service sends with its own domain in the envelope, so SPF does not align with your From address", "Set up DKIM for your domain at that service, or change its sending domain to a subdomain of yours"],
            ["A known service, DKIM passes but does not align", "The service signs with its own domain", "Configure custom DKIM signing with your domain at the service"],
            ["An unknown server sending many messages, all failing", "Someone forging your domain", "No fix needed on your side. Your policy will block them once you enforce."],
            ["Forwarded mail failing", "Forwarding changes the envelope sender and can break signatures", "Expected in small amounts. Rely on DKIM, which often survives forwarding."],
          ],
        },
        { t: "p", x: "DMARC passes when either SPF or DKIM passes and aligns with the From domain. The word alignment is the key. A message can pass SPF and DKIM for a vendor's domain and still fail DMARC because neither matches your From address. Microsoft's troubleshooting pages call this the gap between authentication pass and alignment pass, and it is the most common reason for a failing legitimate sender." },
        { t: "p", x: "Where a third-party service cannot sign with your domain, a practical option is to send its mail from a subdomain, such as news.yourbusiness.com.au, with its own SPF and DKIM. Microsoft also recommends subdomains for bulk or less controlled services, so that problems with them do not affect the reputation of your main domain." },
      ],
    },
    {
      id: "enforce",
      h2: "Step 5: Move to quarantine, then reject",
      blocks: [
        { t: "p", x: "Once the reports show every legitimate sender passing, tighten the policy in stages. Microsoft's recommended path is p=none, then p=quarantine, then p=reject, using the pct tag to apply the policy to a growing share of failing mail while you watch for mistakes." },
        {
          t: "ol",
          x: [
            "Change to p=quarantine with pct=10. Wait a week and read the reports. Raise pct to 25, 50, 75 and 100 as each week passes without surprises.",
            "At p=quarantine and pct=100, run for at least a few weeks. Ask staff to watch for any customer saying they did not receive something.",
            "Change to p=reject. Keep reading reports monthly.",
          ],
        },
        { t: "p", x: "Microsoft notes one thing worth knowing: mail from a domain with p=quarantine or p=reject that fails DMARC at the destination is routed through the high-risk delivery pool for outbound messages, with no override. That is a reason to be sure of your senders before enforcing, not a reason to avoid enforcement." },
        { t: "p", x: "Each subdomain inherits the parent's DMARC record unless it has its own. Microsoft's advice for larger setups is to take subdomains to reject first, starting with the lowest volume, and the main domain last. For a small business with a single domain, the staged approach above is enough." },
        { t: "h3", x: "Domains you do not send from" },
        { t: "p", x: "If you own parked domains or old trading names, publish v=DMARC1; p=reject on each, as Microsoft's documentation recommends, so nobody can forge mail from them. If you do not use your yourcompany.onmicrosoft.com domain for email, Microsoft says to add the same kind of record for it in the Microsoft 365 admin center under Settings, then Domains, then DNS records." },
      ],
    },
    {
      id: "inbound",
      h2: "Your own inbound protection",
      blocks: [
        { t: "p", x: "DMARC also works in the other direction. When someone sends mail to your Microsoft 365 mailboxes, Microsoft checks the sender's DMARC record. In the anti-phishing policy there is a setting called Honor DMARC record policy. When it is on, mail from a domain that publishes p=quarantine and fails goes to junk, and mail from a domain with p=reject that fails is rejected during delivery. Microsoft lists this setting as recommended. Check it in the Defender portal so you are not overriding sender policies without meaning to." },
        { t: "p", x: "If you route mail through a filtering service before it reaches Microsoft 365, Microsoft says DMARC aggregate reports are not sent for that domain and enhanced filtering may be needed so Microsoft sees the original sender. Most small businesses with the default mail routing are not affected." },
      ],
    },
    {
      id: "common-problems",
      h2: "Common problems and fixes",
      blocks: [
        {
          t: "table",
          caption: "Microsoft 365 DMARC problems",
          head: ["Symptom", "Likely cause", "Fix"],
          rows: [
            ["Cannot find where to add DMARC in Microsoft 365", "There is no DMARC screen for custom domains", "Add the TXT record at your registrar or DNS host"],
            ["DKIM toggle will not enable", "CNAME records missing or the hostname has the domain added twice", "Check the records with a DNS lookup and republish"],
            ["Two SPF records", "A second record was added instead of editing the first", "Merge into one record"],
            ["SPF permerror", "More than ten DNS lookups", "Remove unused includes"],
            ["DMARC fails but SPF and DKIM pass", "Neither aligns with the From domain", "Sign with your own domain at the sending service"],
            ["No aggregate reports arrive", "Report mailbox does not exist or is external without authorisation", "Check the mailbox, and for an address on another domain the receiving domain needs a published authorisation record"],
          ],
        },
        { t: "p", x: "If you want a second pair of eyes, our [Instant Email Domain Check](/offers/instant-email-domain-check) gives a short written report from public records, and the [Compliance Monitor](/monitor) repeats the checks on a schedule. The [DMARC and SPF setup guide](/products/dmarc-setup-guide) lays out the same rollout with the DNS entries ready to copy." },
      ],
    },
  ],
  faq: [
    {
      q: "Does Microsoft 365 set up DMARC for me?",
      a: "No. Microsoft 365 handles SPF and DKIM for its own onmicrosoft.com domain, but for a custom domain you publish the DMARC record yourself at your DNS host. Microsoft's documentation says there is no admin portal or cmdlet for managing DMARC records on custom domains.",
    },
    {
      q: "Where do I add a DMARC record for Microsoft 365?",
      a: "At your domain registrar or DNS host, as a TXT record named _dmarc. The only DMARC record you add inside the Microsoft 365 admin center is for the onmicrosoft.com domain, under Settings, Domains and DNS records.",
    },
    {
      q: "What DMARC record should I use for Microsoft 365?",
      a: "Start with v=DMARC1; p=none; rua=mailto:an address you control. After two to four weeks of reports, move to p=quarantine and then p=reject, using pct to ramp up. Do not publish p=reject on day one unless you are certain every sender passes.",
    },
    {
      q: "Do I need DKIM as well as SPF for Microsoft 365?",
      a: "Yes, in practice. DMARC needs one of them to pass with alignment. SPF often breaks when mail is forwarded, so DKIM signed with your own domain is the more dependable one. Microsoft says to configure DKIM using your custom domain so the signing domain aligns with the From address.",
    },
    {
      q: "Will DMARC break my email?",
      a: "Not at p=none, which blocks nothing. Problems come when you move to quarantine or reject while a legitimate sender still fails. Reading the reports first and raising the policy in stages avoids that.",
    },
    {
      q: "Do I need DMARC if I only have a few staff?",
      a: "Anyone can forge your domain regardless of your size, and small businesses are targeted for invoice and payment fraud. Google also asks senders to authenticate, with stricter rules for those sending in bulk. A record takes under an hour to publish.",
    },
    {
      q: "Can I use DMARC with Microsoft 365 Business Basic or Standard?",
      a: "Yes. DMARC, SPF and DKIM are DNS and signing settings that do not depend on the Microsoft 365 plan, though some reporting and advanced threat features differ by plan. Check Microsoft's current plan comparison for the features you want.",
    },
  ],
  sources: [
    { label: "Microsoft Learn: Set up DMARC to validate email in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure", note: "Record syntax, staged rollout, parked domains, inbound handling" },
    { label: "Microsoft Learn: How to use DKIM for email in your custom domain", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure", note: "selector1 and selector2 CNAME records, enabling signing, key sizes" },
    { label: "Microsoft Learn: Set up SPF in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure", note: "The include for Microsoft 365" },
    { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "The specification" },
    { label: "RFC 7208: SPF", url: "https://datatracker.ietf.org/doc/html/rfc7208", note: "Including the limit of 10 DNS lookups" },
    { label: "RFC 6376: DKIM Signatures", url: "https://datatracker.ietf.org/doc/html/rfc6376", note: "The DKIM specification" },
    { label: "Google: Email sender guidelines", url: "https://support.google.com/a/answer/81126", note: "Authentication expectations for senders to Gmail" },
  ],
  related: {
    posts: ["can-someone-send-email-pretending-to-be-my-business", "anz-smb-email-security-double-gap-measured", "invoice-scam-tradies", "the-bank-details-email-accountants-and-bookkeepers"],
    tools: [
      { label: "Email spoofing check", href: "/tools/email-spoofing-check", blurb: "Look up your domain's public SPF, DKIM and DMARC records." },
      { label: "Free security scan", href: "/scan", blurb: "Reads your public SPF, DKIM and DMARC settings and explains them." },
      { label: "Instant Email Domain Check", href: "/offers/instant-email-domain-check", blurb: "A one-page written report with exact fixes." },
      { label: "Compliance Monitor", href: "/monitor", blurb: "Scheduled external checks so records do not drift." },
    ],
    products: [
      { label: "DMARC and SPF Setup Guide", href: "/products/dmarc-setup-guide", blurb: "Step-by-step DNS changes in a safe rollout order." },
      { label: "Email Spoofing Self-Check Checklist", href: "/products/spoofguard-self-check-checklist", blurb: "Ten checks using public records only." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Check your domain first",
    href: "/tools/email-spoofing-check",
    text: "Before changing any records, see what your domain publishes today. The check uses public DNS only and shows your SPF, DKIM and DMARC status in plain words.",
  },
};
