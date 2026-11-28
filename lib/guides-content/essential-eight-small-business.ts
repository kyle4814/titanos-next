import type { Guide } from "@/lib/guides";

export const essentialEight: Guide = {
  slug: "essential-eight-small-business",
  seoTitle: "Essential Eight for Small Business: A Plain Guide",
  h1: "The Essential Eight for Small Business: A Plain-English Guide",
  description:
    "The ACSC Essential Eight explained for small Australian businesses: the eight controls, what Maturity Level 1 means in practice and a 90-day plan to reach it.",
  cluster: "Essential Eight",
  targetTerms: ["essential eight small business", "essential eight maturity level 1 checklist", "acsc essential eight for small business australia", "essential eight explained"],
  date: "2026-11-28",
  updated: "2026-11-28",
  intro: [
    {
      t: "p",
      x: "The Essential Eight is a set of eight cyber security mitigation strategies published by the Australian Cyber Security Centre (ACSC), part of the Australian Signals Directorate. It is the Australian government's baseline for making it hard for an attacker to get into a system and easy for you to recover if they do. The ACSC calls it a baseline, and the name is accurate: it is the starting list, not the whole job.",
    },
    {
      t: "p",
      x: "It was written for organisations with IT departments, so the official wording can look out of reach for a business of one to twenty people. This guide translates each control into what it means when your business runs on a couple of laptops, a few phones, Microsoft 365 or Google Workspace, a job management app and an accounting package. It then explains the maturity levels, who actually requires the Essential Eight, and a 90-day plan to reach a sensible Maturity Level 1.",
    },
    {
      t: "note",
      title: "Is the Essential Eight mandatory for small business?",
      x: "No. For most small businesses it is guidance, not law. It is mandatory for non-corporate Commonwealth entities under the Protective Security Policy Framework, and clients, insurers and tender evaluators increasingly ask for it. See [who actually asks for it](#who-asks) below.",
    },
  ],
  sections: [
    {
      id: "the-eight",
      h2: "The eight controls in plain language",
      blocks: [
        { t: "p", x: "The ACSC groups the eight into three jobs: stop malware running, limit how far an attack can spread, and make sure you can recover. This table gives the official name, what it means, and how it looks in a small business." },
        {
          t: "table",
          caption: "The Essential Eight, translated",
          head: ["Control", "What it means", "In a small business"],
          rows: [
            ["1. Application control", "Only approved programs can run.", "Install apps from official stores or approved vendors only. On Windows, built-in tools such as App Control can block unknown programs, but a good habit covers much of the value at this size."],
            ["2. Patch applications", "Fix security holes in software quickly.", "Automatic updates on browsers, PDF readers, Office, job software. Do not postpone prompts."],
            ["3. Configure Microsoft Office macro settings", "Block risky macros.", "If nobody needs macros, disable them. Never enable macros in a file that arrived by email."],
            ["4. User application hardening", "Turn off risky features in browsers and Office.", "Stop browsers running Java and web advertisements, and keep the secure default settings."],
            ["5. Restrict administrative privileges", "Few people have powerful accounts, and they do not use them for daily work.", "Staff use standard accounts. The owner's admin account is not used to read email."],
            ["6. Patch operating systems", "Fix security holes in Windows, macOS, iOS, Android.", "Turn on automatic updates and replace devices that no longer get updates."],
            ["7. Multi-factor authentication", "A password alone is not enough to log in.", "Switch on MFA for email, accounting, banking, job software, cloud storage, remote access."],
            ["8. Regular backups", "Keep copies you can restore from.", "Cloud backups of files and email, one copy that ransomware cannot reach, and a restore test."],
          ],
        },
        { t: "p", x: "Our earlier post, [the ACSC Essential Eight translated for a one-van trade business](/blog/essential-eight-small-trade-business), takes the same list from a trade perspective. The ACSC's own page, [Essential Eight](https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight), is the authority and carries the latest maturity model." },
      ],
    },
    {
      id: "maturity-levels",
      h2: "Maturity levels: what Level 1 means",
      blocks: [
        { t: "p", x: "The ACSC defines four maturity levels, Level 0 to Level 3. Each level is aimed at a more capable adversary and demands more of the controls." },
        {
          t: "table",
          caption: "Maturity levels in short",
          head: ["Level", "Aimed at", "Rough meaning"],
          rows: [
            ["Level 0", "No target", "Weaknesses in the overall cyber security posture."],
            ["Level 1", "Opportunistic attackers using widely available tools", "Most of the eight controls in place at a basic level."],
            ["Level 2", "Adversaries willing to invest more time and effort", "Stronger, more frequent patching, logging and application control coverage."],
            ["Level 3", "Adversaries more adaptive and less reliant on public tools", "Mature, tightly managed controls. Few small businesses need this."],
          ],
        },
        { t: "p", x: "For most small businesses, **Maturity Level 1 is the right target**. It is about stopping the attacks most likely to hit you: the phishing email, the unpatched browser, the stolen password, the ransomware. The requirements are detailed and change with each release of the ACSC model, so use the live document rather than a blog summary for anything you need to prove. In broad terms, Level 1 looks like this:" },
        {
          t: "ul",
          x: [
            "Patches for internet-facing services applied within about two weeks, and within 48 hours if an exploit is known to exist; other applications and operating systems within about a month.",
            "Multi-factor authentication for online services that hold sensitive data, and for customers accessing their own data where you offer it.",
            "Macros blocked for users without a business need and blocked from files that came from the internet.",
            "Web browsers set not to run unneeded content, such as Java and ads.",
            "Privileged accounts limited, validated and kept away from email and web browsing.",
            "Backups of important data, software and settings, kept for a sensible period, protected from deletion by normal accounts and tested.",
            "Application control on workstations at least for user profile and temporary folders.",
          ],
        },
        { t: "p", x: "These are summaries to help you orient yourself. Check the current numbers and wording in the ACSC's maturity model before you rely on them for a contract or an audit." },
        {
          t: "note",
          title: "Reading tip",
          x: "The maturity model is written for assessors. If a requirement uses a term you do not recognise, ask your IT provider to explain in a sentence how your business meets it. If they cannot, that is information.",
        },
      ],
    },
    {
      id: "control-by-control",
      h2: "Control by control: what to do and how to check it",
      blocks: [
        { t: "h3", x: "Patch applications and operating systems" },
        { t: "p", x: "Most real breaches exploit vulnerabilities that already had a fix. Turn on automatic updates on every device that touches the business: laptops, phones, tablets, point-of-sale devices, routers. Replace anything that no longer receives updates, such as old Windows versions or ageing phones. To check: list your devices, the version and the date of the last update. Gaps show up in ten minutes." },
        { t: "h3", x: "Multi-factor authentication" },
        { t: "p", x: "This is the single highest-value control for a small business. Start with email, because email resets every other password, then accounting software, banking, job management, your domain registrar and cloud storage. Prefer an authenticator app or a hardware key over SMS codes where you can, because phone number takeover is a known attack. To check: log in to each service from a private browser window and confirm you are asked for a second step." },
        { t: "h3", x: "Regular backups" },
        { t: "p", x: "Know what you are backing up, where it goes, and how you would get it back. A backup that ransomware can reach is not a backup. Cloud storage with version history and a separate offline or immutable copy is a good small-business standard. To check: delete a test file, restore it, and time how long it takes. A backup you have never restored is a hope." },
        { t: "h3", x: "Restrict administrative privileges" },
        { t: "p", x: "On a laptop, the account you use daily should not be an administrator. Create a separate admin account used only for installs and settings. In cloud services, give each person only the role they need and review who has owner rights every few months. To check: look at the user list in Microsoft 365, Google Workspace and your job software and ask for each name whether they need that access." },
        { t: "h3", x: "Application control and hardening" },
        { t: "p", x: "At the small end this is mostly about habits: install only from official stores and known vendors, remove software nobody uses, and keep browsers on default secure settings with an ad blocker. Windows includes features such as App Control for Business that can enforce allow-lists. They take planning, so ask your IT provider whether they suit your setup." },
        { t: "h3", x: "Office macros" },
        { t: "p", x: "If nobody in the business needs macros, set Office to block them. Many attacks arrive as a document that tells the reader to \"enable content\". Teach staff that this phrase is a warning, not an instruction." },
      ],
    },
    {
      id: "who-asks",
      h2: "Who actually asks for the Essential Eight",
      blocks: [
        { t: "p", x: "For most small businesses the Essential Eight is not a legal requirement. But it turns up in practice in four places:" },
        {
          t: "ol",
          x: [
            "**Government suppliers.** Commonwealth entities must implement the Essential Eight to a set maturity level, and they pass requirements down in contracts. A tender evaluation form may ask what maturity level you meet. Our [government tenders guide](/guides/government-tenders-small-business-australia) covers the cyber questions that appear.",
            "**Larger clients and supply chains.** Councils, builders, utilities and corporates add security schedules to supplier agreements.",
            "**Insurers.** Cyber insurance applications ask about MFA, backups and patching, which are Essential Eight controls under another name.",
            "**Privacy law.** The Privacy Act expects reasonable steps to protect personal information, and the Essential Eight is a recognised yardstick for what reasonable looks like. See the [Privacy Act guide](/guides/privacy-act-small-business-australia).",
          ],
        },
        { t: "p", x: "The ACSC's wider small business material is aimed at owners rather than IT staff. Start there if the Essential Eight pages feel too technical, then come back to the maturity model when a client asks." },
      ],
    },
    {
      id: "self-score",
      h2: "A ten-minute self-score",
      blocks: [
        { t: "p", x: "Before you spend anything, score yourself honestly. Answer yes or no. Count the yeses." },
        {
          t: "ol",
          x: [
            "Do all devices that touch the business update automatically and run supported software?",
            "Is multi-factor authentication on for email, accounting and banking?",
            "Is there a backup of files and email that a stolen password could not delete?",
            "Have you restored something from it in the last year?",
            "Do staff use standard accounts day to day, not administrator accounts?",
            "Is the number of people with owner or admin rights in your cloud tools as low as it can be?",
            "Are Office macros blocked for staff who do not need them?",
            "Do you only install software from official stores or known vendors?",
            "Can you list every device and every cloud service the business uses?",
            "Does someone know what to do first if an account is compromised?",
          ],
        },
        { t: "p", x: "Eight or more: you are close to Level 1 in spirit and need to document it. Four to seven: you have the basics, and one or two controls, usually MFA gaps or untested backups, are holding you back. Under four: start with the three controls below, and do not be embarrassed, because most small businesses are here." },
        { t: "p", x: "Our [Essential Eight Maturity Level 1 checklist](/products/essential-eight-ml1-checklist) turns this into a tracked list with evidence prompts. The free [security scan](/scan) checks the externally visible part of your posture, such as email domain settings, without needing a login." },
      ],
    },
    {
      id: "ninety-day-plan",
      h2: "A 90-day plan to reach Maturity Level 1",
      blocks: [
        { t: "h3", x: "Days 1 to 30: the three that matter most" },
        {
          t: "ol",
          x: [
            "Turn on MFA for email, accounting, banking, job software and your domain registrar.",
            "Fix backups: work out what is backed up and where, add a copy a thief cannot reach and run one restore test.",
            "Switch on automatic updates for every device, and make a list of anything that cannot update so you can replace it.",
          ],
        },
        { t: "h3", x: "Days 31 to 60: accounts and software" },
        {
          t: "ol",
          x: [
            "Create separate admin accounts and remove admin rights from daily accounts.",
            "Review cloud user lists and remove people who have left.",
            "Block Office macros where not needed and set browsers to secure defaults.",
            "Remove software nobody uses.",
          ],
        },
        { t: "h3", x: "Days 61 to 90: write it down and prove it" },
        {
          t: "ol",
          x: [
            "Write a one-page record of each control: how it is done, who owns it, and when you last checked.",
            "Take screenshots or exports as evidence: MFA settings, update settings, backup restore log.",
            "Set a quarterly reminder to repeat the self-score.",
            "Decide whether your clients or tenders need a formal assessment. If they do, ask an assessor or your IT provider.",
          ],
        },
        { t: "p", x: "Costs for a small business are mostly time. MFA, updates and macro settings cost nothing. Backups cost a small monthly fee. Replacing unsupported devices is the main real expense. Beware of any package that sells the Essential Eight as a product with no scoping. Ask what level it delivers and how that is evidenced." },
      ],
    },
    {
      id: "common-mistakes",
      h2: "Common mistakes",
      blocks: [
        {
          t: "ul",
          x: [
            "**Treating it as a one-off.** Controls decay. A new staff member joins, a device ages out, a backup silently fails. Review quarterly.",
            "**MFA by SMS only,** when an authenticator app is available.",
            "**Backups on the same network or account as the files,** so ransomware encrypts both.",
            "**Shared logins.** If three people use one account, you cannot restrict or review anything.",
            "**Forgetting the domain registrar and email.** An attacker who controls your domain controls your email and every password reset.",
            "**Claiming a maturity level you have not evidenced.** In a tender or a contract, an overstatement is a bigger risk than an honest Level 0 with a plan.",
          ],
        },
        { t: "p", x: "Email is the entry point for most attacks on small business, and it is where the next guide picks up: [email security for small business](/guides/email-security-small-business-australia) covers SPF, DKIM and DMARC and how to stop someone sending mail as you." },
      ],
    },
  ],
  faq: [
    {
      q: "Do small businesses have to follow the Essential Eight?",
      a: "No. It is not a legal requirement for most small businesses. It is mandatory for non-corporate Commonwealth entities, and clients, insurers and tender evaluators increasingly ask for it. It is also a sensible yardstick for the reasonable steps the Privacy Act expects.",
    },
    {
      q: "What is Essential Eight Maturity Level 1?",
      a: "Level 1 is the ACSC's baseline aimed at opportunistic attackers using widely available tools. It asks for basic implementation of the eight controls, such as timely patching, multi-factor authentication for key services, blocked macros, limited admin accounts and tested backups. Check the ACSC's current maturity model for the exact wording.",
    },
    {
      q: "How much does the Essential Eight cost for a small business?",
      a: "Many controls are settings you already have: MFA, automatic updates and macro blocking cost nothing. Backups add a monthly fee and replacing unsupported devices can be a one-off cost. The larger expense is time for setup and documentation. Be cautious of any quote that does not state the maturity level it will deliver.",
    },
    {
      q: "Which Essential Eight control should I do first?",
      a: "Multi-factor authentication on email and accounting, because stolen passwords are the most common way in and email resets every other account. Backups and automatic updates come next.",
    },
    {
      q: "Is the Essential Eight the same as ISO 27001 or SOC 2?",
      a: "No. ISO 27001 and SOC 2 are management and audit frameworks. The Essential Eight is a short, technical list of mitigation strategies with a maturity model. They overlap in places, and a small business can meet the Essential Eight without either certification.",
    },
    {
      q: "Do I need an IT provider to do this?",
      a: "Not for the first month. MFA, updates and backups are manageable alone. For application control, admin privilege design and formal evidence for a contract, an IT provider or assessor helps. Titanos works alongside your IT provider and does not replace them.",
    },
  ],
  sources: [
    { label: "ACSC: Essential Eight", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight", note: "The eight strategies, the maturity model and the assessment guidance" },
    { label: "ACSC: Cyber.gov.au", url: "https://www.cyber.gov.au", note: "Small business guidance, alerts and incident reporting" },
    { label: "Protective Security Policy Framework", url: "https://www.protectivesecurity.gov.au", note: "The Commonwealth policy that makes the Essential Eight mandatory for non-corporate Commonwealth entities" },
    { label: "OAIC: Australian Privacy Principles, APP 11", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles", note: "Reasonable steps to protect personal information" },
    { label: "Scamwatch", url: "https://www.scamwatch.gov.au", note: "Current scams targeting Australian businesses" },
  ],
  related: {
    posts: ["essential-eight-small-trade-business", "invoice-scam-tradies", "free-scan-legitimacy-check", "notifiable-data-breach-scheme-small-business"],
    tools: [
      { label: "Free security scan", href: "/scan", blurb: "Checks the externally visible part of your posture. No login required." },
      { label: "Compliance Monitor", href: "/monitor", blurb: "Ongoing external checks so controls do not decay." },
      { label: "Compliance pack", href: "/compliance", blurb: "Privacy Act and Essential Eight work in one fixed-price pack." },
      { label: "Supplier Cyber Readiness Pass", href: "/offers/supplier-cyber-readiness-pass", blurb: "A tender-ready security answers sheet and a ranked fix list." },
    ],
    products: [
      { label: "Essential Eight ML1 Checklist", href: "/products/essential-eight-ml1-checklist", blurb: "A tracked checklist with evidence prompts for Maturity Level 1." },
      { label: "Email Spoofing Self-Check Checklist", href: "/products/spoofguard-self-check-checklist", blurb: "Ten checks you can run in an afternoon using public records." },
      { label: "Course: Email Security for Owners", href: "/products/course-email-security-for-owners", blurb: "A short course for owners who are not technical." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Run the free security scan",
    href: "/scan",
    text: "Start with what a stranger can already see. The free scan checks your domain's public email settings and tells you in plain words what to fix first. No login, nothing touched, and your IT provider stays in charge.",
  },
};
