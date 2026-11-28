// SEO lane 20: eight industry pages (accountants, law firms, real estate, medical and allied health,
// plumbers, electricians, builders, cleaners). Each entry carries its own risks, domain checks, privacy
// position and FAQs. Nothing is templated by swapping a noun.
// Numbers: the only figures on these pages are ones that trace to a file in this repo or to a named public
// source (AFP, OAIC, RFC 7208, Privacy Act 1988). Anything else is described in words, never counted.
// Sources are either a URL already used elsewhere on the site or a named instrument cited without a link.

export type Faq = { q: string; a: string };
export type Source = { label: string; href?: string };
export type Risk = { t: string; b: string };
export type Link = { href: string; label: string; note: string };

export type IndustryPage = {
  slug: string;
  label: string; // short plural, for hub cards and crumbs
  title: string; // 60 chars or fewer
  description: string; // 140 to 160 chars
  h1: string;
  eyebrow: string;
  lede: string;
  why: string[];
  risksHeading: string;
  risks: Risk[];
  domainHeading: string;
  domainIntro: string;
  domainChecks: string[];
  privacyHeading: string;
  privacy: string[];
  automationHeading: string;
  automation: string[];
  links: Link[];
  faq: Faq[];
  sources: Source[];
  keyword: string;
  reviewed: string;
  published: string;
};

const ACT = "https://www.legislation.gov.au/C2004A03712/latest/text";
const SPAM_ACT = "https://www.legislation.gov.au/C2004A01214/latest/text";
const OAIC_SMALL = "https://www.oaic.gov.au/privacy/privacy-for-organisations/small-business";
const OAIC_NDB = "https://www.oaic.gov.au/privacy/notifiable-data-breaches/about-the-notifiable-data-breaches-scheme";
const ACMA = "https://www.acma.gov.au/avoid-sending-spam";
const SCAMWATCH = "https://www.scamwatch.gov.au";
const REPORTCYBER = "https://www.cyber.gov.au/report-and-recover/report";
const RFC7208 = "https://datatracker.ietf.org/doc/html/rfc7208";
const RFC7489 = "https://datatracker.ietf.org/doc/html/rfc7489";
const AFP_BEC = "https://www.afp.gov.au/news-centre/media-release/criminals-target-construction-sector-business-email-compromise-scams";
const DIGITAL_HEALTH = "https://www.digitalhealth.gov.au/healthcare-providers/cyber-security/managing-cyber-security-threats";

const S_ACT: Source = { label: "Privacy Act 1988 (Cth), Federal Register of Legislation", href: ACT };
const S_SMALL: Source = { label: "OAIC: small business and the Privacy Act", href: OAIC_SMALL };
const S_NDB: Source = { label: "OAIC: about the Notifiable Data Breaches scheme", href: OAIC_NDB };
const S_SCAM: Source = { label: "Scamwatch (ACCC)", href: SCAMWATCH };
const S_RC: Source = { label: "ACSC: ReportCyber", href: REPORTCYBER };
const S_SPF: Source = { label: "RFC 7208: Sender Policy Framework (SPF)", href: RFC7208 };
const S_DMARC: Source = { label: "RFC 7489: DMARC", href: RFC7489 };
const S_SPAM: Source = { label: "ACMA: avoid sending spam (Spam Act 2003)", href: ACMA };
const S_SPAMACT: Source = { label: "Spam Act 2003, Federal Register of Legislation", href: SPAM_ACT };

const SCAN: Link = { href: "/scan", label: "Free email security scan", note: "Public DNS records only, nothing touched" };
const SPOOF: Link = { href: "/tools/email-spoofing-check", label: "Email spoofing check", note: "Can someone send as your domain?" };
const DMARC_SETUP: Link = { href: "/email-security/setup", label: "DMARC setup guides", note: "Step by step for your email provider" };
const BREACH: Link = { href: "/privacy-act/notifiable-data-breaches", label: "Notifiable data breaches", note: "What the scheme asks of you" };
const EXEMPT: Link = { href: "/privacy-act/small-business-exemption", label: "Small business exemption", note: "Does the Privacy Act cover you?" };
const CALC: Link = { href: "/tools/missed-call-calculator", label: "Missed call calculator", note: "Free, runs in your browser" };

