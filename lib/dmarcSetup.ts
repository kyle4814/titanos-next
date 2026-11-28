// Data for /email-security/setup (hub) and /email-security/setup/[provider] (9 pages).
// Every vendor fact below was read from the vendor's own help page (or, where marked, a named secondary source) on 2026-11-28.
// Where a vendor page could not be read, the page says so and gives the record values only; nothing here is invented.
// Plain data only (no imports) so lib/routes.ts and the node test can load it.

export const DMARC_SETUP_REVIEWED = "2026-11-28";
export const DMARC_SETUP_REVIEWED_LONG = "28 November 2026";
export const DMARC_SETUP_BASE = "/email-security/setup";

export type Source = { label: string; url: string };
export type Faq = { q: string; a: string };
export type FieldRow = { record: string; type: string; name: string; value: string };

export type Provider = {
  slug: string;
  name: string;
  group: "Registrar" | "DNS host" | "Email platform" | "Website builder";
  title: string;
  description: string;
  h1: string;
  primaryTerm: string;
  terms: string[];
  summary: string;
  intro: string[];
  checked: string;
  findDns: { heading: string; steps: string[] };
  hostFormat: { heading: string; body: string[]; rows: FieldRow[] };
  spf: { heading: string; body: string[]; record: string };
  dkim: { heading: string; body: string[]; steps: string[] };
  dmarc: { heading: string; body: string[]; record: string };
  gotchas: { t: string; d: string }[];
  verifyNote: string;
  faq: Faq[];
  sources: Source[];
  related: string[];
};

export const RFC_SOURCES: Source[] = [
  { label: "RFC 7208: Sender Policy Framework (SPF)", url: "https://datatracker.ietf.org/doc/html/rfc7208" },
  { label: "RFC 6376: DomainKeys Identified Mail (DKIM) signatures", url: "https://datatracker.ietf.org/doc/html/rfc6376" },
  { label: "RFC 7489: DMARC", url: "https://datatracker.ietf.org/doc/html/rfc7489" },
];

export type RolloutStage = { stage: string; when: string; record: string; doThis: string; moveOnWhen: string };

// Our recommended rhythm. The vendors (Microsoft, Google, Cloudflare) all say start at none and move up slowly; none of them publishes a fixed calendar.
export const ROLLOUT: RolloutStage[] = [
  {
    stage: "1. Watch",
    when: "Day 0 to week 4",
    record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@example.com.au",
    doThis: "Publish the record and change nothing else. Read the daily aggregate reports and list every system that sends as your domain: your mail platform, your invoicing tool, your newsletter service, your booking system, your website contact form.",
    moveOnWhen: "Every legitimate sender passes SPF or DKIM in the reports for two weeks in a row, and you can explain every unknown sending address.",
  },
  {
    stage: "2. Quarantine, small slice",
    when: "Week 4 to week 8",
    record: "v=DMARC1; p=quarantine; pct=10; rua=mailto:dmarc-reports@example.com.au",
    doThis: "Ask receivers to treat 10 percent of failing mail as suspicious. Raise it to 25, then 50 once a week, checking the reports and asking staff whether anything real went missing.",
    moveOnWhen: "Two clean weeks at pct=50 with no legitimate mail failing.",
  },
  {
    stage: "3. Quarantine, all",
    when: "Week 8 to week 10",
    record: "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@example.com.au",
    doThis: "All failing mail is treated as suspicious. This is the safe place to pause if you run a lot of third-party senders.",
    moveOnWhen: "Two clean weeks at pct=100.",
  },
  {
    stage: "4. Reject",
    when: "Week 10 onward",
    record: "v=DMARC1; p=reject; rua=mailto:dmarc-reports@example.com.au",
    doThis: "Failing mail is refused. Keep reading the reports monthly, and add any new sending service to SPF and DKIM before it goes live.",
    moveOnWhen: "You are done. Review again whenever you add or retire a sending service.",
  },
];

const P = DMARC_SETUP_BASE;
export const providerPath = (slug: string) => `${P}/${slug}`;

