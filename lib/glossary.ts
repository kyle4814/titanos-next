/**
 * Glossary content: single source of truth for /glossary.
 *
 * Each entry is a short, self-contained definition (80 to 200 words) written to answer the
 * "what is X" query directly in its first sentence. Every entry links to a primary source
 * (a standard, a statute, the OAIC or the ACSC) so a reader or an AI system can check it.
 * Keep this file free of imports so the test script can load it directly.
 */

export type GlossaryGroup = "email" | "essential8" | "privacy" | "ai";

export type GlossaryEntry = {
  id: string;
  term: string;
  group: GlossaryGroup;
  definition: string;
  source: { label: string; url: string };
  related?: { label: string; href: string };
};

export const GLOSSARY_REVIEWED = "2026-11-28";

export const GROUP_LABELS: Record<GlossaryGroup, { title: string; blurb: string }> = {
  email: {
    title: "Email security",
    blurb: "How a business domain proves that its email is its own, and how criminals fake it.",
  },
  essential8: {
    title: "The Essential Eight",
    blurb: "The Australian government baseline for stopping common cyber attacks.",
  },
  privacy: {
    title: "Privacy Act and data breaches",
    blurb: "The obligations that sit behind a privacy policy, an AI tool or a data breach.",
  },
  ai: {
    title: "AI and automation",
    blurb: "Terms you meet when a business adds AI to calls, messages and back-office work.",
  },
};

