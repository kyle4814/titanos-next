import type { Guide } from "@/lib/guides";

export const invoiceFraudEmail: Guide = {
  slug: "invoice-fraud-email-scams-australia",
  seoTitle: "Invoice Fraud Email Scams in Australia: Guide",
  h1: "Invoice Fraud Email Scams in Australia: How They Work and How to Protect Your Business",
  description:
    "How invoice fraud and fake bank detail emails work in Australia, the warning signs, controls that stop payment diversion and what to do if money has been sent.",
  answer:
    'Invoice fraud happens when a criminal sends a fake invoice, or a note that bank details have changed, and someone pays it. The best controls cost nothing: confirm any change of bank details by calling a known number, require a second check on payments, and protect your own domain from spoofing. If you have paid, contact your bank straight away.',
  cluster: "Invoice fraud",
  targetTerms: ["invoice fraud email scam australia", "fake invoice email scam", "change of bank details email scam", "business email compromise australia", "scamwatch false billing"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "Invoice fraud by email is one of the oldest business scams and it keeps working because it looks like ordinary admin. A message arrives that appears to come from a supplier, a tradie, an accountant or a customer. It carries an invoice, or a polite note saying the bank details have changed. Someone in your office pays it. The money goes to a criminal's account instead of the real one, and by the time the genuine supplier asks where the payment is, it has moved on.",
    },
    {
      t: "p",
      x: "The Australian Competition and Consumer Commission runs Scamwatch, which publishes warnings on these scams under headings such as false billing and business email compromise, and takes reports from businesses and the public. This guide explains the common forms of invoice fraud, how to tell them apart, the controls that stop most of them and what to do straight away if you have already paid. It is written for owners and office staff, not IT specialists, and the most effective protections cost nothing.",
    },
    {
      t: "note",
      title: "The one rule that stops most of it",
      x: "Never act on a change of bank details from an email alone. Confirm it by phone, using a number you already hold from a past invoice, contract or your own records, never the number in the email. Write the rule down and make it apply to everyone, including the owner.",
    },
  ],
  sections: [
    {
      id: "types",
      h2: "The four common forms",
      blocks: [
        { t: "p", x: "Invoice fraud is not one trick. It comes in several forms, and each calls for a slightly different defence." },
        { t: "h3", x: "1. The fake invoice" },
        { t: "p", x: "A bill arrives for something you did not order, or for a service you might plausibly have used, such as a domain renewal, directory listing, stationery or software. It is designed to be paid by a busy person who assumes someone else ordered it. The sender is a stranger, and the invoice is entirely invented." },
        { t: "h3", x: "2. The changed bank details" },
        { t: "p", x: "This is the more damaging form. A real supplier you already pay is impersonated. An email says that their bank account has changed and asks you to pay future invoices to the new account. The message may be a forgery of the supplier's address, or it may come from the supplier's own hacked mailbox. The invoice itself may be a real one, copied and altered." },
        { t: "h3", x: "3. The intercepted real invoice" },
        { t: "p", x: "A criminal has access to a mailbox, yours or the supplier's, and watches for invoices. When one is about to be sent or has just been sent, they send a replacement with different bank details, often in the same email thread, a few minutes apart. Everything about the message looks right because it is a genuine reply in a genuine conversation." },
        { t: "h3", x: "4. The impersonated senior person" },
        { t: "p", x: "An email appears to come from the owner or a director and asks someone in accounts to pay an urgent invoice or change a payee. The message may be a spoof of the executive's address or a lookalike. The pressure is the giveaway: it asks for secrecy, speed or a skipped process." },
        { t: "p", x: "Scamwatch groups several of these under false billing and business email compromise. See the ACCC's [Scamwatch site](https://www.scamwatch.gov.au/types-of-scams) for the current descriptions and reports." },
      ],
    },
    {
      id: "how-delivered",
      h2: "How the email gets in front of you",
      blocks: [
        { t: "p", x: "It helps to know the three routes, because each is stopped by a different control." },
        {
          t: "table",
          caption: "How a fraudulent invoice email reaches you",
          head: ["Route", "How it works", "What stops it"],
          rows: [
            ["Domain spoofing", "The From address shows your supplier's real domain, but the message did not come from their servers", "Their SPF, DKIM and DMARC at p=reject, and your mail provider honouring it"],
            ["Lookalike domain", "The attacker registers a near copy, such as an added letter or a hyphen, and sends from it", "Careful reading of the address, and a phone call rule"],
            ["Hacked mailbox", "The message comes from the supplier's real account, after a password was stolen", "Multi-factor authentication at their end, and a phone call rule at yours"],
          ],
        },
        { t: "p", x: "Only the first route is a technical email-authentication problem. For that one, your own business is on both sides. You want your suppliers to protect their domains so that forged mail claiming them is refused. And you want your own domain protected, so your customers cannot be tricked with a forged invoice in your name. See [how to stop email spoofing of your domain](/guides/stop-email-spoofing-my-domain) for that half." },
        { t: "p", x: "The other two routes pass authentication, because the mail is genuine from the sender's point of view. A phone call rule is the control that works against them." },
      ],
    },
    {
      id: "signs",
      h2: "Warning signs to train staff to notice",
      blocks: [
        { t: "p", x: "No single sign proves fraud, and a good forgery will avoid most of them. Together they are a prompt to pause and verify." },
        {
          t: "ul",
          x: [
            "A request to change bank details, especially close to a payment date.",
            "A new account at a different bank, or a personal account for a business supplier.",
            "An account name that does not match the business name on the invoice.",
            "Pressure to pay urgently, or a request to keep it confidential.",
            "A slightly different email address or display name from earlier messages. On a phone, check the full address, not only the name.",
            "An invoice for an amount or goods that does not fit the job, or no purchase order or job number.",
            "A reply-to address that differs from the sender's address.",
            "A request to pay in gift cards or cryptocurrency, which is never a normal supplier request.",
            "Different wording, layout or logo quality from the supplier's usual invoices.",
          ],
        },
        { t: "p", x: "Also watch for what is missing. A real supplier who changes banks will usually be happy to confirm on the phone, because it protects them too. A scammer will often resist, delay or say they are unreachable." },
      ],
    },
    {
      id: "controls",
      h2: "Controls that work for a small business",
      blocks: [
        { t: "p", x: "You do not need new software for most of these. They are rules that cost minutes." },
        {
          t: "ol",
          x: [
            "**The callback rule.** Any new payee, or a change to an existing payee's bank details, is confirmed by phone with the supplier, using a number from your own records. Not the number in the email, and not a number supplied in the same message.",
            "**Two people on changes.** One person enters or changes payee details, a second approves them. For a one-person business, the rule is to wait a day and re-check.",
            "**Check the account name.** Where your bank shows the name linked to a payee account number when you set it up, compare it to the supplier's name. A mismatch is a reason to stop.",
            "**Pay a small test amount first** where the supplier agrees and the amount is large, then confirm by phone that it arrived.",
            "**Keep a payee list.** A simple list of regular suppliers and their confirmed bank details makes a changed one stand out.",
            "**Multi-factor authentication on every mailbox.** It stops the most dangerous route, a hacked account. Turn it on for email, accounting software and online banking.",
            "**Check mailbox rules.** After any suspected compromise, look for forwarding rules or hidden folder rules that send copies of mail to an outside address.",
            "**Write the rule down.** A one-page procedure that new staff read on day one works better than an unwritten habit.",
          ],
        },
        { t: "p", x: "If you send invoices yourself, make it easy for your customers to avoid being fooled in your name. State on your invoices, and on your website, that you will never change bank details by email alone and that customers should phone you on your published number to confirm any change. That one line has saved businesses from becoming the vehicle for a forged invoice in their name." },
      ],
    },
    {
      id: "technical",
      h2: "The email security half: protecting your domain",
      blocks: [
        { t: "p", x: "If a criminal forges your domain on an invoice, your customer pays the criminal and blames you, even though you did nothing wrong. Email authentication reduces this risk for your exact domain." },
        {
          t: "ul",
          x: [
            "**SPF** lists the servers that may send as you. See [what an SPF record is](/guides/what-is-an-spf-record).",
            "**DKIM** signs each message so a receiver can confirm it came from your domain. See [what a DKIM record is](/guides/what-is-a-dkim-record).",
            "**DMARC** tells receivers what to do with mail that fails. At p=quarantine or p=reject, forged mail claiming your exact domain is junked or refused. For Microsoft 365 users, see [DMARC for Microsoft 365](/guides/dmarc-for-microsoft-365).",
          ],
        },
        { t: "p", x: "You can see where your domain stands in under a minute with our [email spoofing check](/tools/email-spoofing-check). Remember its limits: authentication does not stop lookalike domains or hacked mailboxes, which is why the phone call rule matters just as much. Our post on [invoice scams aimed at tradies](/blog/invoice-scam-tradies) and the one for [accountants and bookkeepers](/blog/the-bank-details-email-accountants-and-bookkeepers) show how this plays out in two trades." },
      ],
    },
    {
      id: "paid",
      h2: "If you have already paid a fraudulent invoice",
      blocks: [
        { t: "p", x: "Speed matters more than anything else in the first hours. Work down this list in order." },
        {
          t: "ol",
          x: [
            "**Call your bank straight away.** Ask for the fraud team and ask them to recall the payment and contact the receiving bank. Banks can sometimes freeze funds that have not yet been moved on. Do not wait until the next business day if you can reach them now.",
            "**Tell the real supplier or customer.** Ring them on a number you already trust. Confirm what they did and did not send, and warn them their mailbox may be compromised.",
            "**Secure your own accounts.** Change passwords on email and accounting software, turn on multi-factor authentication, and look for forwarding rules and unfamiliar sign-ins.",
            "**Keep the evidence.** Save the original emails with full headers, the bank details, payment receipts and a note of times and phone calls. Do not delete anything.",
            "**Report it.** In Australia, cybercrime can be reported through the Australian Cyber Security Centre's [ReportCyber](https://www.cyber.gov.au/report-and-recover/report). Scams can also be reported to [Scamwatch](https://www.scamwatch.gov.au/report-a-scam). Reports help authorities spot patterns and may support your bank's recall request.",
            "**Think about privacy.** If personal information about customers was in a compromised mailbox, the notifiable data breach rules may apply. Read our [Privacy Act guide](/guides/privacy-act-small-business-australia) and the [breach response runbook](/products/breach-response-runbook).",
            "**Tell your insurer** if you hold cyber or crime cover, and check your policy's notification period.",
          ],
        },
        { t: "p", x: "Recovery is not guaranteed. The sooner the bank is called, the better the chance. Prevention is cheaper than any recovery." },
      ],
    },
    {
      id: "templates",
      h2: "Wording you can use",
      blocks: [
        { t: "p", x: "Plain, calm wording makes the phone rule easier to apply, because nobody feels accused. These are examples to adapt." },
        {
          t: "example",
          title: "A line for your invoices and email signature",
          x: [
            "We will never change our bank details by email. If you receive a message asking you to pay a different account, please ring us on the number on our website before you pay.",
          ],
        },
        {
          t: "example",
          title: "A reply to a supplier who emails new bank details",
          x: [
            "Thanks for letting us know. Our process is to confirm any bank detail change by phone before we update it. I will ring you on the number we have on file today.",
          ],
        },
        { t: "p", x: "The second reply costs nothing, keeps the relationship friendly and puts the control in your hands. A genuine supplier will agree. If the email was fake, the reply goes to the criminal and nothing further happens." },
      ],
    },
  ],
  faq: [
    {
      q: "What is an invoice fraud email scam?",
      a: "It is an email that gets a business to pay money to a criminal by posing as a supplier, customer or senior colleague. It may be a fake invoice, a real invoice with altered bank details or a message saying that bank details have changed. Scamwatch lists these under false billing and business email compromise.",
    },
    {
      q: "How do I know if an invoice email is a scam?",
      a: "Check for a change of bank details, an account name that does not match the supplier, an email address that differs slightly from usual, pressure to pay quickly and a request to keep it quiet. The safest test is to phone the supplier on a number you already hold and confirm.",
    },
    {
      q: "Can a scammer send an email from my supplier's real address?",
      a: "Only if the supplier's domain lacks enforced DMARC, or the scammer has taken over a real mailbox. In the first case the message is forged. In the second it is genuine mail from a compromised account. A phone call catches both.",
    },
    {
      q: "I paid a scammer. Can I get the money back?",
      a: "Sometimes. Ring your bank immediately and ask for a recall, then report to ReportCyber and Scamwatch. Success depends on how fast you act and whether the money has already moved. No one can promise recovery.",
    },
    {
      q: "Does DMARC stop invoice fraud?",
      a: "It stops one route, a forged message claiming an exact domain with an enforced policy. It does not stop lookalike domains or hacked mailboxes. Combine it with multi-factor authentication and a phone confirmation rule.",
    },
    {
      q: "Is a change of bank details email always a scam?",
      a: "No, genuine suppliers do change banks. That is why the rule is to confirm by phone, not to refuse. The email is never enough on its own.",
    },
    {
      q: "Do I have to report an invoice scam?",
      a: "There is no general obligation to report every scam, but reporting is encouraged and helps your bank and the authorities. If personal information was exposed, the notifiable data breach scheme may require a notification, so check the Privacy Act guidance.",
    },
  ],
  sources: [
    { label: "Scamwatch (ACCC): Types of scams", url: "https://www.scamwatch.gov.au/types-of-scams", note: "Current descriptions of false billing and business email compromise scams" },
    { label: "Scamwatch (ACCC): Report a scam", url: "https://www.scamwatch.gov.au/report-a-scam", note: "How to report" },
    { label: "ACSC: Report and recover", url: "https://www.cyber.gov.au/report-and-recover/report", note: "ReportCyber, the national cybercrime reporting service" },
    { label: "OAIC: Notifiable data breaches", url: "https://www.oaic.gov.au/privacy/notifiable-data-breaches", note: "When a breach must be notified" },
    { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489", note: "The standard that lets domain owners ask receivers to reject forged mail" },
    { label: "Titanos: Invoice scams and tradies", url: "https://titanos.tech/blog/invoice-scam-tradies", note: "The same scam seen from the trades" },
  ],
  related: {
    posts: ["invoice-scam-tradies", "the-bank-details-email-accountants-and-bookkeepers", "settlement-day-scam-property-and-conveyancing", "can-someone-send-email-pretending-to-be-my-business"],
    tools: [
      { label: "Email spoofing check", href: "/tools/email-spoofing-check", blurb: "Look up your domain's public SPF, DKIM and DMARC records." },
      { label: "Free security scan", href: "/scan", blurb: "Reads your public settings and explains each result." },
      { label: "Scam Shield for Tradies", href: "/offers/scam-shield-for-tradies", blurb: "Monthly check, fix list and a notice customers can trust." },
    ],
    products: [
      { label: "Email Spoofing Self-Check Checklist", href: "/products/spoofguard-self-check-checklist", blurb: "Ten checks using public records only." },
      { label: "Breach Response Runbook", href: "/products/breach-response-runbook", blurb: "What to do in the first hours after a breach." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Check whether your domain can be forged",
    href: "/tools/email-spoofing-check",
    text: "Customers who receive a forged invoice in your name blame you. See in a minute whether your domain is protected. The check reads public DNS only and explains each result plainly.",
  },
};
