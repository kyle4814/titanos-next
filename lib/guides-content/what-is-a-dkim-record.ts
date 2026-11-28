import type { Guide } from "@/lib/guides";

export const whatIsDkim: Guide = {
  slug: "what-is-a-dkim-record",
  seoTitle: "What Is a DKIM Record? A Plain Guide for Business",
  h1: "What Is a DKIM Record? A Plain Guide for Small Business Owners",
  description:
    "A DKIM record publishes the public key that proves your email is genuine. Learn how DKIM works, what a record looks like, how to set it up and how to check it.",
  answer:
    "A DKIM record is a public key published in your domain's DNS. It lets receiving mail systems check the digital signature your mail system adds to each message, which shows the message came from a system holding your private key and was not altered in transit. A missing or broken record quietly weakens your email.",
  cluster: "What is DKIM",
  targetTerms: ["what is a dkim record", "dkim record explained", "how to set up dkim", "dkim selector explained", "check dkim record"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "A DKIM record is a small piece of public information in your domain's DNS. It holds a public key that lets anyone who receives your email check a digital signature your mail system adds to each message. If the signature checks out, the receiver knows the message was signed by a system that holds your private key, and that the signed parts were not changed on the way. DKIM stands for DomainKeys Identified Mail.",
    },
    {
      t: "p",
      x: "You do not need to understand cryptography to use it. You do need to know what the record is for, where it lives, what it looks like when it is healthy, and why a missing or broken one quietly weakens your email. This guide covers each of those, with a worked example, setup steps for the common mail platforms and the mistakes that cause most failures.",
    },
    {
      t: "note",
      title: "In one line",
      x: "SPF says which servers may send for you. DKIM proves a message really came from your domain. DMARC combines the two and tells receivers what to do with failures. You want all three. See the [wider guide to email security](/guides/email-security-small-business-australia).",
    },
  ],
  sections: [
    {
      id: "how-it-works",
      h2: "How DKIM works, in plain language",
      blocks: [
        { t: "p", x: "DKIM is defined in [RFC 6376](https://datatracker.ietf.org/doc/html/rfc6376). The idea is a wax seal on a letter, with the twist that anyone can check the seal but only you can make it." },
        {
          t: "ol",
          x: [
            "Your mail system holds a private key. Nobody else has it, and it never appears in DNS.",
            "When you send a message, your system takes selected headers and a fingerprint (hash) of the body, and signs them with the private key. The result is added as a DKIM-Signature header on the message.",
            "You publish the matching public key in DNS, at a name made from a selector and your domain.",
            "The receiving server reads the DKIM-Signature header, sees which domain and selector it names, fetches the public key from DNS and checks the signature.",
            "If it matches, the message passes DKIM. If someone altered the signed content in transit, or the signature was made with a different key, it fails.",
          ],
        },
        { t: "p", x: "Two things DKIM does not do are worth stating plainly. It does not encrypt the message, so it is not a privacy tool. And a pass does not say the message is wanted or safe, only that it was signed by a holder of the key for the named domain. A scammer with their own domain can sign their own mail correctly. What matters for you is that nobody can sign as your domain without your private key." },
      ],
    },
    {
      id: "what-record-looks-like",
      h2: "What a DKIM record looks like",
      blocks: [
        { t: "p", x: "A DKIM record sits at a name with the pattern selector._domainkey.yourdomain. The selector is a label your mail provider chooses, such as selector1, google or s1. It exists so you can have more than one key at a time, which makes key rotation possible." },
        {
          t: "example",
          title: "An example DKIM record (shortened, with a placeholder key)",
          x: [
            "Name: google._domainkey.yourbusiness.com.au",
            "Type: TXT",
            "Value: v=DKIM1; k=rsa; p=MIIBIjANBgkqh...(long public key)...IDAQAB",
            "v=DKIM1 marks it as a DKIM record. k=rsa is the key type. p= is the public key. If p= is empty, that key has been revoked on purpose.",
          ],
        },
        { t: "p", x: "Some providers, including Microsoft 365, ask you to publish a CNAME record instead of the key itself. A CNAME points your selector name at a record the provider controls. The advantage is that the provider can rotate keys without asking you to change DNS." },
        { t: "p", x: "The signature header on a real message looks like this in outline: DKIM-Signature: v=1; a=rsa-sha256; d=yourbusiness.com.au; s=google; h=from:to:subject:date; bh=...; b=... The d= tag is the signing domain and s= is the selector. Together they tell the receiver exactly where to look: s._domainkey.d." },
      ],
    },
    {
      id: "why-it-matters",
      h2: "Why a small business should care",
      blocks: [
        { t: "p", x: "There are three practical reasons." },
        {
          t: "ul",
          x: [
            "**It is half of what DMARC needs.** DMARC passes when SPF or DKIM passes and aligns with your From address. DKIM is the more reliable of the two, because SPF often breaks when mail is forwarded, and a DKIM signature usually survives forwarding if the message is not modified.",
            "**It helps your mail get delivered.** Google's sender guidelines expect authentication, and its rules for large senders require SPF, DKIM and DMARC. Even for a small sender, unsigned mail is easier for filters to distrust.",
            "**It makes forged invoices harder.** With DKIM and a DMARC policy of quarantine or reject, a forged message claiming your domain fails and is junked or refused. That matters if customers pay invoices by bank transfer. See [invoice fraud email scams](/guides/invoice-fraud-email-scams-australia).",
          ],
        },
      ],
    },
    {
      id: "setup",
      h2: "How to set up DKIM on common platforms",
      blocks: [
        { t: "p", x: "The steps differ by platform, but the shape is always the same: generate or find the key in your mail provider's admin screen, publish it in DNS, then switch signing on." },
        { t: "h3", x: "Microsoft 365" },
        { t: "p", x: "Microsoft 365 uses two CNAME records, selector1._domainkey and selector2._domainkey, which point to values the Defender portal shows you. You publish both, then enable signing for the domain in the portal. Microsoft signs automatically from your onmicrosoft.com address, but does not sign custom-domain mail until you do this. The full steps are in our [DMARC for Microsoft 365 guide](/guides/dmarc-for-microsoft-365)." },
        { t: "h3", x: "Google Workspace" },
        { t: "p", x: "In the Google Admin console, Gmail settings include an Authenticate email section. You generate a new record for your domain, copy the host name and the long TXT value to your DNS host, then press Start authentication. Google's default selector is google. If your DNS host limits the length of a text value, the key may need to be split into more than one quoted string, which most hosts handle for you." },
        { t: "h3", x: "Other senders on your behalf" },
        { t: "p", x: "Accounting packages, newsletter tools, job management apps and online booking systems often send email with your address in the From line. Each has its own domain authentication page. Complete it for your domain, otherwise the service signs with its own domain. The mail then passes DKIM for the vendor, not for you, and does not help your DMARC result." },
        { t: "h3", x: "Website hosts and cPanel" },
        { t: "p", x: "Many shared hosts include DKIM generation in the control panel under an email authentication or deliverability section. If your business email is hosted with your website, check there first." },
      ],
    },
    {
      id: "key-size",
      h2: "Key size, rotation and revocation",
      blocks: [
        { t: "p", x: "A DKIM key is an RSA key, and the size matters. RFC 8301 sets 1024 bits as the minimum acceptable, and many providers now default to or recommend 2048 bits. A 2048-bit public key is too long for a single text string in DNS, which limits each string to 255 characters, so it is published as two or more quoted strings that receivers join together. Good DNS hosts do this for you. If you paste a long key and it gets cut off, the record will fail." },
        { t: "p", x: "Rotation means replacing the key from time to time. If a private key were ever exposed, anyone who held it could sign mail as you until it was replaced. Having two selectors makes rotation safe: publish the new key under a new selector, switch signing to it, wait until old mail has been delivered, then remove or revoke the old one. Microsoft 365 handles this with its two selectors. For other platforms, a yearly review is a sensible habit, though your provider's guidance comes first." },
        { t: "p", x: "To retire a key, delete the record, or publish it with an empty p= value, which tells receivers the key has been revoked." },
      ],
    },
    {
      id: "check",
      h2: "How to check a DKIM record",
      blocks: [
        { t: "p", x: "There are two kinds of check, and you want both." },
        { t: "ol", x: [
          "**Check the record exists.** Our [email spoofing check](/tools/email-spoofing-check) and the [free security scan](/scan) look up your public DNS. A DKIM record can only be fetched if you know the selector, which is why tools check common selectors, and why a tool reporting not found does not always mean not set up. Confirm the selector in a real message header.",
          "**Check a real message.** Send an email from your account to a free webmail address. Open the original message or full headers and look for Authentication-Results. You want dkim=pass with header.d= showing your own domain. If you see dkim=pass for another domain, such as a vendor's, the message was signed by the vendor, not for you.",
        ] },
        { t: "p", x: "A pass on the first check with a fail on the second is a useful clue. It usually means the record is fine and the platform is not signing yet, or a different system is sending the message. Work through the table in the next section before you change a working record, because republishing a good key by hand can introduce the very error you were chasing." },
        { t: "p", x: "If you prefer the command line, a TXT lookup for selector._domainkey.yourdomain returns the key. On Windows, nslookup -type=TXT selector._domainkey.yourdomain works. On macOS and Linux, dig TXT selector._domainkey.yourdomain does the same." },
      ],
    },
    {
      id: "mistakes",
      h2: "The mistakes behind most DKIM failures",
      blocks: [
        {
          t: "table",
          caption: "Common DKIM problems",
          head: ["Problem", "What it looks like", "Fix"],
          rows: [
            ["Signing never switched on", "Record published but mail shows no DKIM-Signature", "Enable signing in the mail platform's admin screen"],
            ["Wrong hostname", "Record not found. Often the domain is doubled, such as selector1._domainkey.yourbusiness.com.au.yourbusiness.com.au", "Enter only the part before the domain if your DNS host adds it for you"],
            ["Key cut off", "Verification fails with a key syntax error", "Republish the full key, split into strings if the host requires it"],
            ["Third-party sender signs as itself", "dkim=pass but for the vendor's domain, so DMARC fails alignment", "Set up domain authentication at that service"],
            ["Message altered after signing", "dkim=fail on some messages only", "Mailing lists and some filters add footers. Rely on SPF or an approved forwarder."],
            ["Old key left in place", "Former provider's selector still published", "Remove selectors you no longer use after confirming nothing signs with them"],
          ],
        },
        { t: "p", x: "Once DKIM is passing and aligned for each sender, you are ready to move DMARC from monitoring to enforcement. The [DMARC and SPF setup guide](/products/dmarc-setup-guide) shows the safe order, and [how to stop email spoofing of your domain](/guides/stop-email-spoofing-my-domain) explains what to expect at each step." },
      ],
    },
    {
      id: "dkim-vs-spf",
      h2: "DKIM compared with SPF and DMARC",
      blocks: [
        {
          t: "table",
          caption: "The three records side by side",
          head: ["", "SPF", "DKIM", "DMARC"],
          rows: [
            ["What it checks", "The sending server's address", "A signature over the message", "That SPF or DKIM passed and matches the From domain"],
            ["Where it is published", "TXT on the domain", "TXT or CNAME at selector._domainkey", "TXT at _dmarc"],
            ["Survives forwarding", "Often not", "Usually, if the message is unchanged", "Passes if either underlying check does"],
            ["Tells receivers what to do on failure", "Only loosely", "No", "Yes: none, quarantine or reject"],
            ["Specification", "RFC 7208", "RFC 6376", "RFC 7489"],
          ],
        },
        { t: "p", x: "If you want more on the first of these, read [what an SPF record is](/guides/what-is-an-spf-record)." },
      ],
    },
  ],
  faq: [
    {
      q: "What is a DKIM record in simple terms?",
      a: "It is a public key published in your DNS that lets receiving mail servers check the digital signature on your outgoing email. A valid signature shows the message came from a system holding your private key and was not altered in transit.",
    },
    {
      q: "What is a DKIM selector?",
      a: "A selector is a label that identifies which key to use. It forms part of the DNS name where the key is published, in the pattern selector._domainkey.yourdomain. Having selectors lets a domain hold several keys at once, for different services or for rotation.",
    },
    {
      q: "How do I find my DKIM selector?",
      a: "Send an email to yourself at another provider and view the original message. In the DKIM-Signature header, the s= value is the selector and d= is the signing domain. Your mail provider's admin screen also shows the selector it uses.",
    },
    {
      q: "Is DKIM required?",
      a: "No law requires it, but it is part of a working email authentication setup. DMARC needs SPF or DKIM to pass with alignment, and Google's sender guidelines ask for authentication. For a business that sends invoices by email, it is worth doing.",
    },
    {
      q: "Does DKIM stop spoofing on its own?",
      a: "No. DKIM proves signed mail is genuine, but nothing in DKIM tells a receiver to reject unsigned mail claiming your domain. You need a DMARC policy of quarantine or reject for that.",
    },
    {
      q: "Is a 1024-bit DKIM key still acceptable?",
      a: "RFC 8301 sets 1024 bits as the minimum, so shorter keys are not valid. Many providers recommend 2048 bits, so choose that where your DNS host can publish it.",
    },
    {
      q: "Why does my DKIM check say not found when email works?",
      a: "DKIM records live at a selector name, and a tool has to know or guess the selector. If your provider uses an unusual selector, a scan may not find it. Look at a real message header to confirm the selector, then look it up directly.",
    },
  ],
  sources: [
    { label: "RFC 6376: DomainKeys Identified Mail (DKIM) Signatures", url: "https://datatracker.ietf.org/doc/html/rfc6376", note: "The DKIM specification, including selectors and the DKIM-Signature header" },
    { label: "RFC 8301: Cryptographic Algorithm and Key Usage Update to DKIM", url: "https://datatracker.ietf.org/doc/html/rfc8301", note: "Key size minimum of 1024 bits" },
    { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "How DMARC uses DKIM alignment" },
    { label: "RFC 7208: SPF", url: "https://datatracker.ietf.org/doc/html/rfc7208", note: "The companion record" },
    { label: "Microsoft Learn: How to use DKIM for email in your custom domain", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure", note: "selector1 and selector2 CNAME records and enabling signing" },
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
    label: "Check your records",
    href: "/tools/email-spoofing-check",
    text: "Look up what your domain publishes for SPF, DKIM and DMARC. The check reads public DNS only, touches nothing of yours and explains each result plainly.",
  },
};
