// Essential Eight quick score: question bank. Every question is a plain-English restatement of a Maturity Level One
// requirement in Appendix A of the ASD/ACSC "Essential Eight maturity model" (cyber.gov.au, page last reviewed 27 Nov 2023
// when read on 28 Nov 2026). Where several ACSC lines say nearly the same thing they are merged into one question.
export type Answer = "yes" | "partial" | "no" | "na";

export type Question = {
  id: string;
  text: string;
  /** Plain explanation shown under the question. */
  help: string;
  /** What to ask for, in one sentence, when the answer is not a full yes. */
  fix: string;
  /** True when "does not apply to us" is a legitimate answer (excluded from the score). */
  na?: boolean;
};

export type Strategy = { id: string; name: string; plain: string; anchor: string; questions: Question[] };

export const ACSC_MODEL_URL = "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight/essential-eight-maturity-model";
export const ACSC_HUB_URL = "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight";

export const STRATEGIES: Strategy[] = [
  {
    id: "patch-apps", name: "Patch applications", anchor: "Patch applications",
    plain: "Keep the software people use every day (Microsoft 365, browsers, PDF readers, your website platform) up to date.",
    questions: [
      { id: "pa1", text: "Do you have a list of every computer and device on your network, refreshed at least every fortnight?", help: "ASD asks for an automated method of asset discovery, so the list stays current without someone typing it in.", fix: "Ask your IT provider for an automatically updated device list, and how often it refreshes." },
      { id: "pa2", text: "Is your internet-facing software (website, email server, remote access, VPN) scanned for missing patches at least daily?", help: "A vulnerability scanner with an up-to-date database does this. If your website is on a hosted platform, the host may do it for you.", fix: "Ask who scans your website, remote access and email gateway for missing patches, and how often.", na: true },
      { id: "pa3", text: "Is everyday software (Office, browsers and their extensions, email clients, PDF readers, security products) scanned for missing patches at least weekly?", help: "Automatic updates alone do not count as checking. Something should report what is missing.", fix: "Ask for a weekly patch report covering Office, browsers, email and PDF software." },
      { id: "pa4", text: "Are critical fixes for internet-facing software applied within 48 hours of release (or when a working exploit exists)?", help: "Criticality is as rated by the vendor. Two days is the Maturity Level One target.", fix: "Agree a written 48-hour rule for critical fixes on anything reachable from the internet.", na: true },
      { id: "pa5", text: "Are fixes for Office, browsers, email clients, PDF readers and security products applied within two weeks of release?", help: "This is the everyday-software rule, and the one most small offices can meet with automatic updates plus a check.", fix: "Turn on automatic updates and ask for a report that shows anything older than two weeks." },
      { id: "pa6", text: "Have you removed software that its maker no longer supports?", help: "Unsupported software gets no security fixes at all, so the other answers stop mattering for it.", fix: "List every program past its vendor end-of-support date and replace or remove each one." },
    ],
  },
  {
    id: "patch-os", name: "Patch operating systems", anchor: "Patch operating systems",
    plain: "Keep Windows, macOS, servers and network gear (routers, firewalls) up to date.",
    questions: [
      { id: "po1", text: "Are all your computers, servers and network devices running an operating system the vendor still supports?", help: "ASD requires unsupported operating systems to be replaced at Maturity Level One.", fix: "Check each device's operating system against the vendor's end-of-support date and schedule replacements." },
      { id: "po2", text: "Are internet-facing servers and network devices (firewall, router) scanned for missing operating system patches at least daily?", help: "If you have no servers and your router is managed by your internet provider, choose Does not apply.", fix: "Ask your IT provider how often your firewall, router and any servers are scanned for missing updates.", na: true },
      { id: "po3", text: "Are workstations, internal servers and internal network devices scanned for missing operating system patches at least fortnightly?", help: "Most small offices answer this through a managed device tool such as Intune or an IT provider's remote monitoring.", fix: "Ask for a fortnightly operating system patch report across every laptop and desktop." },
      { id: "po4", text: "Are critical operating system fixes on internet-facing servers and network devices applied within 48 hours?", help: "Non-critical fixes on those devices have a two-week limit.", fix: "Write down a 48-hour rule for critical fixes on firewalls, routers and servers facing the internet.", na: true },
      { id: "po5", text: "Are operating system fixes on workstations, internal servers and internal network devices applied within one month of release?", help: "One month is the Maturity Level One window for these devices.", fix: "Set update rings so every laptop and desktop gets operating system updates within 30 days, and report on exceptions." },
    ],
  },
  {
    id: "mfa", name: "Multi-factor authentication", anchor: "Multi-factor authentication",
    plain: "A password alone is not enough: a second proof (an app code or security key) is needed to sign in.",
    questions: [
      { id: "mf1", text: "Do staff use multi-factor authentication to sign in to your business's online services that hold sensitive data (email, cloud storage, accounting, CRM)?", help: "Sensitive data means anything that would cause harm if it leaked: customer details, payroll, financials, contracts.", fix: "Switch on multi-factor authentication for every staff account on email, file storage and your business systems, starting with email." },
      { id: "mf2", text: "Is multi-factor authentication used on third-party services you use that hold sensitive data (internet banking, payroll, tax or accounting software, supplier portals)?", help: "These are logins you hold with other companies, such as your bank or Xero.", fix: "Turn on multi-factor authentication in the security settings of your bank, payroll and accounting logins." },
      { id: "mf3", text: "Where a third-party service holding non-sensitive data offers multi-factor authentication, have you turned it on?", help: "Social media, marketing tools and similar. The requirement says 'where available'.", fix: "Go through your social, marketing and subscription logins and enable multi-factor authentication where offered." },
      { id: "mf4", text: "If you run an online customer portal or account area with sensitive customer data, do customers (and your staff) have to use multi-factor authentication?", help: "Most small businesses do not run one. If you do not, choose Does not apply.", fix: "Add multi-factor authentication to customer sign-in on the portal, or ask your developer to.", na: true },
      { id: "mf5", text: "Does your multi-factor method use two different kinds of proof (for example a password plus an authenticator app, or a security key unlocked by a PIN)?", help: "Two passwords, or a password plus a security question, do not count. ASD asks for something you have plus something you know, or something you have unlocked by something you know or are.", fix: "Move from SMS-only or security questions to an authenticator app or security key where you can." },
    ],
  },
  {
    id: "admin", name: "Restrict administrative privileges", anchor: "Restrict administrative privileges",
    plain: "Few people should have the keys to everything, and those keys should not be used for reading email.",
    questions: [
      { id: "ad1", text: "Does someone check and approve a request before a person is given administrator access to a system, application or data store?", help: "Validated when first requested, not handed out by habit.", fix: "Keep a short list of who holds admin rights, who approved each one and why." },
      { id: "ad2", text: "Does everyone with admin rights have a separate admin account that is used only for admin work?", help: "Day-to-day work (email, browsing) happens on a normal account.", fix: "Create a dedicated admin account for each admin and remove admin rights from their everyday account." },
      { id: "ad3", text: "Are admin accounts blocked from email, web browsing and other internet services?", help: "This stops a phishing email or a bad website from landing on an account that can change everything.", fix: "Ask your IT provider to block internet, email and web access for admin accounts." },
      { id: "ad4", text: "Are admin accounts that do need to use an online service (for example a cloud admin portal) limited to only what that duty requires?", help: "Narrow permissions for the few admin accounts that must reach online services.", fix: "Review cloud admin roles and replace broad roles (Global Administrator) with the narrowest role that works.", na: true },
      { id: "ad5", text: "Are admin tasks done in a separate environment from everyday work, with everyday accounts unable to sign in to the admin environment?", help: "For example admin tools run from a separate managed machine or session, and ordinary staff accounts cannot sign in to it.", fix: "Ask your IT provider to separate admin and everyday environments and to block ordinary accounts from admin machines." },
    ],
  },
  {
    id: "app-control", name: "Application control", anchor: "Application control",
    plain: "Only approved programs can run on staff computers, so a downloaded nasty cannot simply start.",
    questions: [
      { id: "ac1", text: "Is application control (for example Windows App Control for Business or AppLocker) turned on for your workstations?", help: "It is separate from antivirus. Antivirus blocks known bad programs, application control blocks anything not on the approved list.", fix: "Ask your IT provider to trial application control in audit mode first, then enforce it." },
      { id: "ac2", text: "Does application control cover user profile folders and temporary folders used by the operating system, web browsers and email clients?", help: "These are the places malware usually lands from a download or an email attachment.", fix: "Ask for rules covering the user profile, temp and download folders, so nothing runs from them unless approved." },
      { id: "ac3", text: "Is the set of programs allowed to run (executables, libraries, scripts, installers, compiled HTML, HTML applications, control panel applets) limited to an approved list?", help: "ASD names those file types explicitly at Maturity Level One.", fix: "Ask for a written approved-software list that the application control rules enforce." },
    ],
  },
  {
    id: "macros", name: "Restrict Microsoft Office macros", anchor: "Restrict Microsoft Office macros",
    plain: "Macros are small programs inside Word and Excel files. Attackers hide malicious ones in invoices and quotes.",
    questions: [
      { id: "ma1", text: "Are Office macros switched off for everyone who has no proven business need for them?", help: "Most small teams never use macros. If nobody does, disabling them for all is a full yes.", fix: "Ask your IT provider to disable macros by policy for all staff except those with a documented need." },
      { id: "ma2", text: "Are macros in files that come from the internet (downloads, email attachments) blocked?", help: "Office has a setting for this, usually enforced through a policy so staff cannot click past it.", fix: "Turn on the 'block macros from the internet' policy for Word, Excel and PowerPoint." },
      { id: "ma3", text: "Is antivirus scanning of macros turned on?", help: "This is a setting in Office's Trust Center and is on by default in current versions unless something has turned it off.", fix: "Check the macro scanning setting is on and locked." },
      { id: "ma4", text: "Can staff NOT change the macro security settings themselves?", help: "Settings that a user can change are settings an attacker's document can talk a user into changing.", fix: "Apply the macro settings through group policy or your device management tool so they are locked." },
    ],
  },
  {
    id: "hardening", name: "User application hardening", anchor: "User application hardening",
    plain: "Switch off risky features in browsers and old software that attackers routinely abuse.",
    questions: [
      { id: "uh1", text: "Is Internet Explorer 11 disabled or removed from all your computers?", help: "It is a retired browser and Maturity Level One requires it gone.", fix: "Ask your IT provider to remove or disable Internet Explorer 11 by policy." },
      { id: "uh2", text: "Do your web browsers refuse to run Java from the internet?", help: "Modern browsers do not, but older or customised setups can.", fix: "Check browser settings and policy to make sure Java content from the internet is blocked." },
      { id: "uh3", text: "Do your web browsers block web advertisements from the internet?", help: "Malicious adverts are a common delivery route. This is usually done with an ad-blocking extension set by policy.", fix: "Deploy an ad blocker to every browser by policy, and prevent staff from removing it." },
      { id: "uh4", text: "Can staff NOT change the security settings in their web browsers?", help: "Browser security settings should be set by policy and locked.", fix: "Lock browser security settings with a management policy (Edge and Chrome both support this)." },
    ],
  },
  {
    id: "backups", name: "Regular backups", anchor: "Regular backups",
    plain: "If ransomware, a flood or a mistake wipes your files, you can get them back, and an attacker could not wipe the backups too.",
    questions: [
      { id: "bk1", text: "Are your data, applications and settings backed up and kept for as long as your business needs them?", help: "Retention should match how critical each system is and your business continuity needs.", fix: "List each system, how often it is backed up and how long copies are kept, then fix the gaps." },
      { id: "bk2", text: "Are backups taken so you can restore everything to the same point in time?", help: "Restoring your accounting file from Monday and your customer records from Friday can leave you with mismatched data.", fix: "Ask your IT provider whether backups are synchronised to a common restore point." },
      { id: "bk3", text: "Are backups stored securely and resiliently (for example a copy that is offline, immutable or in a separate account)?", help: "A backup on a drive that is always plugged in is exactly what ransomware looks for.", fix: "Add one copy that cannot be changed or deleted from your normal network sign-in." },
      { id: "bk4", text: "Have you actually restored data, applications and settings from backup as part of a disaster recovery exercise?", help: "A backup you have never restored is a hope, not a backup.", fix: "Book a test restore this month and write down how long it took and what was missing." },
      { id: "bk5", text: "Can ordinary staff accounts NOT access backups that belong to other accounts?", help: "Each person should reach only their own restore points.", fix: "Review backup permissions so only the backup administrator can reach the full set." },
      { id: "bk6", text: "Are ordinary staff accounts prevented from changing or deleting backups?", help: "If a staff account is compromised, the backups should survive.", fix: "Remove modify and delete rights on backups from every ordinary account." },
    ],
  },
];

export const TOTAL_QUESTIONS = STRATEGIES.reduce((n, s) => n + s.questions.length, 0);