export const INDUSTRY_PAGES: IndustryPage[] = [
  {
    slug: "accountants",
    label: "Accountants",
    title: "Email Security for Australian Accountants | TITANOS",
    description: "Why client refund details, tax file numbers and ATO lookalike emails make accounting firms a target, and the free check that shows if your domain can be faked.",
    h1: "Email security for Australian accounting practices",
    eyebrow: "Accountants and tax agents",
    lede: "An accounting practice holds the three things a fraudster wants in one inbox: a client's tax file number, their bank details and a reason for them to trust an email that looks like it came from you. This page covers what is different about your risk, what to check on your domain, and a free scan that reads only public records.",
    why: [
      "Most small businesses are worried about someone pretending to be a supplier. A practice has a second problem, which is someone pretending to be you. Your clients are used to receiving requests from you for documents, signatures and bank details, and they act on them. A forged email in your name, sent from a lookalike domain or from your own domain if it is not locked down, asks for exactly what clients expect to be asked for.",
      "Tax file numbers add a legal layer. The Notifiable Data Breaches scheme extends to tax file number recipients for the information they hold, so a practice should not assume the usual small business exemption settles the question. Confirm your position with your adviser, and treat the email setup as part of how you keep client TFNs safe.",
      "Busy seasons matter too. Lodgement deadlines mean staff are working fast, clients are sending documents from personal accounts and new bookkeeping software is connected to your domain in a hurry. Each new tool that sends email as your practice is one more place a setting can be wrong.",
    ],
    risksHeading: "Four risks specific to accounting practices",
    risks: [
      { t: "Refund and bank detail change requests", b: "A message that appears to come from a client, asking you to pay a refund to a new account, is a standard business email compromise pattern. The control is a call to a number you already hold, not a reply to the email." },
      { t: "Someone sending as your practice", b: "If your domain has no enforced DMARC policy, a criminal can send a request for client documents that passes as yours. Clients cannot tell. The check below shows whether your domain allows it." },
      { t: "Document portals and shared links", b: "Practices use portals, e-signature tools and file-sharing links. A forged 'your documents are ready' email that points to a fake login page harvests credentials. Telling clients exactly which sender and link style you use makes the fake easier to spot." },
      { t: "Impersonation of the tax office", b: "Scam emails and texts that claim to be from a government agency target both clients and practices. Scamwatch publishes current examples, and ReportCyber takes reports." },
    ],
    domainHeading: "What to check on an accounting practice's domain",
    domainIntro: "These are all visible in public DNS records, which is why the free scan can read them without touching anything of yours.",
    domainChecks: [
      "Does the domain have a DMARC record, and is its policy still at monitoring only (p=none) or does it quarantine or reject spoofed mail? Monitoring only blocks nothing.",
      "Does the SPF record list every system that sends as your practice (email provider, practice management, portal, e-sign, newsletter) and stay under the 10 DNS lookup limit set by RFC 7208? Too many lookups makes SPF fail for everyone.",
      "Does each sending tool sign with DKIM using your domain, so that a message can be proven to come from you?",
      "Do your retired and parked domains, such as an old trading name, have a record that says 'no mail is sent from here'?",
    ],
    privacyHeading: "Privacy position for a practice",
    privacy: [
      "Because the practice receives and stores client tax file numbers, treat the Privacy Act and the Notifiable Data Breaches scheme as applying to you. An eligible data breach has to be assessed within 30 days of becoming aware of the suspicion, and the OAIC and affected people are notified where the scheme requires it. Our guide to the scheme sets out the steps in plain words.",
      "Confirm your own position with your professional body or adviser. This page is general information and not legal advice.",
    ],
    automationHeading: "Where automation helps without adding risk",
    automation: [
      "Document chasing is the obvious candidate: a polite reminder sequence for missing records, sent from your own domain as service messages, saves hours in the weeks before lodgement. Keep it to existing clients and service messages, and read the ACMA guidance on the Spam Act before any marketing email.",
      "Nothing about this replaces a person. The reminder goes out automatically, the client's reply lands with the person who knows the file.",
    ],
    links: [SCAN, SPOOF, DMARC_SETUP, BREACH],
    faq: [
      { q: "Does my practice need DMARC?", a: "Nothing in the law names DMARC. It is the standard way to stop others sending email that claims to be from your domain, and a practice that holds client bank details and TFNs has the strongest reason to have it enforced." },
      { q: "Is a free scan safe to run on our domain?", a: "Yes. It reads public DNS records, the same ones any mail server reads when your email arrives. It does not log in, probe your systems or send email." },
      { q: "Who do I tell if a client received a fake email in our name?", a: "Tell the client first, then report it through ReportCyber. If personal information was accessed, assess whether it is an eligible data breach under the scheme." },
    ],
    sources: [S_ACT, S_NDB, S_SCAM, S_RC, S_SPF, S_DMARC],
    keyword: "email security for accountants Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "law-firms",
    label: "Law firms",
    title: "Email Security for Australian Law Firms | TITANOS",
    description: "Settlement payment fraud, client confidentiality and spoofed solicitor emails: what is different for a law firm, and a free scan of your public email records.",
    h1: "Email security for Australian law firms",
    eyebrow: "Law firms and conveyancers",
    lede: "A law firm moves large sums by instruction and holds the most confidential material in any small business. A single forged email that changes a bank account before a settlement is the scenario to design against. This page explains the specific risks and what your public email records can show.",
    why: [
      "The risk in legal practice is concentrated at a few moments: trust account payments, settlement instructions and the exchange of bank details. Fraudsters watch for those moments, because one successful redirect moves a very large amount at once. They only need to get into the conversation, either by sending from a lookalike address or by sending as your real domain when it is not protected.",
      "Confidentiality is the second difference. Solicitors owe a duty of confidentiality to clients under the conduct rules that apply in each state, and privilege can be lost through careless handling. A mailbox takeover that exposes a matter file is a professional issue before it is a privacy one.",
      "Third, the other side of a deal is often someone you have never met. Buyers, sellers, brokers and other practitioners all email bank details to each other. A firm that makes its own email hard to forge helps everyone else's checks.",
    ],
    risksHeading: "Four risks specific to law firms",
    risks: [
      { t: "Changed bank details before settlement", b: "An email in the name of a party or a practitioner gives new payment details shortly before funds move. The safeguard is a call-back to a number from an independent source, recorded on the file, and a firm-wide rule that bank details are never accepted or changed by email alone." },
      { t: "Impersonating your firm to your clients", b: "If your domain is spoofable, a criminal can email your client as you, with a fake trust account instruction. This is why your own DMARC policy protects clients, not only you." },
      { t: "Mailbox takeover and forwarding rules", b: "A compromised mailbox with a hidden forwarding rule lets someone read a matter silently. Auditing forwarding rules and enforcing multi-factor sign-in are the usual controls, both set in your email admin console." },
      { t: "Matter data going to AI tools", b: "Staff pasting client material into a public chatbot is a disclosure to an overseas recipient. Our APP 8 guide covers the questions to ask, and the confidentiality duty applies on top." },
    ],
    domainHeading: "What to check on a law firm's domain",
    domainIntro: "Public DNS shows whether your domain can be impersonated before any client is affected.",
    domainChecks: [
      "Is DMARC published, and has it moved from monitoring (p=none) to quarantine or reject? An unenforced policy tells receivers to deliver forged mail.",
      "Is SPF complete for your email platform, practice management system, e-signature, e-conveyancing and mailing tools, and within the 10 lookup limit in RFC 7208?",
      "Is there a DMARC reporting address, so you see who is sending as your domain? The reports are how you find a forgotten system or a forger.",
      "Do domains for old firm names, merged practices and individual practitioners carry a 'no mail' policy?",
    ],
    privacyHeading: "Privacy position for a firm",
    privacy: [
      "Whether the Privacy Act covers a particular firm depends on turnover and the exceptions, so use the small business exemption guide to check. Even where the Act does not apply, the conduct rules and client expectations do, and a breach involving client information has professional consequences.",
      "This is general information, not legal advice. Your regulator and indemnity insurer may have their own notification expectations, so read both.",
    ],
    automationHeading: "Where automation helps without adding risk",
    automation: [
      "Intake and appointment reminders are low risk when they carry no matter detail. A reminder that says 'your appointment is tomorrow morning' reveals nothing, and a form that collects contact details can create the file for a person to review.",
      "Keep anything that touches trust money or advice with a person. Automation here means fewer repetitive messages, never a replaced practitioner.",
    ],
    links: [SCAN, SPOOF, DMARC_SETUP, { href: "/privacy-act/app-8-cross-border-disclosure", label: "APP 8 and AI tools", note: "Overseas disclosure explained" }],
    faq: [
      { q: "Can a firm be impersonated even if our mailbox is secure?", a: "Yes. A forged message can claim to be from your domain without any access to your mailbox. DMARC enforcement is what tells receiving mail servers to reject it." },
      { q: "Does the scan see any matter or client information?", a: "No. It reads public DNS records only. No mailbox, file or client data is accessed." },
      { q: "What should a bank detail rule say?", a: "A common form is that bank details are never changed or accepted on the strength of an email alone, and are confirmed by a call to an independently sourced number, with a file note. Your firm sets its own rule." },
    ],
    sources: [
      S_ACT,
      S_SMALL,
      S_SCAM,
      S_RC,
      S_DMARC,
      S_SPF,
      { label: "Australian Solicitors' Conduct Rules 2015, rule 9 (confidentiality), as adopted in each state and territory" },
    ],
    keyword: "email security for law firms Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "real-estate",
    label: "Real estate",
    title: "Email Security for Real Estate Agencies | TITANOS",
    description: "Deposit and rent payment fraud, agent impersonation and tenant data: what real estate agencies face, with a free check of your agency domain.",
    h1: "Email security for Australian real estate agencies",
    eyebrow: "Real estate agencies and property managers",
    lede: "An agency sits between buyers, sellers, landlords, tenants, solicitors and trades, and every one of them is told to pay money by email. That makes the agency's domain a prime thing to impersonate. This page covers what is different for property, and what to check for free.",
    why: [
      "Agencies send an unusually large amount of payment-related email to people who do not know them well: deposit instructions, rental bond details, invoices for repairs and trust account details. A buyer or a tenant cannot tell a real message from a good forgery, so the agency's domain has to do that job for them.",
      "Property managers also hold personal information on a scale many offices do not: identity documents, employment and income details for applicants, and contact details for tenants and owners. Applicants send those files by email, and they sit in mailboxes long after the application is decided.",
      "Staff structure adds a quirk. Agents often work from phones and personal-looking addresses, and email is sent from the main agency platform, a CRM, a portal and a property management system. More senders means more ways for the records to be incomplete.",
    ],
    risksHeading: "Four risks specific to real estate",
    risks: [
      { t: "Forged deposit and rent instructions", b: "A message that looks like it came from the agent, asking a buyer or tenant to pay to a different account, is the typical loss. The safeguard is a standing line in your emails that your bank details never change by email, and a phone number the client can call to check." },
      { t: "Tenant and applicant documents in inboxes", b: "Application packs hold identity and income details. Agree how long they are kept, store them in one place and delete them from mailboxes once the application is decided." },
      { t: "Landlord and trade invoice redirects", b: "Owners and trades receive remittance advice and invoices from the agency. A fake 'updated bank details' message to a trade is the same fraud aimed at a different person." },
      { t: "Lookalike domains of the agency name", b: "Registering a near copy of an agency's domain costs a few dollars. The agency cannot prevent that, but it can make its real domain strict and tell clients what the real addresses are." },
    ],
    domainHeading: "What to check on an agency's domain",
    domainIntro: "The checks are read from public DNS, so they can be done without access to your systems.",
    domainChecks: [
      "DMARC present, with a policy that quarantines or rejects, and a reporting address you read.",
      "SPF that includes your CRM, property management system, listing and portal tools, e-signature and newsletter platform, within the 10 lookup limit in RFC 7208.",
      "DKIM signing enabled for each of those senders under your own domain.",
      "A consistent sending address for payments and instructions, so clients learn the real pattern.",
    ],
    privacyHeading: "Privacy position for an agency",
    privacy: [
      "Many agencies are small businesses, and the Privacy Act's small business exemption can apply to them, but exceptions apply (for example trading in personal information). Check your position with the exemption guide. Where the Act does apply, applicant data is exactly the kind of information the Notifiable Data Breaches scheme is concerned with.",
      "State laws and tenancy databases have their own rules. This page is general information, not legal advice.",
    ],
    automationHeading: "Where automation helps without adding risk",
    automation: [
      "Enquiry follow-up is the clearest win: a prompt reply to a portal enquiry, an inspection reminder, and a note to the agent that the buyer asked about finance. Messages that sell must follow the Spam Act (consent, identification, unsubscribe).",
      "Payment instructions stay with a person and a call-back. Automation is for the many routine messages that surround the money.",
    ],
    links: [SCAN, SPOOF, EXEMPT, BREACH],
    faq: [
      { q: "Is a real estate agency covered by the Privacy Act?", a: "It depends on turnover and the exceptions. Use the small business exemption guide to check. Even if not covered, clients expect careful handling of identity documents." },
      { q: "Can we stop lookalike domains?", a: "Not entirely. You can enforce DMARC on your real domain, publish your real sending addresses to clients, and report fakes to the registrar and ReportCyber." },
      { q: "Does the scan email our clients?", a: "No. It sends nothing to anyone. It reads your public DNS records and shows you the result." },
    ],
    sources: [S_ACT, S_SMALL, S_NDB, S_SCAM, S_RC, S_SPF, S_SPAM],
    keyword: "email security real estate agencies Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "medical-and-allied-health",
    label: "Medical and allied health",
    title: "Email and Privacy for Clinics and Allied Health | TITANOS",
    description: "Health information is sensitive, and the Privacy Act covers health providers whatever their turnover. Risks for clinics and a free check of your domain.",
    h1: "Email security and privacy for clinics and allied health",
    eyebrow: "GPs, dentists, physios, psychologists and allied health",
    lede: "A clinic holds the most sensitive information a small business can hold, and it is covered by the Privacy Act no matter how small it is. This page sets out why that is, the risks that follow and a free check of your public email records.",
    why: [
      "Most small businesses are outside the Privacy Act because turnover is AU$3 million or less. Health is the major exception: a business that provides a health service and holds health information is covered whatever its turnover (section 6D(4)(b)). That covers GPs and dentists, and can include allied health, counselling and some gyms that hold health information. Health information is also sensitive information, which carries stricter handling expectations.",
      "Clinics are busy, use many tools and rarely have an IT team. Bookings, reminders, referrals, pathology, billing and now AI note-takers all send or store patient data, often through suppliers whose servers are overseas. Each tool is a place where the clinic remains answerable for the information.",
      "Email is still how referrals, reports and reminders travel. A message that looks like it came from the clinic and asks a patient to 'confirm details' or pay an account is believable because the patient does expect messages from you.",
    ],
    risksHeading: "Four risks specific to clinics and allied health",
    risks: [
      { t: "Patient information sent to the wrong person", b: "Autocomplete and shared inboxes cause the commonest incidents. A misdirected referral is a data breach to assess, even with no criminal involved." },
      { t: "AI scribes and transcription tools", b: "Recording a consultation and sending it to an overseas service is a disclosure that APP 8 asks you to think about. Check where data is stored, whether it trains a model and how you delete it, and tell patients." },
      { t: "Forged reminders and payment requests", b: "If your domain can be spoofed, a criminal can send a believable appointment or account message to your patients. DMARC enforcement is the control that makes that fail." },
      { t: "Ransomware and mailbox takeover", b: "The Australian Digital Health Agency publishes guidance for providers on managing these threats." },
    ],
    domainHeading: "What to check on a clinic's domain",
    domainIntro: "These records are public. The free scan reads them without touching your practice software.",
    domainChecks: [
      "DMARC published and enforcing, so a forged appointment reminder is rejected.",
      "SPF and DKIM covering the booking platform, SMS and email reminder tool, practice management software and billing, since each sends as your clinic.",
      "No stale sending services listed in SPF from systems you stopped using.",
      "A published security contact so a researcher or patient can tell you about a problem.",
    ],
    privacyHeading: "Privacy position for a clinic",
    privacy: [
      "Treat the Australian Privacy Principles as applying. APP 1 asks for a clear privacy policy, APP 5 for notice at collection and APP 8 for care with overseas recipients. The Notifiable Data Breaches scheme applies, and the assessment window after a suspected breach is 30 days.",
      "This is general information and not legal advice. Your professional body, medical defence or insurer may add expectations.",
    ],
    automationHeading: "Where automation helps without adding risk",
    automation: [
      "Appointment reminders and recall messages reduce missed appointments and free front-desk time. Keep them free of clinical detail and send them through a service whose data location you know.",
      "Clinical judgement and advice stay with the clinician. Automation covers the repetitive administration around it.",
    ],
    links: [SCAN, SPOOF, EXEMPT, { href: "/sectors/health", label: "Health sector overview", note: "Our short sector page" }, { href: "/privacy-act/app-8-cross-border-disclosure", label: "APP 8 and AI tools", note: "Includes a clinic example" }],
    faq: [
      { q: "My clinic turns over less than AU$3 million. Does the Act apply?", a: "Yes if you provide a health service and hold health information. Section 6D(4)(b) takes such a business out of the small business exemption." },
      { q: "Is a free scan a compliance audit?", a: "No. It checks your public email records and shows whether your domain can be spoofed. A privacy review is a separate piece of work." },
      { q: "Do allied health practices count?", a: "Allied health, counselling and similar providers can be providing a health service. Read the OAIC guidance and confirm with your adviser." },
    ],
    sources: [S_ACT, S_SMALL, S_NDB, { label: "Australian Digital Health Agency: managing cyber security threats", href: DIGITAL_HEALTH }, S_DMARC, S_SPF],
    keyword: "privacy act health service providers email security Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "plumbers",
    label: "Plumbers",
    title: "Email Security and Automation for Plumbers | TITANOS",
    description: "Fake invoices, changed bank details and missed emergency calls: what plumbing businesses face, and a free check of your business email domain.",
    h1: "Email security and automation for Australian plumbers",
    eyebrow: "Plumbing and gas fitting businesses",
    lede: "A plumbing business lives on two things, the phone and the invoice. Both are attacked and both can be tightened without hiring anyone. This page is about the email and automation side that is particular to plumbers.",
    why: [
      "Plumbers are paid by many small customers and by a few large ones. Strata managers, builders and property agents pay on invoices and remittance emails. A forged 'we have changed bank details' message sent to your biggest payer is the loss to design against, and it happens by email.",
      "The phone is the other half. A plumber on a roof or under a house cannot answer, and an emergency caller moves on to the next number. That is a revenue problem and a reputation problem, and it can be fixed with an instant text reply and a call-back list.",
      "A third difference is the paperwork trail. Licences, compliance certificates and photos of work sit in email and phone galleries, with customer addresses attached. That is personal information you hold about people in their homes.",
    ],
    risksHeading: "Four risks specific to plumbing businesses",
    risks: [
      { t: "Invoice and remittance fraud", b: "Someone watches an invoice thread, then writes as you with new bank details. Put your bank details on a page of your own site and tell regular payers to call you for any change." },
      { t: "Customer addresses and photos", b: "Job photos and addresses are shared between staff by text and email. Keep them in the job system, not in personal chat apps, and remove them when the warranty period ends." },
      { t: "Fake supplier and trade account emails", b: "Messages from 'your supplier' asking you to update payment details or log in to a portal target trades who buy on account." },
      { t: "Review and quote spam", b: "Marketing messages to old customers need consent and an unsubscribe under the Spam Act. Service messages about a job just done are different." },
    ],
    domainHeading: "What to check on a plumber's domain",
    domainIntro: "Many plumbers run email on a free or low-cost platform and send invoices from job software. Both are checkable in public records.",
    domainChecks: [
      "Does your own domain (not a free webmail address) send your quotes and invoices? Customers trust a domain more than a free address.",
      "Is DMARC published and enforcing, so a forged invoice in your name is rejected?",
      "Does the invoicing or job software sign and send as your domain, with SPF and DKIM set up for it?",
      "Is there a 10 or fewer DNS lookup SPF record (RFC 7208), including every tool that sends as you?",
    ],
    privacyHeading: "Privacy position for a plumbing business",
    privacy: [
      "A sole trader or small company with turnover of AU$3 million or less is generally outside the Privacy Act, but customers still expect their address and photos to be handled with care, and some work for strata and government clients comes with contract terms about data. The exemption guide shows how to check.",
      "This is general information, not legal advice.",
    ],
    automationHeading: "Where automation helps",
    automation: [
      "An instant text to a missed call, a quote follow-up and a polite invoice reminder are the three that matter to a plumber. Our worked guides give the exact wording and the arithmetic, with the example numbers labelled as examples.",
      "Everything stays in your hands: you read the replies and you decide who gets the job.",
    ],
    links: [SCAN, SPOOF, CALC, { href: "/automation/plumber/missed-calls", label: "Plumber missed calls guide", note: "Wording and worked example" }, { href: "/automation/plumber/invoice-chasing", label: "Plumber invoice chasing guide", note: "Wording and worked example" }, { href: "/tradies", label: "What we do for trades", note: "Our tradies page" }],
    faq: [
      { q: "I only use a free email address. Is that a problem?", a: "A domain of your own looks more trustworthy to customers and gives you control over who can send as you. It is also the thing a scan can check." },
      { q: "Can I text customers who missed a call to me?", a: "A reply to a person who has just contacted you about a job is a service reply. For marketing, the Spam Act asks for consent, identification and an unsubscribe." },
      { q: "Does the scan need my login?", a: "No. It reads public DNS only." },
    ],
    sources: [S_SPF, S_DMARC, S_SPAM, S_SPAMACT, S_SMALL, S_SCAM],
    keyword: "email security for plumbers Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "electricians",
    label: "Electricians",
    title: "Email Security and Automation for Electricians | TITANOS",
    description: "Compliance certificates, fake supplier emails and missed quote calls: what electrical businesses face and a free check of your email domain.",
    h1: "Email security and automation for Australian electricians",
    eyebrow: "Electrical contractors",
    lede: "An electrical business runs on licences, certificates of compliance and quotes that wait for an answer. Each of those is a message that can be forged or lost. Here is what is particular to electricians and what you can check for free.",
    why: [
      "Electricians produce documents other people rely on: certificates of compliance, test records and safety paperwork. A recipient who receives one by email assumes it is yours. If someone can send as your domain, they can send a document that claims to be yours, and the harm lands on your licence and reputation.",
      "Electrical work also mixes domestic and commercial customers. A commercial client with an accounts team pays by remittance and is more likely to be a target of a redirect fraud, while a domestic customer is more likely to act on a text. You are exposed on both fronts. The practical answer is the same in each case: make your real domain strict, say plainly how your real messages look, and give customers one number to call when anything seems off.",
      "Quotes are the revenue pipeline. Many electrical jobs are won by the first reasonable quote that arrives, and a quote that sits for a day loses ground. A quick, honest follow-up is worth more than a discount. The same applies to emergency callouts, where the person who answers first usually gets the work, and to builders who ask three electricians for a price on the same afternoon.",
    ],
    risksHeading: "Four risks specific to electrical businesses",
    risks: [
      { t: "Forged compliance paperwork", b: "A certificate or test record attached to an email in your name is trusted by the recipient. Enforce DMARC so that email claiming to be from your domain, but not sent by you, is rejected." },
      { t: "Supplier account and wholesaler phishing", b: "Trade accounts with wholesalers are a target. A message asking you to re-enter a login on a lookalike page can hand over an account that has credit on it." },
      { t: "Commercial remittance redirects", b: "A change of bank details sent to a commercial client's accounts team is the classic redirect. Publish your details on your own site and ask clients to phone for any change." },
      { t: "Quotes that go unanswered", b: "A quote not followed up is the commonest silent loss. Our guide covers a respectful follow-up that does not pressure anyone." },
    ],
    domainHeading: "What to check on an electrician's domain",
    domainIntro: "The same public records show whether a forged certificate email would pass.",
    domainChecks: [
      "DMARC published and enforcing, with a reporting address.",
      "SPF listing your job management, quoting and invoicing tools and nothing you no longer use.",
      "DKIM signing from the system that emails certificates.",
      "A 'no mail' record on any domain you bought but do not use for email.",
    ],
    privacyHeading: "Privacy position for an electrical business",
    privacy: [
      "Most electrical businesses are small businesses under the Privacy Act's AU$3 million threshold, so the Act generally does not apply, with exceptions. Large commercial and government customers may require you to meet security terms by contract, and some will ask what you do about email. The exemption guide helps you see where you stand.",
      "This is general information, not legal advice.",
    ],
    automationHeading: "Where automation helps",
    automation: [
      "A text reply to a missed call, a scheduled quote follow-up and a review request after a completed job are the three most useful. Our electrician missed-call guide has the wording and the worked arithmetic, labelled as an example.",
      "You stay in control of what is sent and to whom.",
    ],
    links: [SCAN, SPOOF, CALC, { href: "/automation/electrician/missed-calls", label: "Electrician missed calls guide", note: "Wording and worked example" }, { href: "/automation/builder/quote-follow-up", label: "Quote follow-up guide", note: "Written for builders, applies to quotes generally" }, { href: "/tradies", label: "What we do for trades", note: "Our tradies page" }],
    faq: [
      { q: "Can someone really send a certificate in my name?", a: "If your domain has no enforced DMARC policy, receiving mail systems have no instruction to reject forged mail. A scan shows whether yours does." },
      { q: "Do I need to tell my licensing body about a spoofed email?", a: "Check your regulator's guidance. Report the fraud through ReportCyber and tell any affected customer." },
      { q: "Is the scan free?", a: "Yes. It reads public records and is the start of the conversation, not a sale." },
    ],
    sources: [S_SPF, S_DMARC, S_SPAM, S_SMALL, S_SCAM, S_RC],
    keyword: "email security for electricians Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "builders",
    label: "Builders",
    title: "Email Security for Australian Builders | TITANOS",
    description: "Progress claims, variations and subcontractor payments are targets for email fraud. What builders face, the AFP figure and a free domain check.",
    h1: "Email security for Australian builders and construction businesses",
    eyebrow: "Builders and construction",
    lede: "Builders pay and get paid in large amounts, to many subcontractors, by email. That combination is why construction has been named by the Australian Federal Police as a target for business email compromise. This page covers the risks particular to builders.",
    why: [
      "The Australian Federal Police reported business email compromise losses in Australia of AU$152.6 million in 2024, up 66 percent on the year, and published a release specifically about criminals targeting the construction sector. That figure is for all business email compromise in Australia, not construction alone, and it is the AFP's, not ours.",
      "A builder's email has more payment points than most businesses. Progress claims, variations, subcontractor invoices, supplier accounts and client deposits all move by email, often between parties who have worked together for a short time. A changed bank detail on a subcontractor's invoice looks ordinary, and the person paying it is usually an office worker with a stack of other invoices to clear that afternoon.",
      "Projects also create temporary email: project mailboxes, shared addresses and sub-contractors on their own free accounts. The more people on the thread, the more places a mailbox can be taken over. A short onboarding note for every project, covering who sends claims, which address they come from and who to call to confirm a payment change, costs very little and closes most of the gap.",
    ],
    risksHeading: "Four risks specific to builders",
    risks: [
      { t: "Subcontractor bank detail changes", b: "A message from a 'subbie' with new bank details lands in accounts. The control is a call to a number already on file before any change is made, and a rule that nobody can change details by email." },
      { t: "Progress claim and variation interception", b: "A claim sent to a client can be intercepted and re-sent with new details, which then gets paid. Send claims from an enforced domain and tell clients that your bank details are fixed." },
      { t: "Client deposits at the start of a job", b: "New clients pay a deposit to details in an email. Put your details on your own site and in your contract, not only in an email." },
      { t: "Tender and supplier phishing", b: "Fake 'tender documents' links and supplier portal logins target estimators and office staff." },
    ],
    domainHeading: "What to check on a builder's domain",
    domainIntro: "These are all read from public DNS.",
    domainChecks: [
      "DMARC published and enforcing, so a forged progress claim from your domain is rejected.",
      "SPF covering project management, estimating and accounting software that sends as you.",
      "DKIM on the system that sends claims and invoices.",
      "Separate, labelled addresses for accounts and projects, so staff and clients know what a real message looks like.",
    ],
    privacyHeading: "Privacy position for a building business",
    privacy: [
      "A building business with turnover of AU$3 million or less is generally outside the Privacy Act, though a bigger firm is covered and contracts with larger clients may require security measures. Check with the exemption guide.",
      "Security of payment laws in each state set rules for payment claims, so read your state's rules alongside your own controls. This is general information, not legal advice.",
    ],
    automationHeading: "Where automation helps",
    automation: [
      "Quote follow-up is the standard builder problem: quotes go out, then silence. A calm follow-up sequence helps the client decide and helps you plan. Our builder guide has the wording and the worked arithmetic, labelled as an example.",
      "Claims and payments stay with a person and a call-back.",
    ],
    links: [SCAN, SPOOF, { href: "/sectors/construction", label: "Construction sector overview", note: "Our short sector page" }, { href: "/automation/builder/quote-follow-up", label: "Builder quote follow-up guide", note: "Wording and worked example" }, { href: "/tradies", label: "What we do for trades", note: "Our tradies page" }],
    faq: [
      { q: "Is the AU$152.6 million all construction?", a: "No. It is the AFP's figure for business email compromise losses across Australia in 2024. The AFP release is about criminals targeting the construction sector." },
      { q: "Do my subcontractors need to do anything?", a: "A short note that you never change bank details by email, and a number to call, covers most of it." },
      { q: "Does the scan touch our project systems?", a: "No. It reads public DNS records only." },
    ],
    sources: [{ label: "Australian Federal Police: criminals target the construction sector with business email compromise scams", href: AFP_BEC }, S_SPF, S_DMARC, S_SMALL, S_SCAM, S_RC],
    keyword: "email security for builders Australia business email compromise",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },

  {
    slug: "cleaners",
    label: "Cleaners",
    title: "Email and Privacy for Cleaning Businesses | TITANOS",
    description: "Cleaners hold keys, alarm codes and client routines. What a cleaning business should protect, and a free check of the email domain behind your invoices.",
    h1: "Email security and privacy for Australian cleaning businesses",
    eyebrow: "Domestic and commercial cleaning",
    lede: "A cleaning business is trusted with keys, alarm codes and the daily routines of homes and offices. Those details are worth more to a thief than an invoice. This page sets out what is particular to cleaners and what is worth checking.",
    why: [
      "The valuable data in a cleaning business is not in a database. It is a list of addresses, access instructions, alarm codes, key locations and times a house is empty, usually in a phone, a spreadsheet or a group chat. If a staff phone is lost or a mailbox is taken over, that list goes with it.",
      "Cleaning work is recurring, which suits automation and also suits fraud. A client who pays a fortnightly invoice will pay a fortnightly invoice with new bank details if it looks right, and a forged invoice is easy when invoices are the same each time. Commercial cleaning contracts add another layer, because a body corporate or office manager may forward your invoice to an accounts team that has never met you.",
      "Cleaning teams are often casual and change often. Access to shared accounts and group chats needs to end the day someone leaves, and a business that grows by adding staff needs a short rule for what is shared where. A one page checklist for starting and leaving staff, covering accounts, chats, keys and codes, is enough for a small team and takes minutes to follow.",
    ],
    risksHeading: "Four risks specific to cleaning businesses",
    risks: [
      { t: "Access details held in chat apps and spreadsheets", b: "Keep codes and key locations in one controlled place, share only what a team member needs for their jobs and remove access when they leave. Never email a code in plain text." },
      { t: "Recurring invoice redirects", b: "A regular invoice with changed bank details is believable. Tell regular clients your details do not change by email, and give them a number to call." },
      { t: "Staff on personal devices", b: "Rosters and addresses on personal phones need a screen lock and a plan if a phone is lost." },
      { t: "Fake booking and review messages", b: "Booking platforms and review sites are impersonated. Know the exact addresses your booking system sends from." },
    ],
    domainHeading: "What to check on a cleaning business's domain",
    domainIntro: "Public DNS records show whether your invoices and booking messages could be forged.",
    domainChecks: [
      "A business domain rather than a free webmail address for invoices and booking confirmations.",
      "DMARC published and enforcing.",
      "SPF and DKIM covering your booking and invoicing tools.",
      "No leftover senders from software you have stopped using.",
    ],
    privacyHeading: "Privacy position for a cleaning business",
    privacy: [
      "Most cleaning businesses are small businesses with turnover of AU$3 million or less and are generally outside the Privacy Act, with exceptions, but clients still expect their addresses and access details to be protected, and commercial and body corporate contracts often write that expectation in. The exemption guide shows how to check where you stand.",
      "This is general information, not legal advice.",
    ],
    automationHeading: "Where automation helps",
    automation: [
      "Booking confirmations, a reminder the day before and an invoice after the clean are routine messages that automation does well. Ask clients for consent before marketing messages, and follow the Spam Act for anything that promotes.",
      "A person still handles special requests, complaints and anything that involves access to a home.",
    ],
    links: [SCAN, SPOOF, EXEMPT, CALC, { href: "/tradies", label: "What we do for trades", note: "Our tradies page" }],
    faq: [
      { q: "Is a client's alarm code personal information?", a: "It is information about a person's home security that is linked to an identifiable client. Whether or not the Privacy Act applies to you, treat it as confidential." },
      { q: "Can I send reminders by text?", a: "A booking reminder to a client who booked is a service message. Promotional messages need consent, identification and an unsubscribe under the Spam Act." },
      { q: "Do I need a business domain?", a: "It helps. A domain of your own shows clients where genuine messages come from, and lets you set protections a free address does not." },
    ],
    sources: [S_SMALL, S_ACT, S_SPAM, S_SPAMACT, S_SPF, S_DMARC, S_SCAM],
    keyword: "email security and privacy for cleaning businesses Australia",
    reviewed: "2026-11-29",
    published: "2026-11-29",
  },
];

export const pagePath = (p: IndustryPage) => `/industries/${p.slug}`;
export function getIndustry(slug: string): IndustryPage | undefined {
  return INDUSTRY_PAGES.find((p) => p.slug === slug);
}
