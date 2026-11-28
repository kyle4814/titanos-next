import type { Guide } from "@/lib/guides";

export const spfRecord: Guide = {
  slug: "what-is-an-spf-record",
  seoTitle: "What Is an SPF Record? Plain Guide for Business",
  h1: "What Is an SPF Record? A Plain Guide for Small Business, With Examples",
  description:
    "An SPF record lists the servers allowed to send email for your domain. Learn the syntax, the 10 lookup limit, ~all versus -all and how to fix common errors.",
  answer:
    "An SPF record is a line of text in your domain's DNS that lists the mail servers allowed to send email for your domain. Receivers check it and record a pass or fail. Watch the ten-lookup limit, and know that SPF alone cannot stop forged email, so pair it with DKIM and DMARC.",
  cluster: "What is SPF",
  targetTerms: ["what is an spf record", "spf record example", "spf record too many lookups", "spf softfail vs fail", "how to create an spf record"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "An SPF record is a line of text in your domain's DNS that lists which mail servers are allowed to send email for your domain. SPF stands for Sender Policy Framework. When a message arrives claiming to be from you, the receiving server looks up your SPF record, checks whether the server that delivered the message is on your list and records a pass or a fail.",
    },
    {
      t: "p",
      x: "It sounds simple, and it is, until a business has five services sending email and an SPF record that has grown by accident. This guide explains the syntax in plain words, shows examples, covers the ten-lookup limit that breaks many records, explains the difference between the endings ~all and -all and lists the errors that cause most failures. It also explains what SPF cannot do, because many owners expect more from it than it delivers.",
    },
    {
      t: "note",
      title: "Where SPF fits",
      x: "SPF is one of three records. DKIM signs messages, SPF lists senders, and DMARC ties both to the visible From address and sets the policy. On its own SPF does not stop a forged From line. See [how to stop email spoofing of your domain](/guides/stop-email-spoofing-my-domain) for the full set.",
    },
  ],
  sections: [
    {
      id: "how-it-works",
      h2: "How SPF works",
      blocks: [
        { t: "p", x: "SPF is defined in [RFC 7208](https://datatracker.ietf.org/doc/html/rfc7208). The check goes in four steps." },
        {
          t: "ol",
          x: [
            "A mail server connects to the receiver and says it has a message from someone at your domain. It gives an envelope sender address, also called the MAIL FROM or return path, along with its own IP address.",
            "The receiver looks up the TXT record on the domain in that envelope address and finds the one that starts with v=spf1.",
            "It checks whether the connecting IP address matches any rule in the record, working left to right.",
            "The first rule that matches decides the result: pass, fail, softfail, neutral. If nothing matches, the final term decides.",
          ],
        },
        { t: "p", x: "The key detail is that SPF checks the envelope sender, not the From address a person sees. A scammer can use their own domain in the envelope, pass SPF for it and still show your domain in the visible From line. DMARC closes that gap by requiring the two to align." },
      ],
    },
    {
      id: "syntax",
      h2: "SPF syntax in plain words",
      blocks: [
        { t: "p", x: "An SPF record is one line. It starts with a version tag, lists mechanisms that say who may send and ends with a rule for everyone else." },
        {
          t: "example",
          title: "A typical SPF record",
          x: [
            "v=spf1 ip4:203.0.113.25 include:spf.protection.outlook.com include:_spf.example-crm.com ~all",
            "v=spf1 is the version tag. ip4: allows one server address, here a documentation example. Each include: borrows another organisation's list, for example your mail provider's. ~all is the closing rule.",
          ],
        },
        {
          t: "table",
          caption: "The pieces of an SPF record",
          head: ["Piece", "What it means", "Notes"],
          rows: [
            ["v=spf1", "This is an SPF record", "Must be first"],
            ["ip4: and ip6:", "Allow this address or range", "Cheap, no extra DNS lookup"],
            ["a", "Allow the address of the domain's own A record", "Counts as a lookup"],
            ["mx", "Allow the domain's mail servers", "Counts as a lookup"],
            ["include:", "Also allow whatever the named domain's SPF record allows", "Counts as a lookup, plus any lookups inside it"],
            ["redirect=", "Use another domain's whole record instead", "Counts as a lookup"],
            ["all", "Matches everything else, used last", "Preceded by a qualifier, see below"],
          ],
        },
        { t: "p", x: "Each mechanism can carry a qualifier in front. A plus means pass and is the default. A minus means fail. A tilde means softfail. A question mark means neutral. You will most often see the tilde and the minus on the closing all." },
      ],
    },
    {
      id: "softfail",
      h2: "~all or -all: which should you use?",
      blocks: [
        {
          t: "table",
          caption: "The closing rule",
          head: ["Ending", "Name", "What you are telling receivers"],
          rows: [
            ["-all", "Fail (hard fail)", "Mail from anywhere not listed is not authorised"],
            ["~all", "Softfail", "Mail from anywhere not listed is probably not authorised, but treat it with suspicion rather than reject it outright"],
            ["?all", "Neutral", "No opinion"],
            ["+all", "Pass", "Anyone may send as this domain. Never use this."],
          ],
        },
        { t: "p", x: "Many mail systems treat ~all and -all alike in practice and let DMARC make the call. Once DMARC is published at quarantine or reject, the receiver's decision is driven by DMARC and SPF is one input. Common practice is to use ~all while you are still finding every sender and -all when you are sure the list is complete. Both are acceptable. The one to avoid is +all, which authorises the entire internet, and a record with no closing term at all." },
        { t: "p", x: "One caution on -all: it can cause legitimate forwarded mail to fail SPF, because a forwarding server is not on your list. DMARC lets DKIM rescue the message in that case, which is a good reason to set up [DKIM](/guides/what-is-a-dkim-record) as well." },
      ],
    },
    {
      id: "lookup-limit",
      h2: "The ten lookup limit",
      blocks: [
        { t: "p", x: "RFC 7208 limits an SPF check to ten DNS lookups. Mechanisms that need a DNS query count toward the limit: include, a, mx, ptr, exists and redirect. The ip4 and ip6 mechanisms do not. Lookups inside an included record count too, so one include for a large provider can use several. If a check needs more than ten, the result is a permanent error, and receivers may treat the message as failing SPF even though every sender is legitimate." },
        { t: "p", x: "This catches growing businesses. A record starts with Microsoft 365 or Google, then adds an accounting package, a newsletter tool, a CRM, a booking system and a helpdesk. Each include is a lookup and some add several more." },
        { t: "h3", x: "How to stay under the limit" },
        {
          t: "ul",
          x: [
            "**Remove services you no longer use.** Old includes are the most common cause. Check each one against your sender list.",
            "**Replace a, mx and include with ip4 where addresses are fixed.** Only do this for servers whose addresses will not change, and not for cloud providers who change them often.",
            "**Move marketing and bulk services to a subdomain.** Send newsletters from news.yourbusiness.com.au with its own SPF record. The subdomain has its own count of ten.",
            "**Prefer DKIM for third-party senders.** A service that signs with your domain passes DMARC through DKIM, so it does not need to be in your SPF record at all.",
            "**Consider SPF flattening tools only with care.** They replace includes with address lists and need to be kept up to date, or the record goes stale and legitimate mail fails.",
          ],
        },
        { t: "p", x: "Our [email spoofing check](/tools/email-spoofing-check) shows the record it finds. Count the includes in it. A record with more than six or seven is worth a review." },
      ],
    },
    {
      id: "examples",
      h2: "Examples for common setups",
      blocks: [
        { t: "p", x: "Always take the include value from your provider's own help page, because they change. The examples below use the values published by Microsoft and show the shape. Others are placeholders." },
        {
          t: "table",
          caption: "Example SPF records",
          head: ["Setup", "Example record"],
          rows: [
            ["Microsoft 365 only", "v=spf1 include:spf.protection.outlook.com -all"],
            ["Microsoft 365 plus one other service", "v=spf1 include:spf.protection.outlook.com include:_spf.vendor.example ~all"],
            ["A domain that never sends email", "v=spf1 -all"],
            ["Your own server at a fixed address plus Microsoft 365", "v=spf1 ip4:203.0.113.25 include:spf.protection.outlook.com ~all"],
          ],
        },
        { t: "p", x: "The second to last row is worth copying onto every domain you own but do not send from, such as an old trading name. Pair it with a DMARC record of v=DMARC1; p=reject on the same domain. Microsoft recommends both for parked domains." },
        { t: "p", x: "Google Workspace and other providers publish their own include values. Use theirs exactly, and use only one SPF record on the domain. If you already have an SPF record and want to add a service, edit the record you have. Do not add a second." },
      ],
    },
    {
      id: "errors",
      h2: "The mistakes behind most SPF problems",
      blocks: [
        {
          t: "table",
          caption: "Common SPF errors",
          head: ["Problem", "Symptom", "Fix"],
          rows: [
            ["Two SPF records on one domain", "Permanent error, receivers may ignore SPF", "Merge them into one"],
            ["More than ten lookups", "Permanent error even though senders are genuine", "Trim includes, move bulk senders to a subdomain"],
            ["A service sends but is not listed", "SPF fails for that service's mail", "Add the vendor's include, or use DKIM for that sender"],
            ["Record not at the domain root", "SPF not found", "Publish at the bare domain, not a subdomain, unless you intend a subdomain record"],
            ["Typing mistakes", "A record that starts v=spf instead of v=spf1, or a missing space between terms", "Retype carefully and test"],
            ["Using +all", "Anyone may send as you", "Change to ~all or -all"],
            ["Using the old SPF record type", "Receivers read TXT records", "Publish SPF as TXT. The separate SPF record type was deprecated by RFC 7208."],
            ["Forgetting subdomains that send", "Mail from a subdomain fails", "Give each sending subdomain its own SPF record"],
          ],
        },
        { t: "p", x: "A permanent error is called a permerror in the specification. Check your DMARC reports or message headers for spf=permerror, which is a sure sign of one of the first two issues." },
      ],
    },
    {
      id: "limits",
      h2: "What SPF cannot do",
      blocks: [
        {
          t: "ul",
          x: [
            "**It does not check the From address people see.** That is DMARC's job through alignment.",
            "**It breaks when mail is forwarded.** The forwarding server is not on your list, so SPF fails for the forwarded copy. DKIM usually survives.",
            "**It does not stop lookalike domains.** A scammer's own domain passes its own SPF.",
            "**It does not stop a hacked mailbox.** Mail from a compromised account comes from your authorised servers.",
            "**It says nothing about the content of a message.** A pass does not mean wanted or safe.",
          ],
        },
        { t: "p", x: "None of this makes SPF pointless. It is a cheap, standard signal that receivers expect, and it is half of what DMARC needs. For the full path, our [DMARC for Microsoft 365 guide](/guides/dmarc-for-microsoft-365) shows a safe rollout, and the [DMARC and SPF setup guide](/products/dmarc-setup-guide) gives the exact records. If your concern is forged invoices, read [invoice fraud email scams](/guides/invoice-fraud-email-scams-australia)." },
      ],
    },
    {
      id: "how-to-create",
      h2: "How to create or fix your SPF record",
      blocks: [
        {
          t: "ol",
          x: [
            "Look up your current record with the [email spoofing check](/tools/email-spoofing-check). Copy what is there before you change anything.",
            "List every service that sends mail as your domain. Include your mailboxes, accounting, quoting, website forms, newsletters and printers.",
            "For each one, find the vendor's SPF instructions and note the include value or address.",
            "Write one record: v=spf1, then your mechanisms, then ~all or -all.",
            "Count the lookups. Stay at ten or under, and preferably well under.",
            "Edit the existing TXT record at your DNS host. Do not add a second.",
            "Check the result and send a test message to an outside address. In the headers look for spf=pass.",
            "Publish DMARC at p=none and read the reports so you catch any sender you missed.",
          ],
        },
        { t: "p", x: "If you would rather have the records checked for you, the [Instant Email Domain Check](/offers/instant-email-domain-check) gives a written report from public records, and the [Compliance Monitor](/monitor) keeps checking so a new tool does not quietly push you over the limit." },
      ],
    },
  ],
  faq: [
    {
      q: "What is an SPF record?",
      a: "It is a TXT record in your domain's DNS that lists the servers allowed to send email for your domain. Receiving servers check it to decide whether a message came from an authorised sender. It begins with v=spf1 and usually ends with ~all or -all.",
    },
    {
      q: "What is the difference between ~all and -all?",
      a: "-all is a hard fail: mail from servers not listed is not authorised. ~all is a softfail: such mail is probably not authorised but should be treated with suspicion, not rejected on SPF alone. Both are acceptable, and DMARC makes the final call. Never use +all.",
    },
    {
      q: "Can I have two SPF records?",
      a: "No. Two records beginning v=spf1 on the same domain cause a permanent error, and receivers may ignore SPF altogether. Merge everything into a single record.",
    },
    {
      q: "What does too many DNS lookups mean for SPF?",
      a: "RFC 7208 allows a maximum of ten lookups per SPF check. Include, a, mx, ptr, exists and redirect each count, including lookups inside included records. Going over gives a permerror. Trim unused includes or use a subdomain for bulk senders.",
    },
    {
      q: "Does SPF stop spoofing on its own?",
      a: "No. SPF checks the envelope sender, not the From address people see, so a scammer can pass SPF for their own domain while showing yours. DMARC at quarantine or reject is what ties the two together.",
    },
    {
      q: "Do I need an SPF record for a domain that does not send email?",
      a: "Yes, it is a good idea. Publish v=spf1 -all and a DMARC record of p=reject so nobody can forge mail from the domain. This is Microsoft's recommended approach for parked domains.",
    },
    {
      q: "How long does an SPF change take?",
      a: "It depends on the record's TTL, the time DNS caches are kept. Many are set to between a few minutes and a few hours. Allow up to a day for the change to be seen everywhere and check again after that.",
    },
  ],
  sources: [
    { label: "RFC 7208: Sender Policy Framework (SPF)", url: "https://datatracker.ietf.org/doc/html/rfc7208", note: "The specification, including the limit of 10 DNS lookups and permerror" },
    { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "How DMARC uses SPF alignment" },
    { label: "RFC 6376: DKIM Signatures", url: "https://datatracker.ietf.org/doc/html/rfc6376", note: "The companion record" },
    { label: "Microsoft Learn: Set up DMARC to validate email in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure", note: "Parked domains and staged rollout" },
    { label: "Google: Email sender guidelines", url: "https://support.google.com/a/answer/81126", note: "Authentication expectations for senders" },
  ],
  related: {
    posts: ["can-someone-send-email-pretending-to-be-my-business", "anz-smb-email-security-double-gap-measured", "invoice-scam-tradies"],
    tools: [
      { label: "Email spoofing check", href: "/tools/email-spoofing-check", blurb: "Look up your domain's public SPF, DKIM and DMARC records." },
      { label: "Free security scan", href: "/scan", blurb: "Reads your public settings and explains each result." },
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
    label: "Look up your SPF record",
    href: "/tools/email-spoofing-check",
    text: "See the SPF record your domain publishes today, and whether DKIM and DMARC sit alongside it. The check reads public DNS only and explains each result in plain words.",
  },
};