export const PROVIDERS: Provider[] = [
  // ---------------------------------------------------------------- GODADDY
  {
    slug: "godaddy",
    name: "GoDaddy",
    group: "Registrar",
    title: "How to Set Up DMARC on GoDaddy (SPF, DKIM, DMARC)",
    description: "How to set up DMARC on GoDaddy: the exact Name and Value to enter for SPF, DKIM and DMARC, the default record to check first, and a safe p=none rollout.",
    h1: "How to Set Up DMARC on GoDaddy",
    primaryTerm: "how to set up dmarc godaddy",
    terms: ["how to set up dmarc godaddy", "godaddy dmarc record", "godaddy spf dkim dmarc"],
    summary: "At GoDaddy a DMARC record is one TXT record with the Name _dmarc. Check whether GoDaddy has already created one before you add another, because two DMARC records cancel each other out.",
    intro: [
      "GoDaddy is the registrar for a large share of Australian small business domains, and it is also where many owners first meet the words SPF, DKIM and DMARC, usually in a warning from Google or Yahoo about bulk mail. The records themselves are ordinary DNS records. The part that trips people up is GoDaddy's own screen: what to type in the Name box, whether a record already exists, and whether GoDaddy is even the place that controls your DNS.",
      "This page walks through the three records in the order that keeps your real email flowing: SPF first, then DKIM, then DMARC at p=none. GoDaddy's own help states the same order for Microsoft 365 domains: you must add SPF and enable DKIM before you add DMARC.",
    ],
    checked: "Read on 28 November 2026: the GoDaddy help results for adding a TXT record and for adding a DMARC record for Microsoft 365, plus the Valimail GoDaddy walkthrough for the default-record detail. GoDaddy's help pages refused our automated fetch (HTTP 403), so the field names come from the search excerpts of those pages and the secondary guide; confirm each label against your own screen.",
    findDns: {
      heading: "Step 1: Open the DNS screen for your domain",
      steps: [
        "Sign in to GoDaddy and open your Domain Portfolio.",
        "Select the domain, then choose DNS.",
        "Look at the nameservers shown for the domain. If they are GoDaddy's, the records go here. If they point to Cloudflare, Microsoft, your web host or anyone else, GoDaddy's own instructions say to update the records with that DNS provider instead, or your changes will do nothing.",
        "Before adding anything, scan the list for existing TXT records. Note any record that begins v=spf1 and any record named _dmarc.",
      ],
    },
    hostFormat: {
      heading: "What goes in the Name box at GoDaddy",
      body: [
        "GoDaddy fills in your domain for you. For a record on the root of your domain you enter @. For anything else you enter only the prefix. So the DMARC record is Name _dmarc, never _dmarc.yourbusiness.com.au. If you type the full name you end up with a record at _dmarc.yourbusiness.com.au.yourbusiness.com.au, which no receiver will ever read.",
        "GoDaddy's help gives the example prefix mail for a subdomain, which is the same rule: type the part before your domain, and nothing after it.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "@", value: "v=spf1 include:spf.protection.outlook.com ~all (Microsoft 365 example)" },
        { record: "DKIM (Microsoft 365)", type: "CNAME", name: "selector1._domainkey and selector2._domainkey", value: "the two targets shown in the Microsoft Defender portal" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at GoDaddy",
      body: [
        "SPF is one TXT record on the root, Name @. The value depends on who sends your email. For Microsoft 365 it includes spf.protection.outlook.com. For Google Workspace it includes _spf.google.com. For email bought with GoDaddy hosting, use the values in GoDaddy's help article on SPF, DKIM and DMARC for hosting email, because they are specific to that product.",
        "A domain may have only one SPF record. If GoDaddy or a past setup already created a line beginning v=spf1, click Edit on it and add your new include inside the same line. Adding a second SPF record makes SPF fail for everybody.",
      ],
      record: "v=spf1 include:spf.protection.outlook.com ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at GoDaddy",
      body: [
        "GoDaddy does not make your DKIM key. Your email platform does, and GoDaddy only publishes it. For Microsoft 365 the platform gives you two CNAME records (selector1 and selector2). For Google Workspace it gives you one TXT record named google._domainkey. The Microsoft 365 and Google Workspace pages on this site show where to get each value.",
      ],
      steps: [
        "Generate the DKIM values in your email platform first, and keep that screen open.",
        "In GoDaddy DNS choose Add New Record and pick the type your platform asked for (CNAME for Microsoft 365, TXT for Google Workspace).",
        "In Name enter only the host part, for example selector1._domainkey or google._domainkey. Paste the value exactly as given.",
        "Save, wait for the change to spread, then switch signing on in the email platform.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at GoDaddy",
      body: [
        "Add a TXT record with Name _dmarc. Start at p=none with a reporting address you actually read, ideally a shared mailbox and not your own inbox, because reports arrive daily and are machine-generated XML.",
        "Check for an existing record first. A secondary source (Valimail) reports that GoDaddy has added a default DMARC record with p=quarantine to domains created since April 2025. We could not confirm that on GoDaddy's own pages, so treat it as a reason to look, not as a fact about your domain. If a _dmarc record exists, edit it. Do not add a second one.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Nameservers decide everything", d: "If the domain is registered at GoDaddy but the nameservers point elsewhere, GoDaddy's DNS screen is a decoy. Edit the records where the nameservers point." },
      { t: "A default quarantine record may already exist", d: "A p=quarantine record that you did not write can block legitimate mail from a system you have not set up SPF or DKIM for yet. Look before you add." },
      { t: "Do not type the full hostname", d: "Name is _dmarc, selector1._domainkey or @. GoDaddy adds the domain itself." },
      { t: "Waiting time", d: "GoDaddy says most DNS changes take effect within an hour but can take up to 48 hours to update everywhere. Do not make a second change on the same record while you wait." },
      { t: "One SPF record only", d: "Edit the existing line. Two v=spf1 records cause a permanent SPF error." },
    ],
    verifyNote: "Wait an hour after saving, then run the free check below. If it shows no DMARC record, the most common GoDaddy cause is a Name typed with the domain on the end.",
    faq: [
      { q: "Does GoDaddy add DMARC automatically?", a: "A secondary source reports GoDaddy has added a p=quarantine DMARC record by default on domains created since April 2025. Older domains may have none. Check your DNS list for a TXT record named _dmarc before adding one." },
      { q: "What do I type in the GoDaddy Name field for DMARC?", a: "_dmarc, and nothing after it. GoDaddy appends your domain automatically." },
      { q: "Can I set DMARC at GoDaddy if my email is Microsoft 365?", a: "Yes, if GoDaddy hosts your DNS. GoDaddy's own help for Microsoft 365 says to add SPF and enable DKIM before adding the DMARC record." },
    ],
    sources: [
      { label: "GoDaddy help: Add a TXT record", url: "https://www.godaddy.com/en-au/help/add-a-txt-record-19232" },
      { label: "GoDaddy help: Add a DMARC record to my domain for Microsoft 365", url: "https://www.godaddy.com/en-au/help/add-a-dmarc-record-to-my-domain-for-microsoft-365-42204" },
      { label: "GoDaddy help: Set up SPF, DKIM or DMARC records for my hosting email", url: "https://www.godaddy.com/help/set-up-spf-dkim-or-dmarc-records-for-my-hosting-email-40810" },
      { label: "Valimail: GoDaddy DMARC setup (secondary source, default-record detail)", url: "https://www.valimail.com/blog/godaddy-dmarc-setup/" },
    ],
    related: ["crazy-domains", "microsoft-365", "cloudflare"],
  },

  // ---------------------------------------------------------------- CRAZY DOMAINS
  {
    slug: "crazy-domains",
    name: "Crazy Domains",
    group: "Registrar",
    title: "DMARC Record on Crazy Domains: Step-by-Step Setup",
    description: "How to add a DMARC record on Crazy Domains: where the DNS Settings tab is, the Sub Domain value for _dmarc, the nameserver catch and a safe p=none rollout.",
    h1: "DMARC Record on Crazy Domains",
    primaryTerm: "how to set up dmarc crazy domain",
    terms: ["how to set up dmarc crazy domain", "dmarc record crazy domains", "crazy domains spf record"],
    summary: "On Crazy Domains you add DMARC as a TXT record from the DNS Settings tab of the Account Manager, with _dmarc as the sub domain. It only works if your domain actually uses Crazy Domains nameservers.",
    intro: [
      "Crazy Domains is an Australian-founded registrar and web host, and a lot of small business sites were bought there years ago and left alone. That history matters for email security: the domain may have DNS in the Account Manager, in a cPanel or Plesk hosting panel, or on a separate nameserver set, and only one of those is live.",
      "The steps below follow Crazy Domains' own help article on managing DNS records in the Account Manager, then add the SPF, DKIM and DMARC values themselves.",
    ],
    checked: "Read on 28 November 2026: search excerpts of Crazy Domains' help articles on managing DNS records in Account Manager and in cPanel, Titan email records and Google Workspace verification, and Zoho's guide to its Crazy Domains screens. Crazy Domains' own page refused our automated fetch (HTTP 403), and Crazy Domains' articles disagree with each other on whether Standard DNS includes TXT records. Field labels differ between screen versions, so match them by meaning.",
    findDns: {
      heading: "Step 1: Find the DNS screen that is actually live",
      steps: [
        "Sign in to the Crazy Domains Account Manager, open Domains and select your domain.",
        "Open the DNS Settings tab. Crazy Domains states that Account Manager records only take effect if the domain uses ns1.crazydomains.com and ns2.crazydomains.com. A domain on ns1.dnspackage.com and ns2.dnspackage.com uses Premium DNS, and changes sync with the same settings.",
        "If your website runs on Crazy Domains Linux hosting, DNS for it is handled in cPanel (Zone Editor). Windows hosting uses Plesk. Each has its own help article, and you edit whichever one your nameservers point to.",
        "If Add Record offers no TXT option, one Crazy Domains article says advanced records need Premium DNS, while another says Standard DNS includes TXT. Check which plan your domain has, or ask Crazy Domains support before assuming it is blocked.",
      ],
    },
    hostFormat: {
      heading: "What goes in the Sub Domain or Host box at Crazy Domains",
      body: [
        "Crazy Domains' article describes the field as Sub Domain: leave it empty for the root domain and enter a sub domain otherwise. Some screens and third-party guides label the same box Host and use @ for the root. Either way the rule is the same as everywhere else: type only the prefix.",
        "For DMARC that means _dmarc in the Sub Domain or Host box, and your policy in the Content or TXT Value box. Paste the value without wrapping it in quotation marks unless the screen asks for them.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "(empty) or @", value: "v=spf1 include:spf.titan.email ~all (Titan Email example)" },
        { record: "DKIM", type: "TXT or CNAME", name: "the host your email provider gives, for example google._domainkey", value: "the value your email provider gives" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at Crazy Domains",
      body: [
        "Crazy Domains' own Titan Email article uses the SPF value v=spf1 include:spf.titan.email ~all on the root domain. If you use Titan, that is your starting line. If your mail is Microsoft 365 or Google Workspace, use the include value from the Microsoft 365 or Google Workspace page on this site instead.",
        "Whatever you use, keep to one SPF record. If the Account Manager already lists a line that starts v=spf1 (it often does, from an older hosting plan), edit it and add your include inside it.",
      ],
      record: "v=spf1 include:spf.titan.email ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at Crazy Domains",
      body: [
        "Crazy Domains does not create DKIM keys for outside email platforms. Your mail provider produces the key and Crazy Domains publishes it. Titan, Microsoft 365 and Google Workspace each show the exact host and value in their own admin screen.",
      ],
      steps: [
        "Generate the DKIM record in your email provider first.",
        "In DNS Settings choose Add Record and pick the type the provider asked for.",
        "Enter only the host prefix, for example google._domainkey, in the Sub Domain or Host field.",
        "Paste the value in full. Long DKIM keys are often over 255 characters, and cPanel-style editors may need the value split into more than one quoted string. If a record will not save, ask the provider or Crazy Domains support how to enter it.",
        "Save, wait, then turn signing on at the email provider.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at Crazy Domains",
      body: [
        "Add a TXT record with Sub Domain _dmarc and start at p=none. Use a reporting mailbox on a different domain only if that domain has published permission to receive your reports; the simplest option is a mailbox on your own domain.",
        "Crazy Domains says changes can take up to 48 hours, and a newer version of its article says 4 to 48 hours. Plan for the longer figure on your first record.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Wrong panel, no effect", d: "The Account Manager, cPanel and Plesk each hold their own copy of the zone. Only the one your nameservers point to counts." },
      { t: "TXT may sit behind Premium DNS", d: "Crazy Domains' articles disagree. If the TXT option is missing, confirm your DNS plan before paying for anything." },
      { t: "Sub Domain or Host, same idea", d: "Empty or @ for the root, _dmarc for DMARC. Never the full domain." },
      { t: "Long DKIM keys", d: "A 2048-bit DKIM value is longer than one 255-character DNS string. If saving fails, the value needs to be split across strings." },
      { t: "Slow first change", d: "Allow up to 48 hours before deciding it failed." },
    ],
    verifyNote: "Run the free check after a few hours and again the next day. A missing result after 48 hours usually means the record was saved in a panel your nameservers do not use.",
    faq: [
      { q: "Where do I add a TXT record in Crazy Domains?", a: "In the Account Manager, open Domains, choose your domain, open the DNS Settings tab, choose Add Record and select TXT. Hosting customers may need cPanel or Plesk instead." },
      { q: "Does Crazy Domains support TXT records on Standard DNS?", a: "Its help articles disagree. One lists TXT among Standard DNS records and one says advanced records such as TXT need Premium DNS. Check your own screen or ask support." },
      { q: "What do I put in the Sub Domain field for DMARC?", a: "_dmarc. For SPF on the root domain, leave it empty or use @ depending on the screen." },
    ],
    sources: [
      { label: "Crazy Domains help: Manage DNS records in Account Manager", url: "https://www.crazydomains.com.au/help/article/manage-dns-records-in-account-manager" },
      { label: "Crazy Domains help: Manage DNS records in cPanel", url: "https://www.crazydomains.com.au/help/article/manage-dns-records-in-cpanel" },
      { label: "Crazy Domains help: Set up MX and TXT records for Titan Email", url: "https://www.crazydomains.com/help/article/set-up-mx-and-txt-records-for-titan-email" },
      { label: "Crazy Domains help: Crazy Domains DNS", url: "https://www.crazydomains.com.au/help/article/crazy-domains-dns-management" },
    ],
    related: ["ventraip", "netregistry", "godaddy"],
  },

  // ---------------------------------------------------------------- VENTRAIP
  {
    slug: "ventraip",
    name: "VentraIP",
    group: "Registrar",
    title: "How to Set Up DMARC on VentraIP (VIPcontrol, cPanel)",
    description: "How to set up DMARC on VentraIP: add _dmarc in VIPcontrol DNS or use the cPanel DMARC record wizard, plus SPF and DKIM notes and a safe p=none rollout.",
    h1: "How to Set Up DMARC on VentraIP",
    primaryTerm: "how to set up dmarc VentraIP",
    terms: ["how to set up dmarc VentraIP", "ventraip dmarc record", "ventraip spf record"],
    summary: "VentraIP gives you two routes: add a TXT record with the hostname _dmarc in VIPcontrol, or use the Add DMARC Record option in the cPanel Zone Editor. Use whichever matches where your nameservers point.",
    intro: [
      "VentraIP is one of the better documented Australian registrars for this job. It has an official article for each route, and the cPanel route even includes a DMARC record builder. That makes it easy to do correctly and also easy to do in the wrong place, because a VentraIP customer can have DNS in VIPcontrol, in cPanel, or both.",
      "Work through the steps in order. Do SPF and DKIM for your mail service first so that the DMARC reports are readable, then publish DMARC at p=none.",
    ],
    checked: "Read in full on 28 November 2026: VentraIP's articles Adding a DMARC record and Add, remove or manage DNS records within VIPcontrol. Also read: search excerpts of the cPanel DMARC and cPanel DNS articles. VentraIP's SPF include value for its own mail hosting was not on a VentraIP page we could read, so none is given here.",
    findDns: {
      heading: "Step 1: Choose VIPcontrol or cPanel",
      steps: [
        "Sign in to VIPcontrol and open the Domains tab. Click DNS next to your domain. That is the central DNS table VentraIP provides with every domain registration.",
        "If your website and email live on a VentraIP cPanel hosting plan and the domain uses the hosting nameservers, DNS is edited in cPanel instead: open Zone Editor and click Manage next to the domain.",
        "Not sure which is live? Check the nameservers on the domain. Records you add in a zone your nameservers do not use are ignored.",
      ],
    },
    hostFormat: {
      heading: "What goes in the Hostname box at VentraIP",
      body: [
        "VentraIP's DNS article says the Hostname holds only the subdomain the record applies to, and to leave it blank for the root domain. Its own example is written as a full domain, so if your first record does not appear in the check, ask support which form they want. The DMARC article is clear: for VIPcontrol the Hostname is _dmarc.",
        "The Priority column is for MX records only, so leave it alone for TXT. VentraIP recommends keeping the default TTL.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "(blank for the root)", value: "v=spf1 followed by your mail provider's include, ending ~all" },
        { record: "DKIM", type: "TXT or CNAME", name: "the host your mail provider gives", value: "the value your mail provider gives" },
        { record: "DMARC (VIPcontrol)", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at VentraIP",
      body: [
        "In the VIPcontrol DNS table choose type TXT in the first column, leave Hostname blank for the root, paste the SPF line in Value and click the plus icon. The include value comes from your mail service, not from VentraIP: Microsoft 365 uses spf.protection.outlook.com and Google Workspace uses _spf.google.com. For mail hosted on VentraIP itself, take the include from VentraIP's email hosting documentation.",
        "If a v=spf1 line already exists in the table, edit it. One SPF record per domain.",
      ],
      record: "v=spf1 include:spf.protection.outlook.com ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at VentraIP",
      body: [
        "DKIM is created by your mail service. VentraIP only stores the result. Use the same table: choose TXT or CNAME to match what the mail service asked for, enter its host prefix (for example selector1._domainkey) and paste its value.",
      ],
      steps: [
        "Generate the DKIM record in Microsoft 365, Google Workspace or your mail host.",
        "Add it in VIPcontrol (Domains, DNS) with the type and host the service gave you.",
        "Wait. VentraIP says allow 2 to 8 hours (one article also says 2 to 6).",
        "Turn signing on in the mail service.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at VentraIP",
      body: [
        "VIPcontrol route: Domains, DNS, type TXT, Hostname _dmarc, paste the record in Value, click the plus button. VentraIP's basic example is v=DMARC1; p=none, which applies no enforcement and is for collecting reports. Add rua so the reports actually come to you.",
        "cPanel route: Zone Editor, Manage, open the drop-down beside Add Record, choose Add DMARC Record, pick a policy type to generate the record or use the Raw tab to enter your own, then click Add Record.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Two places to edit", d: "VIPcontrol DNS and the cPanel Zone Editor can hold separate zones. Edit the one your nameservers use." },
      { t: "Priority is for MX", d: "Leave Priority empty on TXT and CNAME records." },
      { t: "Relative hostnames", d: "Enter _dmarc, not _dmarc.yourbusiness.com.au. Blank means the root." },
      { t: "Allow hours, not minutes", d: "VentraIP's articles say 2 to 8 hours. Checking after five minutes will mislead you." },
      { t: "Generated records still need rua", d: "The cPanel builder produces a valid policy, but you still need to enter your reporting address in the optional fields or you will fly blind." },
    ],
    verifyNote: "Check after a couple of hours. Because VentraIP quotes up to 8 hours, a result that is still missing the next morning is the point to look for the wrong panel or a typo in the hostname.",
    faq: [
      { q: "How do I add a DMARC record in VentraIP?", a: "In VIPcontrol open Domains, click DNS beside the domain, set type TXT, Hostname _dmarc, paste the record into Value and click the plus button. cPanel customers can use Zone Editor and Add DMARC Record instead." },
      { q: "How long does a VentraIP DNS change take?", a: "VentraIP's articles say about 2 to 8 hours (one says 2 to 6)." },
      { q: "Does VentraIP create my DKIM key?", a: "Your mail service creates it. VentraIP stores the TXT or CNAME record that service gives you." },
    ],
    sources: [
      { label: "VentraIP: Adding a DMARC record", url: "https://ventraip.com.au/support-centre/adding-a-dmarc-record/" },
      { label: "VentraIP: Add, remove or manage DNS records within VIPcontrol", url: "https://ventraip.com.au/support-centre/add-remove-or-manage-dns-records-within-vipcontrol/" },
      { label: "VentraIP: Adding a DMARC record using cPanel", url: "https://ventraip.com.au/support-centre/adding-a-dmarc-record-using-cpanel/" },
    ],
    related: ["netregistry", "crazy-domains", "google-workspace"],
  },

  // ---------------------------------------------------------------- NETREGISTRY
  {
    slug: "netregistry",
    name: "Netregistry",
    group: "Registrar",
    title: "How to Set Up DMARC on Netregistry (Zone Manager)",
    description: "How to set up SPF, DKIM and DMARC on Netregistry: the exact records to enter in the Zone Manager, how to confirm the host format, and a safe p=none rollout.",
    h1: "How to Set Up DMARC on Netregistry",
    primaryTerm: "how to set up dmarc Netregistry",
    terms: ["how to set up dmarc Netregistry", "netregistry dmarc record", "netregistry spf record"],
    summary: "Netregistry edits DNS records in its Zone Manager, which supports TXT records. This page gives the exact records to enter and a way to prove the host format worked, because Netregistry's current screens could not be read for this guide.",
    intro: [
      "Netregistry is one of the older Australian registrars and is part of the Webcentral group, so help articles and logins may sit under either name. A lot of small businesses have a Netregistry domain they have not logged into for years, and that is usually where an email-spoofing gap hides.",
      "We will be direct about what we could and could not confirm. Netregistry's support site says its Zone Manager lets you change A, CNAME, MX, NS, TXT or SRV records, so a DMARC TXT record is supported. We could not load the current Zone Manager help pages when writing this, so we do not describe button names we have not seen. We give you the exact record values and a test that proves the record went in correctly.",
    ],
    checked: "Read on 28 November 2026: search excerpts of Netregistry's support articles (Manage your domain, Why isn't my domain name working, Creating MX zone records). The pages themselves returned a parked-domain placeholder to our fetcher, so no Zone Manager screen is described step by step. Match the field names on your own screen to the table below.",
    findDns: {
      heading: "Step 1: Reach the Zone Manager",
      steps: [
        "Sign in to your Netregistry account and open the domain you want to protect. Use the Netregistry support site's Manage your domain article if you cannot find the Zone Manager link.",
        "Open the domain's zone records. Netregistry's own pages list the zone record types as A, CNAME, MX, NS, TXT and SRV.",
        "Check the nameservers first. If your domain's nameservers are not Netregistry's, your live DNS is somewhere else (a web host, Cloudflare, Microsoft) and the Zone Manager changes will not be used.",
        "Look for an existing line that starts v=spf1 and any record named _dmarc before you add anything.",
      ],
    },
    hostFormat: {
      heading: "What goes in the host or name box at Netregistry",
      body: [
        "Zone editors fall into two camps: those that add your domain to the end of whatever you type, and those that expect the full name. Netregistry's current screen is not something we could confirm, so use the safe test: enter _dmarc, save, then run the free check. If the check finds the record, you are done. If it finds nothing, open the record and see whether it was saved as _dmarc.yourbusiness.com.au.yourbusiness.com.au. If it was, remove the domain from the end and save again.",
        "Do the same test with the DKIM host (for example selector1._domainkey) so you know the pattern holds before you rely on it.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "the root of the domain (@ or the domain itself, depending on the screen)", value: "v=spf1 followed by your mail provider's include, ending ~all" },
        { record: "DKIM", type: "TXT or CNAME", name: "the host your mail provider gives, for example selector1._domainkey", value: "the value your mail provider gives" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at Netregistry",
      body: [
        "Add one TXT record on the root. The include depends on your mail service: Microsoft 365 uses spf.protection.outlook.com, Google Workspace uses _spf.google.com. For Netregistry or Webcentral email hosting, use the SPF value in that product's help article, not a guess.",
        "If a v=spf1 record already exists, edit it. Two SPF records on one domain produce a permanent error and receivers treat SPF as failed.",
      ],
      record: "v=spf1 include:_spf.google.com ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at Netregistry",
      body: [
        "Your mail service creates the key; the Zone Manager only stores it. The service will show you a host name and a value. Enter them exactly, using the host-format test above.",
      ],
      steps: [
        "Generate the DKIM record in your mail service and leave the page open.",
        "Add the record in the Zone Manager with the type the service asked for.",
        "Netregistry's MX guide warns the standard wait is up to 2 hours; expect similar for TXT and CNAME.",
        "Switch signing on in the mail service once the record is visible in the free check.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at Netregistry",
      body: [
        "Add a TXT record named _dmarc, value as below, at p=none. Netregistry's guides cover MX and general zone changes; the DMARC record itself is a standard TXT line, so it works the same here as anywhere else.",
        "Send reports to a mailbox on your own domain that you or your IT provider will read. If a Netregistry domain is a parked or unused one, do not leave it open: publish v=spf1 -all as SPF and v=DMARC1; p=reject; as DMARC so nobody can send as it.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Live DNS may not be here", d: "Domains registered at Netregistry often have their nameservers pointed at a web host. Check the nameservers before editing." },
      { t: "Host format unknown, so test it", d: "Save _dmarc, run the check, and look for a doubled domain if it fails." },
      { t: "Parked domains need locking down", d: "A Netregistry domain you do not email from still needs v=spf1 -all and a reject DMARC record, or it can be used to send fake mail." },
      { t: "Allow up to 2 hours", d: "Netregistry's own guide quotes up to 2 hours for zone changes." },
      { t: "Ask support early", d: "If the Zone Manager does not offer a TXT type on your plan, ask Netregistry support before anything else." },
    ],
    verifyNote: "This is the registrar where the free check matters most, because we cannot show you the screen. Use it after every single record and fix one thing at a time.",
    faq: [
      { q: "Does Netregistry support DMARC records?", a: "Netregistry's support site says its Zone Manager can change TXT records, and DMARC is published as a TXT record named _dmarc, so yes." },
      { q: "How long do Netregistry DNS changes take?", a: "Its MX zone record guide says standard DNS propagation of up to 2 hours may apply." },
      { q: "I have a Netregistry domain I do not use for email. Do I need DMARC?", a: "Yes. Unused domains can still be faked. Publish v=spf1 -all as SPF and v=DMARC1; p=reject; as DMARC." },
    ],
    sources: [
      { label: "Netregistry support: Manage your domain", url: "https://support.netregistry.com.au/articles/nr/Manage-your-domain" },
      { label: "Netregistry support: Creating MX zone records", url: "https://www.netregistry.com.au/support/creating-mx-zone-records/" },
      { label: "Netregistry support: Why isn't my domain name working", url: "https://support.netregistry.com.au/articles/nr/Why-isn-t-my-domain-name-working" },
    ],
    related: ["ventraip", "crazy-domains", "cloudflare"],
  },

  // ---------------------------------------------------------------- CLOUDFLARE
  {
    slug: "cloudflare",
    name: "Cloudflare",
    group: "DNS host",
    title: "Cloudflare DMARC Setup: SPF, DKIM and DMARC Records",
    description: "Cloudflare DMARC setup: add the _dmarc TXT record in DNS, use DMARC Management for free reports, keep DKIM CNAMEs on DNS only, and roll out from p=none safely.",
    h1: "Cloudflare DMARC Setup: SPF, DKIM and DMARC",
    primaryTerm: "dmarc cloudflare dns setup",
    terms: ["dmarc cloudflare dns setup", "cloudflare dmarc record", "cloudflare spf dkim dmarc"],
    summary: "If your nameservers are Cloudflare's, every email record belongs in the Cloudflare DNS page, whatever registrar you bought the domain from. Cloudflare also offers a free DMARC Management screen that collects the reports for you.",
    intro: [
      "Cloudflare is where many Australian businesses end up for DNS, often after a web developer moved the nameservers. That creates the most common mistake in this whole topic: the owner logs in to the registrar, adds SPF and DMARC there, and nothing happens, because the registrar is no longer the DNS host.",
      "Cloudflare also differs from a registrar in one useful way. It runs DMARC Management, a dashboard that receives your aggregate reports and shows them as charts, so you do not need to read raw XML. This page covers both routes: the plain DNS records and the DMARC Management screen.",
    ],
    checked: "Read on 28 November 2026: Cloudflare developer docs on creating DNS records, DNS record types, enabling DMARC Management and its security records page. Cloudflare's pages do not describe the Name box for TXT records specifically, so the Name guidance below is the standard rule plus a check you can run yourself.",
    findDns: {
      heading: "Step 1: Confirm Cloudflare is your DNS, then open DNS Records",
      steps: [
        "Sign in to the Cloudflare dashboard, select your account and the domain, and open the DNS Records page.",
        "Confirm the domain's nameservers at the registrar are Cloudflare's. If they are not, this dashboard is not live for the domain.",
        "Select Add record, choose the Type, fill in the fields for that type and select Save. Cloudflare's docs list TTL as the field controlling how long the record is valid, and Comment and Tag as fields for your reference.",
        "Search the list for TXT records starting v=spf1 and for _dmarc before adding.",
      ],
    },
    hostFormat: {
      heading: "What goes in Name, Content and TTL at Cloudflare",
      body: [
        "Enter the short name (_dmarc, or selector1._domainkey) and check the list afterwards: Cloudflare shows the full name with your domain on the end. If you see your domain twice, you typed it in the Name box.",
        "Quoting: Cloudflare's docs say TXT content is one or more strings in double quotes, that inconsistent quotation marks cause a validation error, and that if you save content without any quotes, Cloudflare adds them for you. So paste the value plain, with no quotes.",
        "Proxy status: for A, AAAA and CNAME records you choose whether traffic is proxied. A DKIM CNAME is not web traffic, so set it to DNS only. A proxied CNAME will not return the key the mail service is looking for.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "@", value: "v=spf1 include:_spf.google.com ~all (Google Workspace example)" },
        { record: "DKIM (Microsoft 365)", type: "CNAME", name: "selector1._domainkey and selector2._domainkey (proxy status: DNS only)", value: "the two targets from the Defender portal" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at Cloudflare",
      body: [
        "Add a TXT record, Name @, with your SPF line. The include comes from your mail platform. Cloudflare's DMARC Management documentation adds one warning worth knowing: it does not support SPF changes through its screen when a CNAME in your zone points to an external domain, and changes to SPF can invalidate your DMARC policy, so manage those SPF updates at the external provider.",
        "One v=spf1 record per name. Edit the existing one.",
      ],
      record: "v=spf1 include:_spf.google.com ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at Cloudflare",
      body: [
        "Cloudflare publishes the DKIM record your mail platform gives you. Microsoft 365 uses two CNAMEs, Google Workspace uses one TXT named google._domainkey.",
      ],
      steps: [
        "Generate the DKIM details in your mail platform.",
        "In DNS Records, Add record, choose CNAME or TXT to match.",
        "For CNAME records, set proxy status to DNS only.",
        "Save, then switch signing on in the mail platform once the record is live.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at Cloudflare, by hand or with DMARC Management",
      body: [
        "By hand: add a TXT record named _dmarc at p=none, with your own rua address. Done.",
        "With DMARC Management: in the dashboard go to Email, then DMARC Management, then Enable DMARC Management. Cloudflare scans your zone. If no DMARC record exists it offers to add one you can edit later. If one exists it adds a second rua address pointing at Cloudflare, so your own address and Cloudflare both receive reports. Cloudflare says the first report can take up to 24 hours. This only works on the apex domain (for example example.com, not blog.example.com) and not on subdomain setups.",
        "Email, DMARC Management, Email record overview, View records also lets you set up SPF, DKIM and DMARC and lists records you already have. Cloudflare's dashboard does not move your policy from none to quarantine to reject for you; you edit the _dmarc TXT record yourself when the time comes.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Registrar records are ignored", d: "If Cloudflare holds your nameservers, records added at GoDaddy, VentraIP or anywhere else do nothing." },
      { t: "DKIM CNAMEs must be DNS only", d: "A proxied CNAME hides the target the mail platform needs." },
      { t: "No quotes needed", d: "Cloudflare adds double quotes if you save without them, and rejects inconsistent quoting." },
      { t: "Apex only for DMARC Management", d: "Subdomains and subdomain setups are not supported by that screen. Use plain DNS records for them." },
      { t: "Extra rua is added automatically", d: "Enabling DMARC Management appends Cloudflare's reporting address to an existing record. Expect to see it when you next read the line." },
    ],
    verifyNote: "Cloudflare changes tend to be visible quickly. Run the free check straight after saving, then again after the next DMARC Management report arrives.",
    faq: [
      { q: "Does Cloudflare set up DMARC for me?", a: "Only if you enable DMARC Management, which offers to add a record if none exists. It does not move your policy from none to reject for you." },
      { q: "Should DKIM CNAMEs be proxied in Cloudflare?", a: "No. Set them to DNS only so the mail platform can read the key." },
      { q: "Why did my registrar's DMARC record not work?", a: "If your nameservers are Cloudflare's, only the Cloudflare zone counts. Add the record in Cloudflare." },
    ],
    sources: [
      { label: "Cloudflare docs: Create DNS records", url: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/" },
      { label: "Cloudflare docs: DNS record types (TXT)", url: "https://developers.cloudflare.com/dns/manage-dns-records/reference/dns-record-types/" },
      { label: "Cloudflare docs: Enable DMARC Management", url: "https://developers.cloudflare.com/dmarc-management/enable/" },
      { label: "Cloudflare docs: Configure email security records", url: "https://developers.cloudflare.com/dmarc-management/security-records/" },
    ],
    related: ["godaddy", "microsoft-365", "google-workspace"],
  },

  // ---------------------------------------------------------------- MICROSOFT 365
  {
    slug: "microsoft-365",
    name: "Microsoft 365",
    group: "Email platform",
    title: "Microsoft 365 DKIM Setup, Plus SPF and DMARC",
    description: "Microsoft 365 DKIM setup step by step: enable it in the Defender portal, publish the selector1 and selector2 CNAMEs, then add SPF and a p=none DMARC record.",
    h1: "Microsoft 365 DKIM Setup (and SPF and DMARC)",
    primaryTerm: "microsoft 365 dkim setup",
    terms: ["microsoft 365 dkim setup", "how to set up dmarc microsoft 365 small business", "office 365 spf dkim dmarc"],
    summary: "Microsoft 365 has no screen for SPF or DMARC records: you publish those at your DNS host. DKIM is the odd one out, because you switch it on in the Defender portal and publish two CNAME records that Microsoft generates for you.",
    intro: [
      "Microsoft 365 is the email platform behind a huge share of Australian small business mail. It signs outbound mail with DKIM only when you turn that on for your own domain, and it will not publish SPF or DMARC for you. Microsoft's own documentation says there are no admin portals or PowerShell cmdlets for managing SPF or DMARC records in custom domains; you create them at your registrar or DNS hosting service.",
      "This page is the one to follow if your mailboxes are Microsoft 365, whoever your registrar is. The registrar pages (GoDaddy, Crazy Domains, VentraIP, Netregistry, Cloudflare) show where to type the values; this page shows what the values are.",
    ],
    checked: "Read in full on 28 November 2026: Microsoft Learn pages on SPF, DKIM and DMARC configuration for Microsoft 365 (all updated July to August 2026 per their page headers).",
    findDns: {
      heading: "Step 1: Work out your domains and where DNS lives",
      steps: [
        "In the Microsoft 365 admin centre, go to Settings, Domains and list every domain and subdomain that sends mail. Each one needs its own SPF record, and each sending domain needs DKIM.",
        "Find out where each domain's DNS is hosted (registrar, web host or Cloudflare). All the records below are published there, not in Microsoft.",
        "Note your initial domain (yourcompany.onmicrosoft.com). Its prefix appears inside the DKIM CNAME values.",
        "If you have domains that do not send mail, plan to lock them down with v=spf1 -all and a reject DMARC record (Microsoft gives both values for parked domains).",
      ],
    },
    hostFormat: {
      heading: "The exact host names and values for Microsoft 365",
      body: [
        "Microsoft documents the host names as the same for every organisation: selector1._domainkey and selector2._domainkey. The targets are not the same for everyone, so never copy them from a blog post, including this one. Take them from the Defender portal or from PowerShell.",
        "Microsoft's current format is selector1-<your-domain-with-dashes>._domainkey.<initial-domain-prefix>.<letter>-v1.dkim.mail.microsoft. The older format ends in .onmicrosoft.com. Microsoft says the old and new formats cannot coexist for the same selector, so if one does not validate, check you did not mix them.",
        "To read the exact values in PowerShell run Get-DkimSigningConfig -Identity yourdomain.com.au | Format-List Name,Enabled,Status,Selector1CNAME,Selector2CNAME.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "@", value: "v=spf1 include:spf.protection.outlook.com -all" },
        { record: "DKIM 1", type: "CNAME", name: "selector1._domainkey", value: "the Selector1CNAME value from Microsoft" },
        { record: "DKIM 2", type: "CNAME", name: "selector2._domainkey", value: "the Selector2CNAME value from Microsoft" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF for Microsoft 365",
      body: [
        "If Microsoft 365 is your only sender, Microsoft's documented record is v=spf1 include:spf.protection.outlook.com -all. Microsoft recommends -all (hard fail) for Microsoft 365 domains because DKIM and DMARC are also in place; its documentation notes that DMARC policy is effectively ignored for SPF soft-fail results when a message carries no DKIM signature.",
        "If you also send from other services, add their include values inside the same record and keep below 10 DNS lookups. Each include: counts as at least one lookup, and nested includes add more. Microsoft suggests moving bulk or third-party senders to a subdomain such as marketing.yourdomain.com.au, which has its own SPF record and its own 10-lookup budget. Do not flatten the Microsoft include into IP addresses: Microsoft says its sending addresses change often.",
        "The common typing errors Microsoft lists are a trailing full stop after the domain, an equals sign instead of a colon after include, and a space after the colon. All three break SPF.",
      ],
      record: "v=spf1 include:spf.protection.outlook.com -all",
    },
    dkim: {
      heading: "Step 3: Turn on DKIM in the Defender portal",
      body: [
        "Microsoft generates two key pairs when you enable DKIM for a custom domain. One selector signs mail now; the other waits for the next key rotation. That is why there are two CNAME records and why you must publish both.",
        "Steps from Microsoft's documentation, in the Defender portal at security.microsoft.com:",
      ],
      steps: [
        "Go to Email and collaboration, Policies and rules, Threat policies, Email authentication settings, then the DKIM tab.",
        "Select your custom domain. The flyout shows the status and, under Publish CNAMEs, the two records to create. If you try to turn signing on before the records exist, Microsoft shows an error that contains the required values, and the status reads CnameMissing.",
        "Create the two CNAME records at your DNS host using the host names selector1._domainkey and selector2._domainkey and the targets shown.",
        "Wait a few minutes or longer, then return to the domain and switch the toggle to Enabled. Once enabled, Rotate DKIM keys becomes available.",
        "Repeat for every custom domain and subdomain that sends mail. Do not publish DKIM CNAMEs on parked domains; Microsoft says that is not recommended.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC for Microsoft 365",
      body: [
        "Add a TXT record, host _dmarc. Microsoft's own rollout advice matches the plan on this page: start at p=none and monitor, move to p=quarantine (using pct to widen gradually through 10, 25, 50, 75, 100), then p=reject, and do the lowest-risk subdomains first and the parent domain last.",
        "Two Microsoft facts worth knowing before you go to enforcement. First, outbound mail from a Microsoft 365 domain that fails DMARC at the receiver is routed through the high-risk delivery pool when the policy is quarantine or reject, with no override. Second, the DMARC record on a parent domain covers all subdomains, including ones that do not exist, unless they publish their own.",
        "Inbound: Microsoft 365 sends aggregate reports to other domains only if your MX record points directly at Microsoft 365, and it does not send forensic (ruf) reports at all.",
      ],
      record: "v=DMARC1; p=none; pct=100; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "The CNAME targets are yours alone", d: "They contain your domain and your initial domain prefix. Copy them from the Defender portal." },
      { t: "Both selectors, always", d: "Publishing only selector1 leaves the second key unpublished and breaks rotation." },
      { t: "Old and new CNAME formats cannot be mixed", d: "A selector that validates in one format will not in the other." },
      { t: "Too many SPF lookups", d: "More than 10 lookups gives a permanent error. Move bulk senders to a subdomain." },
      { t: "Parked domains and onmicrosoft.com", d: "Lock down unused domains, and publish a DMARC record for your onmicrosoft.com domain if you do not send from it, using Add record in the admin centre domain page." },
    ],
    verifyNote: "After enabling DKIM, send a message to an outside address and check the headers for dkim=pass and the selector name. Then run the free check for SPF and DMARC.",
    faq: [
      { q: "How do I set up DKIM in Microsoft 365?", a: "In the Defender portal open Email authentication settings, the DKIM tab, select the domain, publish the two selector CNAME records Microsoft shows at your DNS host, then switch the toggle to Enabled." },
      { q: "Does Microsoft 365 publish SPF and DMARC for my domain?", a: "No. Microsoft's documentation says there are no admin portals or cmdlets for those; you add them at your DNS host." },
      { q: "What is the SPF record for Microsoft 365?", a: "v=spf1 include:spf.protection.outlook.com -all when Microsoft 365 is your only sender. Add other senders' includes inside the same record." },
      { q: "Why does my DKIM status say CnameMissing?", a: "Microsoft cannot see the two CNAME records yet. Check the host names, the targets, and wait for DNS to catch up." },
    ],
    sources: [
      { label: "Microsoft Learn: Set up SPF in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-spf-configure" },
      { label: "Microsoft Learn: Set up DKIM in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dkim-configure" },
      { label: "Microsoft Learn: Set up DMARC in Microsoft 365", url: "https://learn.microsoft.com/en-us/defender-office-365/email-authentication-dmarc-configure" },
      { label: "Microsoft Learn: Add DNS records at any DNS hosting provider", url: "https://learn.microsoft.com/en-us/microsoft-365/admin/get-help-with-domains/create-dns-records-at-any-dns-hosting-provider" },
    ],
    related: ["google-workspace", "godaddy", "cloudflare"],
  },

  // ---------------------------------------------------------------- GOOGLE WORKSPACE
  {
    slug: "google-workspace",
    name: "Google Workspace",
    group: "Email platform",
    title: "How to Set Up DMARC in Google Workspace (SPF, DKIM)",
    description: "How to set up DMARC in Google Workspace: the SPF include, generating a 2048-bit DKIM key in the Admin console, and a p=none DMARC record with reporting.",
    h1: "How to Set Up DMARC in Google Workspace",
    primaryTerm: "how to set up dmarc google workspace",
    terms: ["how to set up dmarc google workspace", "google workspace dkim setup", "google workspace spf record"],
    summary: "In Google Workspace you generate the DKIM key in the Admin console, publish it as a TXT record named google._domainkey at your DNS host, then start authentication. SPF is a one-line include, and DMARC comes last.",
    intro: [
      "Google Workspace is the other half of Australian small business email, and it has the most precise order of operations of any provider on this site. Get the order wrong and the Admin console tells you the key does not exist, or shows a warning for two days that you can safely ignore.",
      "The steps follow Google's own Workspace Admin documentation for SPF, DKIM and DMARC. Your DNS host (a registrar page elsewhere on this site) is where the three records are actually typed in.",
    ],
    checked: "Read on 28 November 2026: Google Workspace Admin pages on setting up SPF, DKIM and DMARC (now hosted at knowledge.workspace.google.com).",
    findDns: {
      heading: "Step 1: Get Gmail switched on, then wait",
      steps: [
        "Make sure Gmail is turned on for the domain in the Admin console and the MX records point to Google.",
        "Google says you must wait 24 to 72 hours after turning on Gmail before you can get your DKIM key. Generating it sooner can produce an error that the DKIM record was not created.",
        "Find where your domain's DNS is hosted (registrar, web host or Cloudflare). That is where you will paste the records.",
        "Check for existing SPF and _dmarc TXT records so you edit rather than duplicate.",
      ],
    },
    hostFormat: {
      heading: "The exact records for Google Workspace",
      body: [
        "Google's SPF page says to enter @ in the host field for a root-domain record, or the sub domain name for a subdomain. For DMARC Google says to add a TXT record at _dmarc.example.com, replacing the example with your domain, and notes that some domain hosts add the domain name automatically, so verify the record after saving.",
        "The DKIM host is the selector prefix followed by ._domainkey. The default prefix is google, so the host is google._domainkey.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "@", value: "v=spf1 include:_spf.google.com ~all" },
        { record: "DKIM", type: "TXT", name: "google._domainkey (or your chosen prefix)", value: "v=DKIM1; k=rsa; p= followed by the key from the Admin console" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF for Google Workspace",
      body: [
        "Google's documented record is v=spf1 include:_spf.google.com ~all. Google recommends the soft-fail ~all, which asks receivers to mark mail from unlisted servers as spam. Each sender gets its own include tag, up to 10, and each domain and subdomain needs its own SPF record.",
        "If you also send from another service, add its include inside the same record. Google's example for Workspace plus Amazon SES is v=spf1 include:_spf.google.com include:amazonses.com ~all. Never create a second v=spf1 record.",
      ],
      record: "v=spf1 include:_spf.google.com ~all",
    },
    dkim: {
      heading: "Step 3: Generate and publish the DKIM key",
      body: [
        "You need to be signed in as a super administrator. Google's order matters: generate the key, publish it at your DNS host, and only then click Start authentication.",
      ],
      steps: [
        "In the Admin console go to Menu, Apps, Google Workspace, Gmail, then Authenticate email.",
        "Choose the domain in the Selected domain menu and click Generate New Record.",
        "Pick the key length. Google prefers 2048 bits if your domain host supports it, and offers 1024 for hosts that do not. Keep the prefix selector as google unless your domain already has a key with that prefix.",
        "Copy the DNS host name (google._domainkey) and the TXT record value (v=DKIM1; k=rsa; p=...).",
        "Do not click Start authentication yet. Add the TXT record at your DNS host first.",
        "Return to Authenticate email and click Start authentication. Google says it can take up to 48 hours to start working, and the console may keep saying you must update DNS for up to 48 hours. If you have already published the record, ignore it.",
        "Repeat with a separate key for each additional domain.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC for Google Workspace",
      body: [
        "Google says to allow 48 hours after setting up SPF and DKIM before you set up DMARC. Start at p=none: messages are delivered and daily reports go to your rua address. Over time change the policy to quarantine and then reject as you confirm legitimate mail is passing. Google says the v and p tags must come first, pct must be a whole number from 1 to 100, and that it recommends you always include rua, ideally pointing to a dedicated mailbox, group or reporting service because the volume can be high.",
        "Two facts that matter later. Gmail does not support the ruf tag. And if you plan to use BIMI (a brand logo in the inbox), Google says p must be quarantine or reject and pct must be 100.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Generate too early and it fails", d: "Wait 24 to 72 hours after turning Gmail on, or the key may not exist yet." },
      { t: "Do not click Start authentication first", d: "Publish the TXT record, then start authentication." },
      { t: "2048-bit keys are long", d: "Some DNS hosts cannot take a 2048-bit TXT value. That is what the 1024-bit option is for, but try the 2048-bit key first." },
      { t: "One key per domain", d: "Every sending domain needs its own generated key." },
      { t: "The console warning lingers", d: "It can keep asking for DNS updates for up to 48 hours after you have already published." },
    ],
    verifyNote: "Run the free check once the TXT record has had a few hours. DKIM validation may need up to 48 hours after Start authentication.",
    faq: [
      { q: "How do I set up DKIM in Google Workspace?", a: "In the Admin console open Gmail, Authenticate email, generate a new record (2048-bit if your host supports it), publish the google._domainkey TXT record at your DNS host, then click Start authentication." },
      { q: "What is the SPF record for Google Workspace?", a: "v=spf1 include:_spf.google.com ~all, from Google's own documentation." },
      { q: "Does Gmail send DMARC failure reports?", a: "Google says Gmail does not support the ruf tag. Use rua aggregate reports." },
    ],
    sources: [
      { label: "Google Workspace Admin help: Set up SPF", url: "https://knowledge.workspace.google.com/admin/security/set-up-spf" },
      { label: "Google Workspace Admin help: Set up DKIM", url: "https://knowledge.workspace.google.com/admin/security/set-up-dkim" },
      { label: "Google Workspace Admin help: Set up DMARC", url: "https://knowledge.workspace.google.com/admin/security/set-up-dmarc" },
    ],
    related: ["microsoft-365", "wix", "squarespace"],
  },

  // ---------------------------------------------------------------- WIX
  {
    slug: "wix",
    name: "Wix",
    group: "Website builder",
    title: "How to Set Up DMARC on Wix (SPF, DKIM, DMARC)",
    description: "How to set up DMARC on Wix: open Manage DNS Records, add TXT records with the right Host Name, and watch for the pointing-method catch that blocks DNS edits.",
    h1: "How to Set Up DMARC on Wix",
    primaryTerm: "how to set up dmarc wix",
    terms: ["how to set up dmarc wix", "wix dmarc record", "wix spf record"],
    summary: "On a domain whose DNS Wix manages, you add DMARC in Domains, Manage DNS Records, in the TXT (Text) section with Host Name _dmarc. If your domain is only pointed at Wix, Wix says to add TXT records at your domain host instead.",
    intro: [
      "Plenty of trades and shopfront businesses built their website on Wix and never touched the domain settings again. Wix is a website builder first and a DNS host second, so there are two situations: Wix manages your domain's DNS, or your DNS lives somewhere else and Wix is only a place your website points to. The DMARC steps are completely different between those two.",
      "This page covers the Wix-managed route in detail and tells you how to spot the other one.",
    ],
    checked: "Read on 28 November 2026: Wix's help article Adding or Updating TXT Records in Your Wix Account. That article does not mention TTL, propagation time, or SPF, DKIM or DMARC specifically; those parts come from the standard record rules and the platform pages on this site.",
    findDns: {
      heading: "Step 1: Find out who controls your DNS",
      steps: [
        "Sign in to your Wix account and open the Domains page.",
        "Click the Domain Actions icon next to the domain and select Manage DNS Records.",
        "If your domain is connected with the pointing method (the domain is registered elsewhere and only points to Wix), Wix says to add or update TXT records with your domain host, not Wix. In that case use the page for your registrar instead.",
        "If you bought your business email through Wix, it is normally Google Workspace, so follow the Google Workspace page for the DKIM key and the SPF include.",
      ],
    },
    hostFormat: {
      heading: "What goes in Host Name and Value at Wix",
      body: [
        "Wix's TXT section has a Host Name box and a Value box. Wix's article tells you to leave Host Name blank if you were told to add an @ sign. For DMARC the host name is _dmarc. For SPF it is blank. Enter only the prefix; do not add your domain.",
        "Wix keeps record types in separate sections of the page. TXT records go in the TXT (Text) section and a DKIM CNAME, such as the Microsoft 365 ones, goes in the CNAME section. A record in the wrong section is the most likely Wix-specific mistake.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "(blank, for @)", value: "v=spf1 include:_spf.google.com ~all (Google Workspace example)" },
        { record: "DKIM (Google)", type: "TXT", name: "google._domainkey", value: "v=DKIM1; k=rsa; p= followed by your key" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at Wix",
      body: [
        "In the TXT (Text) section choose + Add Record, leave Host Name blank for the root, paste the SPF value and Save. The value depends on the mail platform, not on Wix: use the include from the Microsoft 365 or Google Workspace page.",
        "Open the existing list first. If you already have a v=spf1 line, use Edit (hover over the record and click Edit) instead of adding a second one.",
      ],
      record: "v=spf1 include:_spf.google.com ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at Wix",
      body: [
        "Wix does not generate the DKIM key. If your mail comes through Google Workspace the key is created in the Google Admin console, and if it is Microsoft 365 the two CNAMEs come from the Defender portal. Wix is where you store the result.",
      ],
      steps: [
        "Create the DKIM details in the mail platform first.",
        "In Manage DNS Records, add the record in the section that matches its type: TXT (Text) for Google, CNAME for Microsoft 365.",
        "Host Name is only the prefix, for example google._domainkey, with no domain on the end.",
        "Save, wait, then start signing in the mail platform.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at Wix",
      body: [
        "In the TXT (Text) section choose + Add Record, enter _dmarc as the Host Name, paste the policy in Value and Save. To change it later, hover over the record, click Edit, change p= and Save.",
        "Start at p=none. Wix's article does not give a propagation time, so use the 48-hour ceiling that applies to DNS changes in general and check progressively.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "Pointing method means someone else's DNS", d: "If your domain is only pointed at Wix, the records go in your domain host, not Wix." },
      { t: "Record type sections", d: "TXT goes in the TXT (Text) section and CNAME records in the CNAME section." },
      { t: "Blank means root", d: "An empty Host Name is how Wix expects the @ record." },
      { t: "Wix does not host your mailboxes", d: "Check whether your email is Google Workspace or Microsoft 365 and take SPF and DKIM values from them." },
      { t: "No stated propagation time", d: "Wix's article gives none, so test rather than assume." },
    ],
    verifyNote: "If the check shows no records at all after a day, open the Domains page again and confirm Wix actually manages the DNS; this is the most likely cause on Wix.",
    faq: [
      { q: "Where do I add a DMARC record in Wix?", a: "Domains, the Domain Actions icon, Manage DNS Records, then + Add Record in the TXT (Text) section with Host Name _dmarc." },
      { q: "Why can I not edit DNS in Wix?", a: "If your domain is connected with the pointing method, Wix says to add or update TXT records with your domain host instead." },
      { q: "Does Wix give me an SPF record?", a: "SPF depends on who sends your email. Take the include value from your mail platform and add it in the TXT section." },
    ],
    sources: [
      { label: "Wix help: Adding or Updating TXT Records in Your Wix Account", url: "https://support.wix.com/en/article/adding-or-updating-txt-records-in-your-wix-account" },
      { label: "Google Workspace Admin help: Set up DKIM", url: "https://knowledge.workspace.google.com/admin/security/set-up-dkim" },
    ],
    related: ["squarespace", "google-workspace", "godaddy"],
  },

  // ---------------------------------------------------------------- SQUARESPACE
  {
    slug: "squarespace",
    name: "Squarespace",
    group: "Website builder",
    title: "How to Set Up DMARC on Squarespace (SPF, DKIM)",
    description: "How to set up DMARC on Squarespace Domains: Custom Records steps, why the Name is _dmarc, the one-DMARC-record rule, SPF merging and the 255 character limit.",
    h1: "How to Set Up DMARC on Squarespace",
    primaryTerm: "how to set up dmarc squarespace",
    terms: ["how to set up dmarc squarespace", "squarespace dmarc record", "squarespace spf dkim"],
    summary: "In Squarespace Domains you add DMARC under DNS Settings, Custom Records, as a TXT record named _dmarc. Squarespace allows only one DMARC record per domain and warns that quotation marks can stop an SPF record resolving.",
    intro: [
      "Squarespace Domains took over a large number of domains from Google Domains, so a business can own a Squarespace domain without ever having built a Squarespace website. If you are one of them, the DNS screen is the same, and your email probably sits with Google Workspace or Microsoft 365.",
      "Squarespace's help is the most detailed of the website builders on SPF, DKIM and DMARC, including some rules that exist nowhere else on this site, such as how it merges multiple SPF entries and where its character limits bite.",
    ],
    checked: "Read on 28 November 2026: Squarespace help articles Adding custom DNS records to your Squarespace managed domain, Adding TXT records, and Add DNS records for email.",
    findDns: {
      heading: "Step 1: Open Custom Records",
      steps: [
        "Open the Domains dashboard and click the domain.",
        "Click DNS, then DNS Settings, and scroll down to Custom Records.",
        "Click Add record. Squarespace asks you to confirm your identity: enter your current password, or use your two-factor method if it is on, then click Continue.",
        "If a third-party domain uses DNS Connect, Squarespace says not to use its guide: edit DNS at your domain provider instead.",
      ],
    },
    hostFormat: {
      heading: "What goes in Name and Text at Squarespace",
      body: [
        "Squarespace fills your domain into the Name field itself. If your provider asks for your domain as the host, enter @. If it asks for a prefix plus your domain, enter only the prefix. For DMARC, Squarespace's email article is explicit: enter _dmarc and do not add your domain name at the end.",
        "The value goes in the Text field. For a CNAME it goes in the Data field instead. Squarespace's limits are specific: SPF and DKIM records can be up to 2048 bits, but other TXT records are limited to 255 characters. A DMARC record with several long rua addresses can reach that, so keep it short.",
      ],
      rows: [
        { record: "SPF", type: "TXT", name: "@ (or the host your provider gives)", value: "v=spf1 include:_spf.google.com ~all (Google Workspace example)" },
        { record: "DKIM", type: "TXT or CNAME", name: "the host your provider gives, for example google._domainkey", value: "Text for TXT, Data for CNAME" },
        { record: "DMARC", type: "TXT", name: "_dmarc", value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au (255 characters at most)" },
      ],
    },
    spf: {
      heading: "Step 2: SPF at Squarespace",
      body: [
        "Add each SPF record as its own custom record with Name @ and the include from your email platform. Squarespace says SPF records are merged into one, so refresh the page to see the merged result. If you also use a Squarespace email preset, the preset plus your custom record may not show as merged after refresh, but Squarespace says they still work as one.",
        "Two Squarespace-specific problems. Quotation marks in the Text field can stop an SPF record resolving, depending on the nameservers, so remove them if it does not resolve. And if you meet a Custom records not saved error while adding SPF, Squarespace says to delete your current SPF records in DNS settings and add the new ones again.",
      ],
      record: "v=spf1 include:_spf.google.com ~all",
    },
    dkim: {
      heading: "Step 3: DKIM at Squarespace",
      body: [
        "Squarespace stores the key your email platform creates. Use the same path, pick TXT or CNAME to match the platform's instructions and enter the host the platform gives you.",
      ],
      steps: [
        "Generate DKIM in Google Workspace or Microsoft 365 first.",
        "Custom Records, Add record, choose TXT or CNAME.",
        "Name is the host prefix from the platform; if the platform gave none, Squarespace says use @.",
        "Put the value in Text (TXT) or Data (CNAME), and Save.",
        "Allow up to 48 hours, then start signing at the platform.",
      ],
    },
    dmarc: {
      heading: "Step 4: DMARC at Squarespace",
      body: [
        "Follow the same path, choose TXT, enter _dmarc in Name and paste the policy in Text. Squarespace says a domain can have only one DMARC record. If several email services each tell you to add one, combine them: separate the report addresses with commas, and where the policy tags conflict, use the more secure value.",
        "Squarespace says changes can take up to 48 hours. If a record is still not working after 48 hours, follow its troubleshooting guide for DNS records.",
      ],
      record: "v=DMARC1; p=none; rua=mailto:dmarc-reports@yourbusiness.com.au",
    },
    gotchas: [
      { t: "One DMARC record only", d: "Two email services each asking for a _dmarc record must be merged into one line." },
      { t: "255 characters outside SPF and DKIM", d: "A DMARC line stuffed with report addresses can exceed the limit." },
      { t: "Quotes can break SPF", d: "Remove quotation marks if an SPF record will not resolve." },
      { t: "Blank or @ overrides other blank records", d: "Squarespace's records articles warn that careless root entries can disrupt your domain or email, so edit the existing record rather than overwriting." },
      { t: "Do not delete MX records carelessly", d: "If you log in to Squarespace with an address at this domain, change your account email before removing MX records or you can lock yourself out." },
    ],
    verifyNote: "Squarespace allows up to 48 hours, so run the check the next day. The merged SPF record can look odd in the Squarespace screen but still resolve correctly, so judge by the check result.",
    faq: [
      { q: "Where do I add a DMARC record in Squarespace?", a: "Domains dashboard, your domain, DNS, DNS Settings, Custom Records, Add record, type TXT, Name _dmarc, value in Text." },
      { q: "Can a Squarespace domain have two DMARC records?", a: "No. Squarespace says only one is allowed, so combine the settings into a single record." },
      { q: "Why will my Squarespace SPF record not save or resolve?", a: "Quotation marks can stop it resolving, and a Custom records not saved error means deleting the current SPF records and adding the new ones." },
    ],
    sources: [
      { label: "Squarespace help: Adding custom DNS records to your Squarespace managed domain", url: "https://support.squarespace.com/hc/en-us/articles/360002101888-Adding-custom-DNS-records-to-your-Squarespace-managed-domain" },
      { label: "Squarespace help: Adding TXT records", url: "https://support.squarespace.com/hc/en-us/articles/31120980444429" },
      { label: "Squarespace help: Add DNS records for email", url: "https://support.squarespace.com/hc/en-us/articles/31120985010957-Add-DNS-records-for-email" },
    ],
    related: ["wix", "google-workspace", "microsoft-365"],
  },
];

export function getProvider(slug: string): Provider | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}

export const HUB = {
  title: "SPF, DKIM and DMARC Setup Guides for Australian Domains",
  description: "Step-by-step SPF, DKIM and DMARC setup for GoDaddy, Crazy Domains, VentraIP, Netregistry, Cloudflare, Microsoft 365, Google Workspace, Wix and Squarespace.",
  h1: "SPF, DKIM and DMARC setup guides for Australian domains",
  primaryTerm: "dmarc setup guide australia",
  faq: [
    { q: "What order should I set up SPF, DKIM and DMARC?", a: "SPF first, then DKIM, then DMARC at p=none. GoDaddy and Google both say DMARC comes after SPF and DKIM, and Microsoft says to set up SPF and DKIM before DMARC for custom domains." },
    { q: "How long does DMARC take to roll out safely?", a: "Our recommended rhythm is about ten weeks from p=none to p=reject for a small business with a handful of sending systems. Microsoft and Google both say go slowly and read the reports, and neither publishes a fixed calendar." },
    { q: "Do I need DMARC if my email is already with Microsoft 365 or Google?", a: "Yes. Microsoft's documentation says it does not publish SPF or DMARC for your custom domain, and Google's setup pages put the records at your DNS host." },
    { q: "Is DMARC compulsory in Australia?", a: "We are not aware of any Australian law that requires a small business to publish DMARC. It is a technical standard, and a sensible step towards the duty to take reasonable steps to protect personal information. Check any customer contract or insurer questionnaire for its own requirements." },
  ] as Faq[],
};
