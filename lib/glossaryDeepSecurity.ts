/**
 * Long-form content for the Essential Eight and ACSC glossary term pages (/glossary/<id>).
 * Free of path-alias imports so scripts can load it directly. Facts trace to the ACSC pages
 * linked as each term's source in lib/glossary.ts. No client figures or statistics.
 */
import type { GlossaryDeep } from "./glossaryDeepTypes";

const E8_LINKS = [
  { label: "Free Essential Eight score", href: "/tools/essential-eight-score" },
  { label: "Essential Eight guide for small business", href: "/guides/essential-eight-small-business" },
  { label: "The Essential Eight, translated for a one-van trade business", href: "/blog/essential-eight-small-trade-business" },
];

export const DEEP_SECURITY: Record<string, GlossaryDeep> = {
  "essential-eight": {
    name: "the Essential Eight",
    body: [
      "The Essential Eight is the Australian Cyber Security Centre's short list of the mitigation strategies that do the most to stop common attacks. It was drawn from a longer list of mitigation strategies the Australian Signals Directorate had published earlier, choosing the eight that together make the biggest difference. They split into three jobs. Preventing malware from running covers application control, patching applications, Microsoft Office macro settings and user application hardening. Limiting the damage covers restricting administrative privileges, patching operating systems and multi-factor authentication. Recovering data and keeping systems available is regular backups.",
      "The strategies are assessed against four maturity levels, zero to three, and each level is defined by the sort of attacker it is meant to resist. A business is rated per strategy, so the result is a profile, not a single grade. For most private businesses the Essential Eight is guidance, not law, although it is mandatory for non-corporate Commonwealth entities. It matters in practice because insurers, larger customers and tender documents increasingly ask for it, and because it gives a clear answer to what reasonable security looks like under the Privacy Act.",
      "It is also deliberately not everything. It does not cover staff training, physical security or a full incident plan, and it does not say which cloud product to buy. It is a baseline you build on.",
    ],
    example: {
      title: "A realistic first pass",
      text: "A five-person business starts by turning on multi-factor authentication for all email accounts, switching on automatic updates for computers and browsers, checking that its cloud backup can actually be restored, and removing administrator rights from everyday staff accounts. Those four steps touch four of the eight strategies and need no new software purchase. Application control and Office macro settings come next, because they take more planning.",
    },
    steps: [
      "Score where you stand today against all eight strategies, honestly.",
      "Fix the cheap and fast ones first: multi-factor authentication, updates, backups.",
      "Aim for maturity level one across the board before pushing any one strategy higher.",
      "Write down what you did and the date, so you can show an insurer or customer.",
    ],
    mistakes: [
      "Buying a product and calling it Essential Eight compliance.",
      "Treating the model as a once-off project rather than something to maintain.",
      "Claiming a maturity level without meeting every requirement of it.",
    ],
    see: ["maturity-level", "mfa", "patching", "backups", "acsc"],
    links: E8_LINKS,
  },
  "maturity-level": {
    name: "Essential Eight maturity level",
    body: [
      "A maturity level is the measure of how completely a strategy has been put in place. Level zero means there are significant weaknesses. Levels one, two and three each describe a set of requirements for each strategy, and each level is designed against a more capable attacker than the one before. The ACSC describes level one as aimed at opportunistic adversaries using commodity techniques, level two at adversaries prepared to invest more time and effort, and level three at adversaries who are more adaptive and less reliant on public tools.",
      "The important rule is that a level is met only when every requirement for that level is met. Doing most of them is a lower level. The assessment is made strategy by strategy, so an organisation can legitimately be at level two for backups and level one for application control. Requirements also change with each update to the model, so a rating earned against an older version should be checked against the current one.",
      "For a small business the useful question is not which level the auditor wants but which level the likely attacker needs. Most real-world attacks against small firms are opportunistic: stolen passwords, unpatched software and phishing. Level one is designed for exactly those, and getting there across all eight is a sensible first target.",
    ],
    example: {
      title: "Reading a profile",
      text: "A business might record: application control level 0, patching applications level 1, Office macro settings level 1, user application hardening level 1, administrative privileges level 1, patching operating systems level 1, multi-factor authentication level 2, backups level 1. The honest summary is that the weakest strategy sets the picture, so application control is the next job even though several others are higher.",
    },
    steps: [
      "Download the current maturity model from the ACSC and read the level one requirements.",
      "Mark each requirement met or not met for each strategy, with a note of the evidence.",
      "Pick the lowest strategy and lift it first.",
      "Reassess every six months and whenever the ACSC updates the model.",
    ],
    mistakes: [
      "Rounding up. Nine of ten requirements met is not that level.",
      "Using an old copy of the model.",
      "Aiming at level three for a strategy when another is still at zero.",
    ],
    see: ["essential-eight", "mfa", "application-control", "patching", "acsc"],
    links: E8_LINKS,
  },
  mfa: {
    name: "multi-factor authentication",
    body: [
      "A password is something that can be guessed, reused, leaked or tricked out of a person. Multi-factor authentication adds a second kind of proof so that a stolen password is not enough. The factors are something you know, such as a password or PIN, something you have, such as a phone with an authenticator app or a hardware security key, and something you are, such as a fingerprint or face.",
      "Methods differ a lot in strength. A code sent by text message is better than nothing, but a criminal can intercept it by taking over the phone number or tricking the person into reading it out. An authenticator app generating time-based codes is stronger. Number-matching push prompts help against people approving prompts they did not start. The strongest are phishing-resistant methods, passkeys and FIDO2 security keys, because the cryptographic check is bound to the real website and fails on a fake one. The higher Essential Eight maturity levels call for phishing-resistant methods on important accounts.",
      "Where to start matters more than which method. Email comes first, because whoever controls a mailbox can reset the password on nearly everything else and can run invoice fraud from inside real threads. After that come accounting software, banking, the domain registrar and the website host, and any remote access to the office network.",
    ],
    example: {
      title: "An afternoon's work for a small team",
      text: "An owner turns on an authenticator app requirement for every mailbox in the business email admin console, asks each person to enrol their phone, then does the same for the accounting package and the domain registrar. Anyone who loses a phone uses a recovery process the owner has written down in advance, not a text sent to a number the attacker might control.",
    },
    steps: [
      "Enable MFA on every mailbox, admin first, then everyone.",
      "Add accounting, banking, domain registrar and website hosting.",
      "Prefer authenticator apps over text messages, and passkeys where offered.",
      "Store recovery codes somewhere safe and offline, and write down the lost-phone process.",
    ],
    mistakes: [
      "Turning it on for staff but not for the owner's own account.",
      "Leaving old accounts without it because the person left.",
      "Approving a push prompt you did not start.",
    ],
    see: ["essential-eight", "phishing", "bec", "admin-privileges", "maturity-level"],
    links: E8_LINKS,
  },
  "application-control": {
    name: "application control",
    body: [
      "Antivirus tries to recognise bad software, and criminals change their software faster than lists can follow. Application control reverses the problem. It maintains a list of programs, scripts, installers and libraries that are approved, and the computer refuses to run anything else. A booby-trapped attachment that drops an unknown program onto a machine simply fails to start.",
      "It is widely considered the hardest of the eight, because the list has to be built and kept up to date. Software that updates itself changes the files that need approving, and staff need a quick, fair way to ask for something new. Windows includes built-in tools for the job, with AppLocker and App Control for Business among them, and managed device platforms can push rules to every computer.",
      "A small business does not need to start everywhere. The machines that open email and browse the web carry the most risk, so they are the sensible first ones. Rules often begin by allowing anything installed in standard locations such as Program Files and the Windows folder, which blocks software run from a downloads folder or an email attachment, and then tightening based on what the logs show.",
    ],
    example: {
      title: "A first rule that blocks a lot",
      text: "A business runs the built-in tool in audit mode for a few weeks, which logs what would have been blocked without stopping anything. It finds three legitimate programs running from a user folder, approves them by publisher, and then switches to enforcement. From then on an executable downloaded to a staff member's desktop will not run.",
    },
    steps: [
      "Start with the computers used for email and browsing.",
      "Run in audit mode first and read the log for a few weeks.",
      "Approve by publisher where possible, because it survives updates.",
      "Make a simple process for staff to request new software and keep a record of approvals.",
    ],
    mistakes: [
      "Enforcing on day one and stopping the business from working.",
      "Allowing whole user folders, which defeats the control.",
      "Forgetting scripts and installers as well as programs.",
    ],
    see: ["essential-eight", "patching", "admin-privileges", "maturity-level"],
    links: E8_LINKS,
  },
  patching: {
    name: "patching",
    body: [
      "Software has flaws, and vendors publish fixes. Attackers read the same announcements and build tools to exploit the flaws, often within days, aimed at everyone who has not yet updated. That is why the Essential Eight lists patching twice: once for applications such as browsers, PDF readers, office suites and email clients, and once for operating systems, firmware and network devices.",
      "The ACSC sets time limits for installing patches, and those limits get shorter when a flaw is known to be exploited in the wild. The exact number of days depends on the maturity level and changes between versions of the model, so check the current text instead of relying on a figure remembered from somewhere else. A related requirement is to stop using software the vendor no longer supports, because it will never receive a fix.",
      "For a small business the practical routine is dull and effective. Turn on automatic updates for the operating system, browsers and the main applications, restart machines when asked, update the router and any network devices, and keep a short list of what is installed so nothing is forgotten. Remote workers' laptops and the old computer in the back office are where updates most often stall.",
    ],
    example: {
      title: "A monthly ten-minute check",
      text: "On the first Monday of each month the owner opens the update settings on each computer and the router admin page, confirms no update is pending, and notes the date in a simple log. A forgotten laptop that has not updated for three months is found and fixed. A tablet running an unsupported operating system is retired from business use.",
    },
    steps: [
      "Switch on automatic updates for operating systems and browsers.",
      "List the other software and who is responsible for updating each item.",
      "Replace anything the vendor no longer supports.",
      "Check routers, firewalls and printers, which are patched less often than computers.",
    ],
    mistakes: [
      "Postponing restarts indefinitely.",
      "Forgetting network equipment and mobile devices.",
      "Keeping an old machine online because it runs one piece of legacy software.",
    ],
    see: ["essential-eight", "application-control", "attack-surface", "app-11"],
    links: E8_LINKS,
  },
  "admin-privileges": {
    name: "administrative privileges",
    body: [
      "An administrator account can install programs, change security settings, create other accounts and read most of the data on a system. If a criminal gets into an ordinary user account, the damage is limited to what that person can reach. If they get into an administrator account, there is almost no limit. Restricting administrative privileges shrinks the number of people who hold that power and the time they hold it.",
      "The core ideas are simple. Give admin rights only to people whose jobs need them, and approve and record each grant. Use a separate account for administration, so the person who reads email and browses the web is never doing so with full power. Block admin accounts from reading email and browsing the internet. Review the list regularly and remove accounts that are no longer used, such as one belonging to a former staff member or contractor.",
      "In a small business the most common failure is that the owner uses one account with full rights for everything. The fix does not need a big budget: create a second, strongly protected admin account used only when changing settings, and let the everyday account be an ordinary one. Accounts at suppliers, such as the website host and the domain registrar, deserve the same care.",
    ],
    example: {
      title: "Splitting one account into two",
      text: "An owner who has used a single full-rights login for years creates a new standard account for daily work and demotes the original to a standard user. A separate admin account with a long unique password and multi-factor authentication is used only to install software or change settings. When a staff member's laptop is infected through a download, the malware runs without the power to switch off security tools.",
    },
    steps: [
      "List everyone who has admin rights on computers, cloud services and your website.",
      "Remove the rights from anyone who does not need them for their job.",
      "Create separate admin accounts and protect them with multi-factor authentication.",
      "Review the list every quarter and when anyone joins or leaves.",
    ],
    mistakes: [
      "Giving admin rights to avoid a few support requests.",
      "Using the admin account for email.",
      "Leaving a former contractor's account active.",
    ],
    see: ["essential-eight", "mfa", "application-control", "app-11"],
    links: E8_LINKS,
  },
  backups: {
    name: "regular backups",
    body: [
      "A backup is a promise that you can get back to a known good state after something goes wrong, whether that is a ransomware attack, a failed disk, an accidental deletion or a fire. The Essential Eight treats it as the safety net under the other seven strategies, because no combination of controls guarantees an attack never succeeds.",
      "A backup earns the name only if it has three properties. It is current enough that losing the gap between the last copy and now is acceptable. It is protected, meaning an ordinary staff account, and so any malware running as that staff member, cannot alter or delete it. And it has been restored, because the first time you try a restore should never be during a crisis. Many small business backups fail the third test without anyone knowing.",
      "A common pattern is the 3-2-1 idea: three copies of the data, on two different kinds of storage, with one kept somewhere else and offline or immutable. Cloud storage with version history helps against accidental changes, and an offline or write-once copy helps against ransomware. Agree in advance how long the business can go without each system, since that decides how often to copy and how fast you must restore.",
    ],
    example: {
      title: "A restore test that costs an hour",
      text: "Once a quarter the owner picks a random folder of customer jobs, restores it from the backup to a different location, opens three files to confirm they are readable, and writes the date and result in a log. In the first test the restore fails because the backup's credentials had expired. The business learns that on a quiet Tuesday, not during an outage.",
    },
    steps: [
      "List the data and systems the business cannot run without.",
      "Back up on a schedule that matches how much loss you can accept.",
      "Keep one copy that a normal user account cannot change or delete.",
      "Restore a sample every quarter and write the restore steps down.",
    ],
    mistakes: [
      "Syncing a folder to the cloud and calling it a backup. Sync copies deletions too.",
      "Never testing a restore.",
      "Keeping the backup drive plugged in permanently next to the computer.",
    ],
    see: ["essential-eight", "ndb", "admin-privileges", "maturity-level"],
    links: E8_LINKS,
  },
  acsc: {
    name: "the ACSC",
    body: [
      "The Australian Cyber Security Centre is part of the Australian Signals Directorate and acts as the government's lead on cyber security for the public. It publishes guidance written for different audiences, from individuals and small businesses to large organisations and critical infrastructure, and it issues alerts when a serious threat is being actively used against Australian targets.",
      "Several of its products matter to a small business directly. The Essential Eight and its maturity model are the baseline most people mean when they talk about cyber security practice in Australia. The Information Security Manual is the detailed set of controls used by government and by organisations that need to go deeper. Its small business guidance explains the basics in plain language, and ReportCyber is the national way to report cybercrime, including business email compromise.",
      "The ACSC is not a regulator for private businesses and does not fine anyone. That role in privacy sits with the OAIC. The two connect in practice: when a privacy regulator asks whether reasonable steps were taken to protect personal information, ACSC guidance is the usual measure of what reasonable looks like. The ACSC also operates a cyber security hotline for people who need help after an incident.",
    ],
    example: {
      title: "Where each organisation fits",
      text: "A business that suffers a payment diversion fraud reports it through ReportCyber, which is run by the ACSC. If personal information was exposed and the harm is likely to be serious, it also notifies the OAIC under the Notifiable Data Breaches scheme. One event can involve both, for different reasons, and the business keeps a short record of what it did and when.",
    },
    steps: [
      "Bookmark cyber.gov.au and read the small business pages once.",
      "Subscribe to the ACSC alerts relevant to the software you use.",
      "Save the ReportCyber link where staff can find it quickly.",
      "Use the Essential Eight as your baseline and record your progress.",
    ],
    mistakes: [
      "Assuming reporting to the ACSC replaces notifying the OAIC.",
      "Relying on advice from a source that does not cite the primary guidance.",
      "Waiting for an incident before finding the reporting page.",
    ],
    see: ["essential-eight", "maturity-level", "bec", "oaic", "ndb"],
    links: E8_LINKS,
  },
};
