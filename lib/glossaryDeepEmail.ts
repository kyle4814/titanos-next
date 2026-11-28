/**
 * Long-form content for the email security glossary term pages (/glossary/<id>).
 * Free of path-alias imports so scripts can load it directly. Domains in examples are illustrative
 * (example.com.au is reserved for documentation); no figure here comes from a client.
 */
import type { GlossaryDeep } from "./glossaryDeepTypes";

export const DEEP_EMAIL: Record<string, GlossaryDeep> = {
  dmarc: {
    name: "DMARC",
    body: [
      "DMARC answers a question that SPF and DKIM leave open: what should a receiving server do when a message fails? It also adds the alignment rule. A message passes DMARC only if SPF or DKIM passes and the domain they validated matches the domain in the visible From address. That rule is what stops a criminal passing SPF with their own domain while showing your name in the From line.",
      "The record is a single TXT entry published at _dmarc.yourdomain. It holds a policy (p=), an optional policy for subdomains (sp=), optional alignment modes (adkim and aspf, relaxed or strict), a percentage for gradual rollout (pct=) and one or more report addresses (rua= for aggregate reports, ruf= for failure reports). Aggregate reports arrive as small XML files, usually once a day, from each large mailbox provider that handled mail claiming to be from you. They show which servers sent as your domain and whether each passed.",
      "Only one DMARC record may exist per domain, and a subdomain without its own record inherits the parent's policy. Reports are the real value in the first weeks. They reveal the invoicing tool, the booking system or the old marketing platform that sends as you and that nobody remembered to authorise.",
    ],
    example: {
      title: "A minimal starting record",
      text: "For the illustrative domain example.com.au, a safe first record is v=DMARC1; p=none; rua=mailto:dmarc-reports@example.com.au. The p=none value changes nothing about delivery. It switches on reporting so the business can see every system that sends as the domain before it tightens anything.",
    },
    steps: [
      "Check that SPF and DKIM already pass for your main mail system.",
      "Publish a p=none record with a report address you actually read.",
      "Read the reports for two to four weeks and fix every legitimate sender that fails.",
      "Move to quarantine, then reject, once the reports are clean.",
    ],
    mistakes: [
      "Publishing p=reject on day one and blocking your own invoices.",
      "Adding a record but never reading the reports, so the domain stays unprotected.",
      "Publishing two DMARC records, which makes both invalid.",
    ],
    see: ["spf", "dkim", "dmarc-policy", "email-spoofing", "bimi"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
  spf: {
    name: "SPF",
    body: [
      "SPF works on the envelope sender, the address mail servers use behind the scenes to route a message, not the From address a person reads. The receiving server looks up the SPF record for that domain, then checks whether the IP address that delivered the message is permitted. The answer is pass, fail, softfail, neutral or none, and DMARC uses it along with DKIM to reach a decision.",
      "A record is one TXT entry that begins v=spf1, then lists permitted sources, then ends with an instruction for everything else. Mechanisms such as include: pull in a provider's list, for example the one Microsoft 365 or Google Workspace publishes. The ending -all means reject anything not listed, while ~all means treat it as suspicious but accept it. Every include, a, mx, exists and redirect counts toward the limit of ten DNS lookups defined in RFC 7208. Go over it and the result is a permanent error, which many receivers treat as a failure.",
      "A domain may publish only one SPF record. When a second tool needs to send as you, its include is added to the existing record, not published as another record. Businesses that have added a newsletter service, a quoting app and a booking system over several years often end up past ten lookups without knowing.",
    ],
    example: {
      title: "What a small business record looks like",
      text: "An illustrative record for a business on Microsoft 365 that also sends invoices through one other service is v=spf1 include:spf.protection.outlook.com include:_spf.invoicetool.example -all. It names two permitted senders and tells receivers to reject everyone else. The second include is a placeholder: use the exact value your invoicing provider documents.",
    },
    steps: [
      "List every system that sends email as your domain, including invoicing, CRM and marketing tools.",
      "Look up the SPF include each provider documents and merge them into one record.",
      "Count the lookups. If the total is above ten, remove unused services or ask providers about flattening.",
      "Finish with ~all while testing and -all once DMARC reports show nothing legitimate failing.",
    ],
    mistakes: [
      "Publishing two SPF records for the same domain.",
      "Leaving an old provider's include in place after you stopped using it.",
      "Assuming SPF alone protects the From address people see. It does not.",
    ],
    see: ["dkim", "dmarc", "email-spoofing", "dmarc-policy"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "Can someone send email pretending to be my business?", href: "/blog/can-someone-send-email-pretending-to-be-my-business" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
    ],
  },
  dkim: {
    name: "DKIM",
    body: [
      "DKIM uses public key cryptography. Your mail system holds a private key and signs a hash of chosen headers and the body of each outgoing message, adding the result as a DKIM-Signature header. That header names the signing domain (d=) and a selector (s=). The receiver combines them into a DNS name, selector1._domainkey.example.com.au for instance, fetches the public key published there and verifies the signature.",
      "A valid signature proves two things: the message was signed by a system holding the private key for that domain, and the signed parts were not changed in transit. It does not say the message is trustworthy, only that it is authentic to the signing domain. DMARC then checks whether that signing domain matches the From address.",
      "Each service that sends for you normally signs with its own selector, so keys for Microsoft 365, a newsletter tool and an invoicing app can sit side by side in DNS without clashing. Modern guidance is to use 2048-bit keys where the provider supports them and to rotate keys from time to time by publishing a new selector, switching signing to it, then retiring the old one.",
    ],
    example: {
      title: "Reading a selector",
      text: "If an email header shows d=example.com.au and s=selector1, a receiving server asks DNS for the TXT record at selector1._domainkey.example.com.au. If that record holds the matching public key, the signature verifies. If a business deletes the record while the service is still signing with that selector, every message from that service starts failing DKIM.",
    },
    steps: [
      "Turn on DKIM signing in your main mail platform and publish the DNS records it gives you.",
      "Repeat for every other service that sends as your domain.",
      "Send a test message to an address you control and read the Authentication-Results header for dkim=pass.",
      "Note the selectors in a short document so nobody deletes one by mistake later.",
    ],
    mistakes: [
      "Enabling DKIM in the platform but never publishing the DNS records.",
      "Removing an old selector while a service still signs with it.",
      "Leaving a weak, short key in place for years.",
    ],
    see: ["spf", "dmarc", "dmarc-policy", "email-spoofing"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
  bimi: {
    name: "BIMI",
    body: [
      "BIMI is a visible payoff for doing email authentication properly. A mailbox provider that supports it can show a verified logo beside your messages in the inbox list, so a customer sees your mark instead of a generic initial. It is a standard being rolled out unevenly, so what a recipient sees depends on their provider and app.",
      "The mechanics have three parts. First, the domain must be at DMARC enforcement, meaning p=quarantine or p=reject, with the policy applied to all mail. Second, the logo must be an SVG in a restricted profile called SVG Tiny Portable/Secure, hosted at an https address. Third, a TXT record at default._bimi.yourdomain points to that file and, where the provider asks for it, to a certificate. The certificates are a Verified Mark Certificate, which ties to a registered trademark, or a Common Mark Certificate, which is available where the logo has been in use for a period without a trademark. Both are issued by authorised certificate authorities for a fee.",
      "Because of the cost and the dependence on provider support, BIMI is a later step for most small businesses. The part that has value on its own is the enforcement work behind it: moving DMARC to quarantine or reject protects your customers whether or not a logo ever appears.",
    ],
    example: {
      title: "The shape of a BIMI record",
      text: "An illustrative record at default._bimi.example.com.au reads v=BIMI1; l=https://example.com.au/brand/logo.svg; a=https://example.com.au/brand/mark.pem. The l tag locates the logo file and the a tag locates the certificate. Check the current requirements of each mailbox provider before spending money, because they differ.",
    },
    steps: [
      "Reach DMARC p=quarantine or p=reject first and keep it clean for some weeks.",
      "Ask a designer for a square SVG Tiny PS version of the logo.",
      "Check which mailbox providers your customers use and what each requires.",
      "Buy a certificate only if the providers that matter to you ask for one.",
    ],
    mistakes: [
      "Chasing the logo while DMARC is still at p=none.",
      "Uploading an ordinary SVG that carries scripts or external references, which is rejected.",
      "Expecting the logo to show in every inbox.",
    ],
    see: ["dmarc", "dmarc-policy", "spf", "dkim"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
  "dmarc-policy": {
    name: "DMARC policy",
    body: [
      "The policy is the single most important tag in a DMARC record because it is the only part that changes what happens to a forged message. There are three values. With p=none, receivers act as they would have anyway and simply send you reports. With p=quarantine, they are asked to treat failing mail with suspicion, which usually means the spam folder. With p=reject, they are asked to refuse it during the SMTP conversation, so it never reaches an inbox or a spam folder.",
      "Two companion tags give you control while you move. The pct tag applies the policy to only a percentage of failing mail, so p=quarantine; pct=25 quarantines a quarter of failures and treats the rest as p=none. The sp tag sets a separate policy for subdomains. Neither is a substitute for finishing the job: pct below 100 leaves a gap that a forger can use.",
      "The sensible order is none, then quarantine, then reject, with a few weeks on each step. The reports during the none stage are what make the later steps safe. A policy is a statement of intent that receivers are free to interpret, but the large providers generally honour it.",
    ],
    example: {
      title: "A staged rollout",
      text: "A business might publish p=none in week one, move to p=quarantine; pct=25 in week five once the reports are clean, raise pct to 100 in week seven, then change to p=reject in week ten. If a legitimate sender such as a new booking tool starts failing along the way, it is added to SPF or set up with DKIM before the next step.",
    },
    steps: [
      "Start at p=none with reports switched on.",
      "Fix every legitimate failing source the reports reveal.",
      "Raise to quarantine, watch for a fortnight, then raise to reject.",
      "Review the reports monthly so a newly added tool does not silently fail.",
    ],
    mistakes: [
      "Staying on p=none for years and calling the domain protected.",
      "Skipping straight to reject without reading reports.",
      "Forgetting that new tools added later need to be authorised.",
    ],
    see: ["dmarc", "spf", "dkim", "bimi", "email-spoofing"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
      { label: "Can someone send email pretending to be my business?", href: "/blog/can-someone-send-email-pretending-to-be-my-business" },
    ],
  },
  "email-spoofing": {
    name: "email spoofing",
    body: [
      "Spoofing exploits a design choice made decades ago. The protocol that moves email between servers, SMTP, lets the sender state any From address, and nothing in the original design checked it. SPF, DKIM and DMARC were added later to let a receiver test the claim, but they only work when the owner of a domain publishes the records and the receiver checks them.",
      "There are two kinds to know. Exact-domain spoofing forges your real domain, and it is what DMARC enforcement stops. Look-alike spoofing registers a different domain that resembles yours, such as one with a letter swapped or a different ending, and DMARC on your domain does nothing about it because the attacker owns the look-alike. The first is a gap in your own settings. The second is handled by watching for similar registrations, training staff and confirming payment changes by phone.",
      "The harm usually falls on the people who trust you. A customer who receives a convincing invoice carrying your name and a changed bank account pays the wrong party, and you carry the reputational cost. Mail that really comes from you can also be filtered more harshly if your domain is being abused, because receivers learn to distrust it.",
    ],
    example: {
      title: "How it looks to a customer",
      text: "A customer of the illustrative business example.com.au receives a message that shows accounts@example.com.au in the From line, with an invoice attached and a note saying the bank details have changed. The sender never logged into anything. They only typed the address into a mail tool, and because example.com.au has no DMARC enforcement, the customer's server delivers it.",
    },
    steps: [
      "Run a free public-records check on your domain to see where SPF, DKIM and DMARC stand.",
      "Publish and tighten DMARC following the none, quarantine, reject path.",
      "Agree a rule that bank detail changes are confirmed by phone on a number you already hold.",
      "Tell customers how you will and will not notify them of payment changes.",
    ],
    mistakes: [
      "Believing that having a firewall protects the From address.",
      "Ignoring look-alike domains because DMARC is in place.",
      "Waiting for a customer to report a fake invoice before checking.",
    ],
    see: ["dmarc", "spf", "dkim", "phishing", "bec"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "Free external check of your domain", href: "/scan" },
      { label: "The invoice scam hitting Australian trade businesses", href: "/blog/invoice-scam-tradies" },
    ],
  },
  bec: {
    name: "business email compromise",
    body: [
      "Business email compromise is a fraud of process, not of malware. The criminal's aim is to change where a legitimate payment goes. They get there in one of three ways: they break into a real mailbox, usually through a reused or phished password without multi-factor authentication; they spoof the domain of a supplier or customer; or they register a look-alike domain and join the conversation.",
      "Once inside a real mailbox the attacker often reads for days, learning who pays whom and when. They then time a message to land inside the existing thread just before an invoice is due, with new bank details and a plausible reason. They may add a mailbox rule that hides replies, so the real owner never sees the confusion. Property settlements, trade supplier invoices and payroll changes are classic targets because the amounts are large and the timing is known.",
      "The defence is a combination. Multi-factor authentication on every mailbox closes the break-in route. DMARC enforcement closes the exact-domain forgery. A simple rule that any change of bank details is confirmed by phone, using a number from your own records and never one in the email, stops the payment even when the other controls fail. Victims in Australia can report through ReportCyber, and a bank should be called at once because speed affects whether funds can be recalled.",
    ],
    example: {
      title: "A typical sequence, described without a real victim",
      text: "A bookkeeper receives what looks like a reply in an existing thread with a trade supplier. It says the supplier has changed banks and asks that this month's invoice be paid to the new account. The sender address is one character different from the real domain. The bookkeeper phones the supplier on the number in the accounts system, learns nothing has changed, and the payment is never made.",
    },
    steps: [
      "Switch on multi-factor authentication for every mailbox, starting with owners and accounts staff.",
      "Write the phone confirmation rule for bank detail changes and make sure everyone knows it.",
      "Look for unexpected mailbox forwarding rules and review them regularly.",
      "Know in advance who calls the bank and who reports to ReportCyber if it happens.",
    ],
    mistakes: [
      "Trusting an email because it sits inside a real thread.",
      "Confirming a change using the phone number in the email itself.",
      "Treating it as an IT problem when it is a payment process problem.",
    ],
    see: ["email-spoofing", "phishing", "mfa", "dmarc", "ndb"],
    links: [
      { label: "The invoice scam hitting Australian trade businesses", href: "/blog/invoice-scam-tradies" },
      { label: "The bank details email: accountants and bookkeepers", href: "/blog/the-bank-details-email-accountants-and-bookkeepers" },
      { label: "Settlement day scam in property and conveyancing", href: "/blog/settlement-day-scam-property-and-conveyancing" },
    ],
  },
  "security-txt": {
    name: "security.txt",
    body: [
      "A security.txt file solves a small but real problem: someone notices a weakness in your website or systems and wants to tell you, but cannot find who to tell. RFC 9116 standardised a plain text file at /.well-known/security.txt that gives them a clear route. Because it sits at a fixed address, researchers and automated tools know exactly where to look.",
      "Two fields are required. Contact gives a way to reach you, written as a mailto: link, a web form address or a tel: number. Expires gives a date and time, after which the file is considered out of date, so a stale file does not mislead anyone. Optional fields add useful detail: Policy links to your disclosure policy, Encryption points to a public key, Preferred-Languages lists the languages you can read, Canonical states the official address of the file, and Acknowledgments links to a thank-you page.",
      "The file must be served over HTTPS. Many people also sign it with a PGP key, although that is optional. For a small business it is a five-minute job that costs nothing, and the habit of renewing the Expires date once a year is the only upkeep.",
    ],
    example: {
      title: "A complete minimal file",
      text: "For the illustrative site example.com.au, the file contains two lines: Contact: mailto:security@example.com.au and Expires: 2027-11-30T00:00:00.000Z. Add a Canonical line with https://example.com.au/.well-known/security.txt if you want the address stated explicitly. Make sure the mailbox is monitored by someone who will reply.",
    },
    steps: [
      "Create a security@ mailbox or alias that a real person reads.",
      "Write the file with Contact and Expires, plus Policy if you have one.",
      "Publish it at /.well-known/security.txt over HTTPS.",
      "Put a yearly reminder in the diary to move the Expires date forward.",
    ],
    mistakes: [
      "Listing an address that nobody checks.",
      "Letting the Expires date lapse so the file reads as abandoned.",
      "Treating the file as a security control. It enables reporting and nothing more.",
    ],
    see: ["attack-surface", "acsc", "eligible-data-breach"],
    links: [
      { label: "How the free scan checks a domain", href: "/methodology" },
      { label: "Free external check of your domain", href: "/scan" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
  "attack-surface": {
    name: "external attack surface",
    body: [
      "An attack surface is the sum of the places where an outsider can interact with your systems. The external part is what is reachable from the internet without a login: the public website and any forgotten test copy of it, subdomains, mail servers, remote access gateways, cloud storage with a public setting, DNS records that point to services you no longer use, and the certificates covering all of them.",
      "Small businesses tend to accumulate surface by accident. A marketing agency builds a campaign page on a subdomain and leaves it running. A former supplier's system is still named in DNS. A staff member sets up a remote desktop for a weekend and forgets it. None of these needs advanced skill to find, because DNS records, certificate transparency logs and search engines are public and queryable.",
      "A passive review reads only those public sources and sends nothing to your systems, so it is safe to run against any domain and is the kind of check Titanos uses on a domain that has not asked for testing. Active testing sends probe traffic and belongs only on a domain whose owner has agreed to it in writing. The practical aim is simple: know what is exposed, remove what is not needed, and keep what remains patched and protected by multi-factor authentication.",
    ],
    example: {
      title: "A small inventory in plain terms",
      text: "A tradie with the illustrative domain example.com.au might find five public names: the main website, a mail record set, a booking portal run by a software vendor, an old quote-request page from a former website builder, and a remote access address the IT contractor set up. The old quote page is the one to remove, and the remote access address is the one to confirm is protected by multi-factor authentication.",
    },
    steps: [
      "List every domain and subdomain you own and who administers each registration.",
      "Review DNS for records that point to services you no longer use.",
      "Check that public logins have multi-factor authentication turned on.",
      "Repeat the review twice a year and after any website or supplier change.",
    ],
    mistakes: [
      "Assuming a service is private because nobody has linked to it.",
      "Leaving DNS records for cancelled services, which can enable subdomain takeover.",
      "Running active scans on systems you do not own.",
    ],
    see: ["security-txt", "patching", "mfa", "email-spoofing", "app-11"],
    links: [
      { label: "What the scan checks and how to reproduce it", href: "/methodology" },
      { label: "Free external check of your domain", href: "/scan" },
      { label: "Free Essential Eight score", href: "/tools/essential-eight-score" },
    ],
  },
  "mta-sts": {
    name: "MTA-STS",
    body: [
      "Email between servers is encrypted with STARTTLS only if both sides agree, and by default a failure to negotiate quietly falls back to plain text. An attacker positioned on the network path can strip the encryption offer or present a fake certificate, and the sending server will usually carry on regardless. MTA-STS, defined in RFC 8461, lets a receiving domain declare that its mail servers support TLS and that senders should refuse to deliver if a secure connection cannot be made.",
      "It has two pieces. A TXT record at _mta-sts.yourdomain contains v=STSv1 and an id that changes whenever the policy changes. The policy itself is a text file served over HTTPS at https://mta-sts.yourdomain/.well-known/mta-sts.txt, so it needs a web host with a valid certificate. The file lists version: STSv1, a mode (none, testing or enforce), the mx hostnames that are allowed to receive your mail, and max_age, the number of seconds a sender may cache the policy.",
      "Start in testing mode, where senders that support it deliver as normal but report problems, then move to enforce once the reports are clean. MTA-STS protects mail coming in to you. It does not stop forged mail, which is DMARC's job, and it only helps when the sender's server supports it, which the large providers do.",
    ],
    example: {
      title: "A policy file",
      text: "For the illustrative domain example.com.au on a hosted mail service, the file lists version: STSv1, mode: testing, one mx line with the provider's mail hostname, and max_age: 86400. After a few weeks of clean TLS reports the mode changes to enforce, the max_age is raised to something longer, and the id in the TXT record is changed so senders fetch the new file.",
    },
    steps: [
      "Confirm your mail provider supports TLS with a valid certificate on its mail servers.",
      "Host the policy file at the mta-sts subdomain over HTTPS.",
      "Publish the TXT record and start in testing mode alongside a TLS-RPT record.",
      "Move to enforce after reading the reports, and update the id each time the policy changes.",
    ],
    mistakes: [
      "Listing the wrong mx names, which blocks real mail once in enforce mode.",
      "Forgetting to change the id after editing the policy, so senders keep the old copy.",
      "Letting the policy host's certificate expire.",
    ],
    see: ["tls-rpt", "dmarc", "spf", "attack-surface"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
  "tls-rpt": {
    name: "TLS-RPT",
    body: [
      "TLS-RPT, defined in RFC 8460, is the reporting companion to MTA-STS. When other mail servers try to deliver to you and a secure connection fails, for example because a certificate has expired or the policy does not match the mail server's name, the sender can send you a report. Without it, you would only find out when a customer said your replies were going missing.",
      "You turn it on with one TXT record at _smtp._tls.yourdomain. The value starts v=TLSRPTv1 and carries a rua= tag naming where reports should go, either a mailto: address or an https endpoint. Reports arrive as compressed JSON, usually once a day per sending organisation. They summarise how many sessions succeeded, how many failed and the reason for each failure, such as certificate-expired, sts-policy-invalid or starttls-not-supported.",
      "Reading JSON files by hand is tedious, so many people send them to a reporting service or use a small script. They are most useful during the MTA-STS testing period, because a few failure reports can show a mistake in the policy before enforcement turns it into lost mail. TLS-RPT also works without MTA-STS, where it reports on opportunistic TLS and DANE failures.",
    ],
    example: {
      title: "A reporting record",
      text: "For the illustrative domain example.com.au, the TXT record at _smtp._tls.example.com.au reads v=TLSRPTv1; rua=mailto:tls-reports@example.com.au. A report that shows sts-policy-invalid from one large sender means the policy file or its mx list needs attention before enforcement.",
    },
    steps: [
      "Create a mailbox or alias dedicated to TLS reports.",
      "Publish the TXT record at _smtp._tls before switching on MTA-STS.",
      "Check the first reports after a few days for any failure types.",
      "Keep the record in place after MTA-STS is enforced so later faults show up.",
    ],
    mistakes: [
      "Pointing reports at a personal inbox that becomes unmanageable.",
      "Publishing MTA-STS in enforce mode without any reporting.",
      "Ignoring a steady stream of certificate failures.",
    ],
    see: ["mta-sts", "dmarc", "spf", "dkim"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "DMARC setup guides by provider", href: "/email-security/setup" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
  phishing: {
    name: "phishing",
    body: [
      "Phishing is a message designed to make a person do something they would not do if they understood what was going on: enter a password on a fake login page, open a file that installs malware, approve a payment or read out a code. It succeeds by borrowing trust. The message appears to come from a bank, a courier, a government agency, a software provider or a colleague.",
      "It comes in several forms. Bulk phishing goes to many people with a generic lure. Spear phishing is aimed at one person and uses real details about their role. Smishing arrives by text message, vishing by phone call, and QR code phishing hides the link in an image. Business email compromise is a targeted version where the goal is to redirect a payment.",
      "Some defences are technical and some are habits. DMARC enforcement stops criminals using your exact domain, multi-factor authentication limits what a stolen password can do, and phishing-resistant methods such as passkeys and security keys defeat fake login pages because they will not work on the wrong site. The habits are to go to the sender's website by typing the address yourself, never use a phone number from the message, and treat urgency as a reason to slow down. Report incidents through ReportCyber, and use Scamwatch for scams that target the public.",
    ],
    example: {
      title: "A common trade business lure",
      text: "A message that appears to come from a software provider says the business's account will be suspended unless the owner signs in through the link. The link opens a page that looks like the real login. A staff member who instead opens the provider's site by typing its address finds nothing wrong with the account, and reports the message to the person responsible for IT.",
    },
    steps: [
      "Turn on multi-factor authentication for email and finance accounts.",
      "Agree a short rule: never sign in from a link in a message that asks you to.",
      "Show staff real examples of lures that target your industry.",
      "Decide who staff tell, and make it easy and blame-free.",
    ],
    mistakes: [
      "Training once and never again.",
      "Punishing the person who clicked, which stops people reporting.",
      "Relying on spelling mistakes as a warning sign. Many lures are well written.",
    ],
    see: ["bec", "email-spoofing", "mfa", "dmarc", "ndb"],
    links: [
      { label: "Free email spoofing check", href: "/tools/email-spoofing-check" },
      { label: "The invoice scam hitting Australian trade businesses", href: "/blog/invoice-scam-tradies" },
      { label: "Email security guide for Australian small business", href: "/guides/email-security-small-business-australia" },
    ],
  },
};