export const GLOSSARY: GlossaryEntry[] = [
  // ---------- email security ----------
  {
    id: "dmarc",
    term: "DMARC",
    group: "email",
    definition:
      "DMARC (Domain-based Message Authentication, Reporting and Conformance) is a DNS record that tells receiving mail servers what to do with email that claims to come from your domain but fails authentication. It sits on top of SPF and DKIM: a message passes DMARC when at least one of them passes and the domain it checks lines up with the visible From address. You publish it as a TXT record at _dmarc.yourdomain, and it carries a policy (none, quarantine or reject) and an address for reports. Without a DMARC record, a receiving server has no instruction from you, so a forged invoice that uses your name can land in a customer's inbox. DMARC does not encrypt email or stop phishing in general. It stops other people sending as your exact domain.",
    source: { label: "RFC 7489, DMARC specification", url: "https://www.rfc-editor.org/rfc/rfc7489" },
    related: { label: "Can someone send email pretending to be my business?", href: "/blog/can-someone-send-email-pretending-to-be-my-business" },
  },
  {
    id: "spf",
    term: "SPF",
    group: "email",
    definition:
      "SPF (Sender Policy Framework) is a DNS record that lists the servers allowed to send email for your domain. When a message arrives, the receiving server looks up the SPF record for the domain in the envelope sender address and checks whether the sending server's IP address is on the list. A typical record names your email provider, for example Microsoft 365 or Google Workspace, plus any invoicing or newsletter tool that sends on your behalf. SPF has a hard limit of ten DNS lookups, and a record that goes over it fails silently, which is a common fault in small business domains that have added several tools over the years. SPF alone does not protect the From address a person actually sees, which is why it is paired with DKIM and DMARC.",
    source: { label: "RFC 7208, SPF specification", url: "https://www.rfc-editor.org/rfc/rfc7208" },
    related: { label: "DMARC, the record that ties SPF and DKIM together", href: "/glossary#dmarc" },
  },
  {
    id: "dkim",
    term: "DKIM",
    group: "email",
    definition:
      "DKIM (DomainKeys Identified Mail) adds a digital signature to every outgoing email. Your mail system signs selected parts of the message with a private key, and you publish the matching public key in DNS at a name made from a selector, such as selector1._domainkey.yourdomain. The receiving server fetches that public key and checks the signature. A valid signature shows the message really passed through a system you authorised and that the signed parts were not altered on the way. Each sending service usually has its own selector, so a business that uses Microsoft 365 for mail and a separate tool for invoices needs a DKIM key for each. DKIM on its own does not tell the receiver what to do with a failure. DMARC supplies that instruction.",
    source: { label: "RFC 6376, DKIM signatures", url: "https://www.rfc-editor.org/rfc/rfc6376" },
    related: { label: "SPF, the sender list", href: "/glossary#spf" },
  },
  {
    id: "bimi",
    term: "BIMI",
    group: "email",
    definition:
      "BIMI (Brand Indicators for Message Identification) lets a business show its logo next to its email in supporting inboxes. It is a reward for finishing the email security work, not a replacement for it. To qualify, a domain must publish a DMARC policy of quarantine or reject, and the logo must be supplied as a specific SVG file linked from a BIMI DNS record. Some mailbox providers also ask for a Verified Mark Certificate or a Common Mark Certificate, which is a paid certificate issued after the provider checks your trademark or logo use. Support differs between inbox providers, so a logo may appear in one app and not in another. For a small business the real value of BIMI is that the DMARC enforcement behind it protects customers from forged mail.",
    source: { label: "BIMI Group, implementation guide", url: "https://bimigroup.org/implementation-guide/" },
    related: { label: "DMARC", href: "/glossary#dmarc" },
  },
  {
    id: "dmarc-policy",
    term: "DMARC policy (none, quarantine, reject)",
    group: "email",
    definition:
      "A DMARC policy is the p= value in your DMARC record. It tells receiving servers how to treat mail that fails the check. With p=none, nothing changes for delivery and you only receive reports, which makes it the safe starting point. With p=quarantine, failing mail is normally sent to spam. With p=reject, failing mail is refused outright. The usual path is to publish p=none, read the reports for a few weeks to find every legitimate sender, fix any that fail, and then move to quarantine and finally reject. Skipping the reading step risks blocking your own invoices or booking confirmations. A domain that stays on p=none forever is monitored but not protected, because forged mail still gets through.",
    source: { label: "RFC 7489, section 6.3 policy values", url: "https://www.rfc-editor.org/rfc/rfc7489#section-6.3" },
    related: { label: "DMARC", href: "/glossary#dmarc" },
  },
  {
    id: "email-spoofing",
    term: "Email spoofing",
    group: "email",
    definition:
      "Email spoofing is sending a message with a forged From address so that it appears to come from someone else, such as your business, your bank or your supplier. Email was designed without a built-in check on the From line, so anyone can type any address. SPF, DKIM and DMARC are the add-on checks that let a receiving server test the claim. A spoofed message needs no access to your systems, only a domain with weak or missing records, which is why a criminal can attack a business without ever touching its network. The effect on the victim is real: customers receive fake invoices with your name on them, and the first you hear of it is a confused phone call. Checking your own domain's public records shows how exposed you are.",
    source: { label: "RFC 7489, DMARC specification (problem statement)", url: "https://www.rfc-editor.org/rfc/rfc7489" },
    related: { label: "Free external check of your domain", href: "/scan" },
  },
  {
    id: "bec",
    term: "Business email compromise (BEC)",
    group: "email",
    definition:
      "Business email compromise is fraud that uses email to redirect a payment. The attacker either breaks into a real mailbox or impersonates a trusted party, then sends a believable message asking for money to go to a new bank account. Common versions are the changed bank details notice from a supplier, a fake invoice that copies a real one, and a settlement or deposit request that arrives just before a due date. It works because the message reads like normal business and often lands in an existing email thread. Controls that help include multi-factor authentication on every mailbox, DMARC enforcement on your domain, and a rule that bank detail changes are confirmed by phone on a number you already hold. Victims can report through ReportCyber.",
    source: { label: "ACSC, report cybercrime (ReportCyber)", url: "https://www.cyber.gov.au/report-and-recover/report" },
    related: { label: "The invoice scam hitting Australian trade businesses", href: "/blog/invoice-scam-tradies" },
  },
  {
    id: "security-txt",
    term: "security.txt",
    group: "email",
    definition:
      "security.txt is a small text file placed at /.well-known/security.txt on a website that tells security researchers how to report a vulnerability to you. It is defined in RFC 9116. The two required fields are Contact, which is an email address, web form or phone number, and Expires, a date after which the file should be treated as stale. Optional fields point to your disclosure policy, encryption key and preferred languages. Without one, a researcher who finds a weakness has to guess who to tell, and may give up or post it publicly. For a small business the file takes about five minutes to write and signals that someone is paying attention. It does not make the site more secure on its own, it only makes responsible reporting possible.",
    source: { label: "RFC 9116, security.txt", url: "https://www.rfc-editor.org/rfc/rfc9116" },
    related: { label: "How the free scan checks a domain", href: "/methodology" },
  },
  {
    id: "attack-surface",
    term: "External attack surface",
    group: "email",
    definition:
      "An external attack surface is everything about your business that a stranger can see and test from the internet: your domain names, DNS records, mail authentication settings, web servers, login pages, exposed services and the certificates that protect them. It is called a surface because every visible item is a place an attacker could probe. A passive review uses only public records, such as DNS and certificate logs, and sends nothing to your systems. An active review sends test traffic, which should only happen on a domain whose owner has agreed to it. Knowing your external surface is the first step in shrinking it: switching off forgotten test sites, removing unused DNS records and closing services that need not be public.",
    source: { label: "ACSC, Information Security Manual", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/ism" },
    related: { label: "What the scan checks and how to reproduce it", href: "/methodology" },
  },

  // ---------- Essential Eight ----------
  {
    id: "essential-eight",
    term: "Essential Eight",
    group: "essential8",
    definition:
      "The Essential Eight is a set of eight mitigation strategies published by the Australian Cyber Security Centre to make it much harder for attackers to compromise a system. The eight are application control, patching applications, configuring Microsoft Office macro settings, user application hardening, restricting administrative privileges, patching operating systems, multi-factor authentication and regular backups. It began as a baseline for government and is widely used by private businesses, insurers and customers who ask a supplier to show their security. For most private small businesses it is guidance, not a legal requirement, although it is mandatory for non-corporate Commonwealth entities. The strategies are grouped by maturity level, so a business can start low and lift it over time. The ACSC has also published guidance on moving an Essential Eight implementation to ASD Essentials, so check which applies.",
    source: { label: "ACSC, Essential Eight", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight" },
    related: { label: "The Essential Eight, translated for a one-van trade business", href: "/blog/essential-eight-small-trade-business" },
  },
  {
    id: "maturity-level",
    term: "Essential Eight maturity level",
    group: "essential8",
    definition:
      "A maturity level is a rating of how well one Essential Eight strategy has been put in place. The ACSC defines levels from zero to three. Level zero means the strategy has significant gaps. Levels one to three are each built to resist a more capable attacker: level one targets opportunistic attackers using commodity tools, level two targets attackers willing to invest more time and effort, and level three targets attackers who are more adaptive and less reliant on public tools. A business is assessed per strategy, so you might be at level two for backups and level one for application control. Reaching a level means meeting every requirement of that level for that strategy, not most of them. Most small businesses start by aiming for level one across all eight.",
    source: { label: "ACSC, Essential Eight maturity model", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight/essential-eight-maturity-model" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
  {
    id: "mfa",
    term: "Multi-factor authentication (MFA)",
    group: "essential8",
    definition:
      "Multi-factor authentication asks for two or more different kinds of proof before it lets someone in: something you know, such as a password, plus something you have, such as a phone app or hardware key, or something you are, such as a fingerprint. It is one of the Essential Eight because a stolen password alone no longer opens the account. Not all MFA is equal. Codes sent by text message can be intercepted or phished, while app-based prompts are better and hardware security keys or passkeys, which are phishing-resistant, are best. The higher Essential Eight maturity levels require phishing-resistant methods for sensitive accounts. The most valuable place to start for a small business is email, since a hijacked mailbox is the doorway to invoice fraud and password resets everywhere else.",
    source: { label: "ACSC, multi-factor authentication", url: "https://www.cyber.gov.au/resources-business-and-government/maintaining-devices-and-systems/system-hardening-and-administration/system-hardening/implementing-multi-factor-authentication" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
  {
    id: "application-control",
    term: "Application control",
    group: "essential8",
    definition:
      "Application control means only approved programs are allowed to run on a computer, and everything else is blocked. It is sometimes called allow-listing. Instead of trying to recognise every piece of malware, which changes daily, it takes the opposite approach and permits a short list of known good software. If a staff member opens a booby-trapped attachment that tries to run an unapproved program, the computer refuses. It is the Essential Eight strategy people find hardest, because it needs a list that is kept up to date as software changes. Windows has built-in tools for it, such as AppLocker and App Control for Business. A small business can start with workstations that handle email and the web, where the risk is highest, before covering every machine.",
    source: { label: "ACSC, implementing application control", url: "https://www.cyber.gov.au/resources-business-and-government/maintaining-devices-and-systems/system-hardening-and-administration/system-hardening/implementing-application-control" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
  {
    id: "patching",
    term: "Patching applications and operating systems",
    group: "essential8",
    definition:
      "Patching means installing the vendor's updates that fix known security flaws. The Essential Eight lists two separate strategies, one for applications such as browsers, office suites and PDF readers, and one for operating systems and firmware. Attackers use published flaws because many businesses are slow to update, so a fix that has been available for months is an open door. The ACSC sets time limits for applying patches that become shorter when a flaw is already being exploited, and the exact limits depend on the maturity level, so check the current guidance rather than relying on a number remembered from an older version. Practical steps for a small business are turning on automatic updates, removing software that is no longer supported, and keeping a simple list of what is installed.",
    source: { label: "ACSC, Essential Eight maturity model", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight/essential-eight-maturity-model" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
  {
    id: "admin-privileges",
    term: "Restricting administrative privileges",
    group: "essential8",
    definition:
      "Restricting administrative privileges means that only the people who truly need powerful access have it, and they use it only for the tasks that require it. An administrator account can install software, change settings and read most data, so an attacker who takes one over can do almost anything. The Essential Eight advice is to separate the everyday account from the admin account, so the person who reads email and browses the web is not logged in with full power while they do it. Requests for admin access should be approved and reviewed, and unused admin accounts should be removed. In a small business this often means the owner stops using an administrator login for daily work and keeps a separate, strongly protected one for changes.",
    source: { label: "ACSC, Essential Eight maturity model", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight/essential-eight-maturity-model" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
  {
    id: "backups",
    term: "Regular backups",
    group: "essential8",
    definition:
      "In the Essential Eight, regular backups means important data, software and configuration settings are copied on a schedule, stored safely and, critically, tested by restoring them. A backup that has never been restored is a hope, not a control. The strategy also expects that an ordinary user account cannot change or delete the backups, so ransomware that takes over a staff login cannot wipe the copies as well. A common small business pattern is one copy in a cloud service with version history and one offline or immutable copy. Decide in advance how long you can afford to be without a system, because that sets how often you back up and how quickly you must be able to restore. Write the restore steps down before the day you need them.",
    source: { label: "ACSC, Essential Eight", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },

  // ---------- privacy ----------
  {
    id: "privacy-act",
    term: "Privacy Act 1988",
    group: "privacy",
    definition:
      "The Privacy Act 1988 is the main Australian law on how personal information is collected, used, stored and disclosed. It applies to Australian Government agencies and to private organisations with an annual turnover above AU$3 million, plus a list of smaller businesses that are covered regardless of size, such as private health service providers and businesses that trade in personal information. Its core is the 13 Australian Privacy Principles. The Act also contains the Notifiable Data Breaches scheme and is regulated by the Office of the Australian Information Commissioner. Amendments passed in December 2024 add new rights and obligations in stages, including a requirement from 10 December 2026 to explain certain automated decisions in your privacy policy. Check whether the small business exemption actually applies to you before assuming it does.",
    source: { label: "OAIC, the Privacy Act", url: "https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act/rights-and-responsibilities" },
    related: { label: "Privacy Act changes and the 10 December 2026 date", href: "/blog/privacy-act-small-business-deadline" },
  },
  {
    id: "app",
    term: "Australian Privacy Principles (APPs)",
    group: "privacy",
    definition:
      "The Australian Privacy Principles are the 13 rules in Schedule 1 of the Privacy Act that govern the whole life of personal information. They cover open and transparent management (APP 1), anonymity (APP 2), collection (APPs 3 to 5), use and disclosure (APP 6), direct marketing (APP 7), sending information overseas (APP 8), government identifiers (APP 9), quality (APP 10), security (APP 11), and access and correction (APPs 12 and 13). They are principles-based, which means they state outcomes and leave you to decide how, so a small business needs to write down how it meets each one. Organisations covered by the Act must follow them whether the information sits in a filing cabinet, a spreadsheet or an AI tool. The OAIC publishes guidelines for each principle.",
    source: { label: "OAIC, Australian Privacy Principles", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles" },
    related: { label: "Fixed-price Privacy Act and Essential Eight pack", href: "/compliance" },
  },
  {
    id: "small-business-exemption",
    term: "Small business exemption",
    group: "privacy",
    definition:
      "The small business exemption means most Australian businesses with an annual turnover of AU$3 million or less are not covered by the Privacy Act and its principles. It is not a blanket pass. A small business is still covered if it provides a health service and holds health information, trades in personal information, is a contracted service provider for the Commonwealth, is related to a larger body corporate, or is a credit reporting body, along with a few other cases. A business can also choose to opt in. The Government has agreed in principle to review the exemption, so the position may change, and customers or larger clients often expect small suppliers to meet the same standard anyway. Check the OAIC test before relying on the exemption.",
    source: { label: "OAIC, small business", url: "https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business" },
    related: { label: "Do sole traders need a privacy policy?", href: "/blog/sole-trader-privacy-policy-threshold" },
  },
  {
    id: "app-1",
    term: "APP 1 (open and transparent management)",
    group: "privacy",
    definition:
      "APP 1 requires an organisation to manage personal information openly and transparently. In practice that means two things: take reasonable steps to put practices and systems in place so you comply with the other principles, and keep a clearly expressed and current privacy policy. The policy must say what kinds of personal information you collect and hold, how and why, how a person can access or correct it, how they can complain, and whether you are likely to disclose it overseas and where. It should be free and easy to find, usually linked from every page of a website. From 10 December 2026, APP 1 also requires the policy to describe certain decisions that are made substantially by software. A copied template that does not match what the business really does is a common failure.",
    source: { label: "OAIC, APP 1 guidelines", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-1-app-1-open-and-transparent-management-of-personal-information" },
    related: { label: "Is an AI receptionist Privacy Act compliant?", href: "/blog/ai-receptionist-compliance" },
  },
  {
    id: "adm",
    term: "Automated decision-making (ADM)",
    group: "privacy",
    definition:
      "Automated decision-making is the use of a computer program to make, or do a substantial part of making, a decision about a person. Under changes to the Privacy Act passed in December 2024, from 10 December 2026 an organisation covered by the Act must say in its privacy policy what kinds of personal information it uses in such decisions and what kinds of decisions it makes this way, where the decision could significantly affect a person's rights or interests. Examples can include automatically declining a credit application, setting a price for one customer or rejecting a job applicant by algorithm. It does not ban automation, it requires openness about it. A business using AI to triage enquiries should check whether a human reviews each outcome and whether any decision meets the significant-effect test.",
    source: { label: "Privacy and Other Legislation Amendment Act 2024", url: "https://www.legislation.gov.au/C2024A00128/asmade" },
    related: { label: "Privacy Act changes and the 10 December 2026 date", href: "/blog/privacy-act-small-business-deadline" },
  },
  {
    id: "app-8",
    term: "APP 8 (cross-border disclosure)",
    group: "privacy",
    definition:
      "APP 8 applies when you disclose personal information to someone outside Australia. Before doing so, you must take reasonable steps to make sure the overseas recipient will handle it in line with the Australian Privacy Principles, and in many cases you stay accountable if they do not. This matters more than most owners expect, because cloud software, email platforms, customer relationship tools and AI services often store or process data in other countries. A privacy policy should say whether you are likely to disclose information overseas and in which countries. Typical reasonable steps include a contract that requires privacy protection, checking where a vendor stores data and choosing an Australian region where one is offered. There are exceptions, such as informed consent, but they carry conditions.",
    source: { label: "OAIC, APP 8 guidelines", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information" },
    related: { label: "BYOK, bringing your own model key", href: "/glossary#byok" },
  },
  {
    id: "app-11",
    term: "APP 11 (security of personal information)",
    group: "privacy",
    definition:
      "APP 11 requires an organisation to take reasonable steps to protect the personal information it holds from misuse, interference and loss, and from unauthorised access, modification or disclosure. It also requires you to destroy or de-identify the information once you no longer need it for any purpose the law allows. What counts as reasonable depends on the sensitivity of the data, how much you hold and the harm if it leaked, so a clinic holding health records is expected to do more than a shop holding a mailing list. The OAIC's guidance points to technical controls such as access limits and encryption, and also to staff training, policies and a plan for dealing with a breach. The Essential Eight is a practical way to show the technical steps.",
    source: { label: "OAIC, APP 11 guidelines", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
  {
    id: "ndb",
    term: "Notifiable Data Breaches (NDB) scheme",
    group: "privacy",
    definition:
      "The Notifiable Data Breaches scheme is Part IIIC of the Privacy Act. It requires an organisation covered by the Act to notify the OAIC and the affected people when an eligible data breach occurs. If you only suspect a breach, you must carry out a reasonable and expeditious assessment, and the law expects that assessment to be completed within 30 days. If the breach is likely to cause serious harm and you have not been able to prevent that harm with remedial action, you must notify as soon as practicable, saying what happened, what information was involved and what people should do. The notification goes through the OAIC's online form. Many small businesses miss the 30-day assessment rule because they think a breach has to be confirmed before the clock starts.",
    source: { label: "OAIC, Notifiable Data Breaches", url: "https://www.oaic.gov.au/privacy/notifiable-data-breaches" },
    related: { label: "The 30-day rule small businesses miss", href: "/blog/notifiable-data-breach-scheme-small-business" },
  },
  {
    id: "eligible-data-breach",
    term: "Eligible data breach",
    group: "privacy",
    definition:
      "An eligible data breach is the trigger for a notification under the NDB scheme. It happens when there is unauthorised access to, or unauthorised disclosure of, personal information, or a loss of personal information in circumstances where unauthorised access or disclosure is likely, and a reasonable person would conclude the result is likely to cause serious harm to one or more individuals. Harm can be physical, psychological, emotional, financial or reputational. Examples include a hacked mailbox containing customer details, a laptop with unencrypted client files left on a train, or an email with a spreadsheet of customers sent to the wrong person. Whether harm is serious is judged by the type of information, who might have it and how easily it could be misused. Acting quickly to contain a breach can mean it is no longer eligible.",
    source: { label: "OAIC, identifying eligible data breaches", url: "https://www.oaic.gov.au/privacy/notifiable-data-breaches" },
    related: { label: "Notifiable Data Breaches scheme", href: "/glossary#ndb" },
  },
  {
    id: "oaic",
    term: "OAIC",
    group: "privacy",
    definition:
      "The OAIC is the Office of the Australian Information Commissioner, the independent national regulator for privacy and freedom of information. It enforces the Privacy Act 1988, handles privacy complaints, receives data breach notifications under the NDB scheme, can investigate and can seek penalties through the courts for serious or repeated interference with privacy. It also publishes the guidance most businesses rely on, including the guidelines for each Australian Privacy Principle and plain-English resources for small business. When a page on this site refers to what the Privacy Act requires, the OAIC website is the primary source to check. The OAIC does not give legal advice to individual businesses, so a business with a specific problem should speak to a lawyer who works in privacy.",
    source: { label: "OAIC, home", url: "https://www.oaic.gov.au/" },
    related: { label: "Fixed-price Privacy Act and Essential Eight pack", href: "/compliance" },
  },
  {
    id: "personal-information",
    term: "Personal information",
    group: "privacy",
    definition:
      "Under the Privacy Act, personal information is information or an opinion about an identified individual, or an individual who is reasonably identifiable, whether the information is true or not and whether it is recorded in a material form or not. A name and phone number are personal information, and so are an email address, a photo, a job application, a call recording or a customer note that makes a person identifiable when combined with other data. Sensitive information is a stricter subset that includes health, racial or ethnic origin, political opinions, religious beliefs and biometric data, and it generally needs consent to collect. The definition matters for AI tools: pasting a customer's details into a chatbot is a use or disclosure of personal information and has to fit the principles.",
    source: { label: "OAIC, APP guidelines chapter B: key concepts", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-b-key-concepts" },
    related: { label: "Australian Privacy Principles", href: "/glossary#app" },
  },

  // ---------- AI and automation ----------
  {
    id: "byok",
    term: "BYOK (bring your own key)",
    group: "ai",
    definition:
      "BYOK, short for bring your own key, is a way of running an AI feature where the business supplies its own account key with the model provider instead of using the software vendor's. The provider bills the business directly for what it uses, and the business can see its own usage, set its own limits and cancel the key at any time. It matters for cost, because the vendor does not mark up or front the usage, and for privacy, because the business has a direct relationship with the company that processes its data and can read that provider's terms. A key is a secret and should be stored as one, never pasted into a shared document. The alternative is prepaid credits bought from the vendor, which are simpler but add a layer between you and the model.",
    source: { label: "Anthropic, API key best practices", url: "https://support.anthropic.com/en/articles/9767949-api-key-best-practices-keeping-your-keys-safe-and-secure" },
    related: { label: "How TITANOS prices agent tools", href: "/agents" },
  },
  {
    id: "missed-call-text-back",
    term: "Missed-call text-back",
    group: "ai",
    definition:
      "Missed-call text-back is an automation that sends a text message to a caller whose call went unanswered, usually within seconds, with something like an acknowledgement and an invitation to say what they need. For a tradie on a roof or a clinic at lunch, it covers the gap where a caller would otherwise ring the next business on the list. A good version identifies the business, refers only to the call just made and offers a clear next step, such as a booking link or a reply. Australian businesses should keep the message within the Spam Act 2003 rules on commercial electronic messages and the ACMA guidance on consent and identification. Keep any marketing out of it. The point of the message is to help the person who just called you.",
    source: { label: "ACMA, Spam Act and your business", url: "https://www.acma.gov.au/avoid-sending-spam" },
    related: { label: "Free tool: missed-call calculator", href: "/tools/missed-call-calculator" },
  },
  {
    id: "ai-receptionist",
    term: "AI receptionist",
    group: "ai",
    definition:
      "An AI receptionist is software that answers phone calls or messages for a business, understands what the caller wants, answers common questions and either books the job or passes the details to a person. Voice systems turn speech into text, use a language model to decide a reply and speak it back. It is a different thing from an answering service with a human reading a script. For an Australian business it raises privacy questions, since a call can contain personal information: the caller should be told they are speaking to an automated system, the purpose of recording should be stated, the data should be handled under the Australian Privacy Principles, and the vendor's overseas storage needs to be understood. Done well, it hands hours back to the team without replacing anyone.",
    source: { label: "OAIC, guidance on privacy and commercially available AI products", url: "https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/guidance-on-privacy-and-the-use-of-commercially-available-ai-products" },
    related: { label: "Is an AI receptionist Privacy Act compliant?", href: "/blog/ai-receptionist-compliance" },
  },
  {
    id: "mcp",
    term: "MCP (Model Context Protocol)",
    group: "ai",
    definition:
      "The Model Context Protocol is an open standard, introduced by Anthropic in November 2024, that lets an AI application connect to outside tools and data through a common interface. Instead of writing a separate connection for every pairing of assistant and system, a developer builds one MCP server that describes what its tools do, and any MCP-capable assistant can discover and call them. A server might expose a calendar, a database lookup or a security check. Because a connected tool can take real actions, good practice is to scope each key narrowly, log every call and keep a human approval step for anything that spends money or sends a message. The TITANOS agent tools described on the agents page are built to this pattern but the public endpoint is not live yet.",
    source: { label: "Model Context Protocol, official documentation", url: "https://modelcontextprotocol.io/docs/getting-started/intro" },
    related: { label: "TITANOS agent door (preview)", href: "/agents" },
  },
  {
    id: "acsc",
    term: "ACSC",
    group: "essential8",
    definition:
      "The ACSC is the Australian Cyber Security Centre, the Australian Government's lead on cyber security for individuals, businesses and government. It sits within the Australian Signals Directorate. It publishes the Essential Eight, the Information Security Manual, alerts about active threats and plain-language guides for small business, and it runs ReportCyber, the national channel for reporting cybercrime. The ACSC does not regulate private businesses or fine them, which separates it from the OAIC, but its guidance is what insurers, auditors and larger customers usually point to when they ask what good practice looks like. If a page on this site refers to what is recommended for cyber security in Australia, cyber.gov.au is the primary source to read.",
    source: { label: "ACSC, about", url: "https://www.cyber.gov.au/about-us" },
    related: { label: "Essential Eight", href: "/glossary#essential-eight" },
  },
];
