import type { Guide } from "@/lib/guides";

export const bimiSmallBusiness: Guide = {
  slug: "bimi-for-small-business",
  seoTitle: "BIMI for Small Business: Logo in Inbox Guide",
  h1: "BIMI for Small Business: Getting Your Logo in the Inbox, and Whether It Is Worth It",
  description:
    "BIMI can show your logo beside your email in supporting inboxes. See what it needs (DMARC enforcement, an SVG logo, a certificate) and who it suits.",
  cluster: "BIMI",
  targetTerms: ["bimi for small business", "what is bimi email", "bimi record setup", "bimi vmc cmc australia", "show logo in gmail inbox"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "BIMI, which stands for Brand Indicators for Message Identification, is a way of getting your logo to appear next to your emails in inboxes that support it. You publish a small DNS record that points to your logo, and a supporting mailbox provider shows the logo beside messages that pass authentication. It is a visible reward for doing email security properly.",
    },
    {
      t: "p",
      x: "It is also one of the most over-sold topics in email. The logo is a nice finish, not a protection in itself, and the cost and requirements can be out of proportion for a very small business. This guide explains what BIMI needs, what it costs in effort and money in general terms, which mailbox providers show it and who should skip it. If you only want to stop forged email, you can achieve that without BIMI, and you must do it before BIMI is even possible.",
    },
    {
      t: "note",
      title: "The honest summary",
      x: "BIMI needs DMARC at p=quarantine or p=reject first. That is the valuable part and it is free. The logo itself needs a special SVG file and, for most inboxes, a paid certificate. For most sole traders and small teams, finishing DMARC is the right job this quarter and BIMI can wait.",
    },
  ],
  sections: [
    {
      id: "what-it-is",
      h2: "What BIMI is and what it does",
      blocks: [
        { t: "p", x: "BIMI is an open specification developed by an industry group of email senders and mailbox providers. The idea is simple. If a message passes DMARC at an enforcing policy, the receiving provider can look up a BIMI record for the sender's domain, fetch the logo it points to and show it in the inbox, in the sender avatar position." },
        { t: "p", x: "What it gives you:" },
        {
          t: "ul",
          x: [
            "**Recognition.** Customers who see your logo beside genuine messages find them easier to spot among the rest of their inbox.",
            "**A signal that authentication is working.** Because BIMI will not show without enforced DMARC, the logo is indirect evidence that the sender has done the work.",
            "**A small deterrent to forgery.** Forged mail from your domain fails DMARC and so does not get the logo.",
          ],
        },
        { t: "p", x: "What it does not give you: protection from lookalike domains, protection from a hacked mailbox, or any guarantee that a given inbox will show the logo. Support depends on the receiving provider, and individual users can switch avatars off. Treat BIMI as presentation on top of security, never as security." },
      ],
    },
    {
      id: "requirements",
      h2: "What BIMI requires",
      blocks: [
        { t: "p", x: "The requirements stack up in a fixed order. Each one has to be in place before the next is any use." },
        {
          t: "table",
          caption: "BIMI requirements in order",
          head: ["Requirement", "What it means", "Effort and cost"],
          rows: [
            ["1. SPF and DKIM working", "Your mail platform signs and your senders are listed", "Free, a few hours. See our [DKIM guide](/guides/what-is-a-dkim-record) and [SPF guide](/guides/what-is-an-spf-record)"],
            ["2. DMARC at p=quarantine or p=reject, pct=100", "An enforcing policy applied to all failing mail. p=none does not qualify.", "Free, but takes weeks of monitoring. See [stopping spoofing](/guides/stop-email-spoofing-my-domain)"],
            ["3. A logo in SVG Tiny PS format", "A specific, restricted SVG profile, square, with no scripts or external links", "A designer or a careful export. Ordinary SVG files often fail"],
            ["4. The logo hosted on HTTPS", "A web address that serves the file over TLS", "Free on your website"],
            ["5. A BIMI TXT record", "A DNS record at default._bimi.yourdomain pointing at the logo", "Free, minutes"],
            ["6. A mark certificate (for most inboxes)", "A VMC or CMC issued by an approved certificate authority", "Paid, plus checks. Ask the authority for current pricing"],
          ],
        },
        { t: "p", x: "Google's documentation for Google Workspace sets out the same chain. It says the DMARC policy must be quarantine or reject, not none, and the percent option must be 100. It requires the logo as an SVG meeting the Tiny Portable/Secure profile (baseProfile tiny-ps, version 1.2), recommends a square logo centred on a solid background, no larger than 32 KB, and says the logo must be at least 96 by 96 pixels for Gmail. Check Google's [BIMI setup page](https://knowledge.workspace.google.com/admin/security/set-up-bimi) for the current wording before you start, because these details change." },
      ],
    },
    {
      id: "vmc-cmc",
      h2: "VMC and CMC certificates: the costly part",
      blocks: [
        { t: "p", x: "A Verified Mark Certificate (VMC) is a digital certificate that ties your logo to your organisation. A Common Mark Certificate (CMC) is a related, lighter option for logos that are not registered trademarks. Both come from third-party certificate authorities that check who you are." },
        { t: "p", x: "According to Google's documentation, a VMC requires a trademarked logo, and the trademark process can take 6 to 12 months. A CMC is the option for logos that are not trademarked. In Gmail, the verified checkmark appears for senders verified with a VMC, and the logo is supplied bundled with the certificate in a PEM file rather than as a bare SVG." },
        { t: "p", x: "Two practical consequences follow for a small Australian business." },
        {
          t: "ul",
          x: [
            "**Trademark status matters.** A VMC needs the logo registered as a trademark in a jurisdiction the certificate authority accepts. If you have not registered yours, you are choosing between registering first, which takes time and money, or looking at a CMC.",
            "**Certificates have an ongoing cost.** They are issued for a term and need renewing, and the price is set by each certificate authority. We do not quote a price here because it varies and changes. Get a current written quote from at least two authorities before you commit.",
          ],
        },
        { t: "p", x: "Some mailbox providers show a BIMI logo without a certificate for senders that meet their own conditions, and policies on this have changed over time. Do not rely on any article, including this one, for the current position. Check each provider's documentation on the day you decide." },
      ],
    },
    {
      id: "who-supports",
      h2: "Which inboxes show BIMI",
      blocks: [
        { t: "p", x: "Support is set by the receiving mailbox provider, not by you. Gmail supports BIMI, as Google's own documentation states. Other large providers and some mail apps have announced or built support at different times, and the list shifts. The BIMI Group, the industry body behind the specification, publishes a list of supporting providers. Check that list rather than assuming." },
        { t: "p", x: "A sensible way to decide is to look at your own customers. Open your newsletter or customer list and see which providers dominate. If most of your customers use a provider that does not display BIMI, the benefit is smaller." },
      ],
    },
    {
      id: "logo",
      h2: "Preparing the logo file",
      blocks: [
        { t: "p", x: "The SVG Tiny PS requirement is where many projects stall. It is a deliberately strict subset of SVG. Typical export from a design tool includes features that are not allowed, such as scripts, animation, embedded raster images, external references and some styling features." },
        {
          t: "ol",
          x: [
            "Start with a square version of your logo on a solid background. A wide wordmark does not suit the round or square avatar the inbox uses.",
            "Export or convert to SVG and set the profile attributes baseProfile to tiny-ps and version to 1.2. Some design tools cannot do this directly, and a designer or a conversion tool may be needed.",
            "Remove anything not permitted: scripts, animation, embedded bitmaps, external links.",
            "Add a title and, as Google recommends, a desc element.",
            "Keep the file small. Google recommends 32 KB or less.",
            "Validate it with a BIMI validator from your certificate authority or the BIMI Group before you apply for a certificate, since the authority checks the file.",
          ],
        },
        { t: "p", x: "Host the file on your own website over HTTPS at a stable address, for example https://yourbusiness.com.au/bimi/logo.svg. Do not move it later without updating the record." },
      ],
    },
    {
      id: "record",
      h2: "The BIMI DNS record",
      blocks: [
        { t: "p", x: "The record is a TXT record published at default._bimi under your domain. It names the logo, and, if you have a certificate, the certificate file." },
        {
          t: "example",
          title: "Example BIMI record (placeholder addresses)",
          x: [
            "Name: default._bimi",
            "Type: TXT",
            "Value: v=BIMI1; l=https://yourbusiness.com.au/bimi/logo.svg; a=https://yourbusiness.com.au/bimi/certificate.pem",
            "l= is the location of the logo. a= is the location of the certificate in PEM form. If you have no certificate, the a= part is left out, and providers that need one will not show your logo.",
          ],
        },
        { t: "p", x: "Google says logos can take up to 48 hours to appear after the record is published and checked. If nothing shows, work back through the chain: DMARC enforcement, then the logo file, then the certificate, then the record." },
        { t: "p", x: "Keep a note of where the logo file, the certificate and the DNS record live, and who in your business or IT provider owns each. Certificates expire and logos get redesigned, and the usual failure a year later is a lapsed certificate that nobody remembers buying. A calendar reminder set at the renewal date costs nothing." },
        { t: "p", x: "Avoid publishing the record before DMARC is enforcing. It does nothing, and a half-finished BIMI setup is a common reason people think the specification is broken." },
      ],
    },
    {
      id: "who-should-skip",
      h2: "Who should do BIMI and who should skip it",
      blocks: [
        {
          t: "table",
          caption: "A rough decision guide",
          head: ["Your situation", "Our suggestion"],
          rows: [
            ["DMARC is not yet at quarantine or reject", "Do that first. It is free and does the real work."],
            ["Sole trader or very small team, mostly one-to-one customer email", "Skip BIMI for now. A phone confirmation rule for bank details protects you more."],
            ["You send regular newsletters or quotes to a large customer list, mostly on Gmail", "Worth considering once DMARC has been at enforcement for a while"],
            ["Your logo is a registered trademark", "A VMC is available to you. Compare current quotes."],
            ["Your brand is your main trust signal, for example a bank-facing professional services firm", "Consider it as part of a wider brand and security plan"],
          ],
        },
        { t: "p", x: "There is also a middle path. Many businesses finish DMARC enforcement, then leave BIMI for a year and revisit it when customers or a larger client ask, or when supporting providers and certificate options have changed. Nothing is lost by waiting, because the DMARC work is the same work BIMI would have required." },
        { t: "p", x: "A fair test is to ask what you would do with the money otherwise. A few hundred dollars a year on certificates may be better spent on multi-factor authentication for every mailbox, a password manager or a reporting service for DMARC. BIMI is the icing, not the cake." },
      ],
    },
    {
      id: "next-steps",
      h2: "A sensible order of work",
      blocks: [
        {
          t: "ol",
          x: [
            "Check where you stand with the [email spoofing check](/tools/email-spoofing-check).",
            "Get SPF and DKIM right for every sender.",
            "Publish DMARC at p=none, read the reports for several weeks, then move to quarantine and reject. The [DMARC and SPF setup guide](/products/dmarc-setup-guide) gives the order.",
            "Hold at enforcement for a period to make sure nothing legitimate is being blocked.",
            "Only then decide about BIMI, with quotes in hand.",
          ],
        },
        { t: "p", x: "If you are on Microsoft 365, our [DMARC for Microsoft 365 guide](/guides/dmarc-for-microsoft-365) covers the first steps for that platform." },
      ],
    },
  ],
  faq: [
    {
      q: "What is BIMI?",
      a: "BIMI is Brand Indicators for Message Identification. It lets a business publish a DNS record pointing to its logo so that supporting inboxes can show the logo beside authenticated messages. It depends on the sender having DMARC at quarantine or reject.",
    },
    {
      q: "Do I need DMARC for BIMI?",
      a: "Yes. According to Google's documentation, the DMARC policy must be quarantine or reject, not none, and the percent option must be 100. That is why DMARC enforcement comes first in any BIMI plan.",
    },
    {
      q: "Do I need a VMC or CMC for BIMI?",
      a: "For Gmail, Google's documentation says you need a VMC, which it recommends, or a CMC. Some other providers have different rules and these change over time, so check each provider before you decide.",
    },
    {
      q: "Do I need a registered trademark for BIMI?",
      a: "A VMC requires a trademarked logo, according to Google. A CMC is available for logos that are not trademarked. Trademark registration can take 6 to 12 months according to the same page, so allow for that if you want a VMC.",
    },
    {
      q: "What file format does the BIMI logo need?",
      a: "An SVG file that meets the SVG Tiny Portable/Secure profile, with baseProfile set to tiny-ps and version 1.2. Google recommends a square logo on a solid background, 32 KB or smaller, and at least 96 by 96 pixels for Gmail.",
    },
    {
      q: "Does BIMI stop email spoofing?",
      a: "No. DMARC at an enforcing policy does that work, and BIMI is a display feature that builds on it. BIMI does not stop lookalike domains or hacked accounts.",
    },
    {
      q: "Is BIMI worth it for a tradie or small office?",
      a: "Usually not yet. Finishing DMARC and turning on multi-factor authentication give more protection for no cost. BIMI becomes worth a look when you send regularly to a large customer list and your logo is already a strong part of your brand.",
    },
  ],
  sources: [
    { label: "Google Workspace: Set up BIMI", url: "https://knowledge.workspace.google.com/admin/security/set-up-bimi", note: "DMARC requirements, VMC and CMC, SVG profile, PEM file, 48 hours" },
    { label: "BIMI Group", url: "https://bimigroup.org", note: "The industry body behind the specification, with implementation guidance" },
    { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "The policy BIMI depends on" },
    { label: "Microsoft Learn: Set up DMARC to validate email in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure", note: "Staged rollout to p=reject" },
    { label: "Google: Email sender guidelines", url: "https://support.google.com/a/answer/81126", note: "Authentication expectations for senders" },
  ],
  related: {
    posts: ["can-someone-send-email-pretending-to-be-my-business", "anz-smb-email-security-double-gap-measured", "invoice-scam-tradies"],
    tools: [
      { label: "Email spoofing check", href: "/tools/email-spoofing-check", blurb: "Look up your domain's public SPF, DKIM and DMARC records." },
      { label: "Free security scan", href: "/scan", blurb: "Reads your public settings and explains each result." },
      { label: "Compliance Monitor", href: "/monitor", blurb: "Scheduled external checks so records do not drift." },
    ],
    products: [
      { label: "DMARC and SPF Setup Guide", href: "/products/dmarc-setup-guide", blurb: "Step-by-step DNS changes in a safe rollout order." },
      { label: "Email Spoofing Self-Check Checklist", href: "/products/spoofguard-self-check-checklist", blurb: "Ten checks using public records only." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Check your DMARC status",
    href: "/tools/email-spoofing-check",
    text: "BIMI starts with DMARC at quarantine or reject. See where your domain stands today. The check reads public DNS only and explains each result in plain words.",
  },
};
