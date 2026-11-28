/**
 * Long-form content for the privacy and AI glossary term pages (/glossary/<id>).
 * Free of path-alias imports so scripts can load it directly. Legal points trace to the OAIC and
 * legislation pages linked as each term's source in lib/glossary.ts. General information, not legal advice.
 */
import type { GlossaryDeep } from "./glossaryDeepTypes";

const PRIV_LINKS = [
  { label: "Free Privacy Act checker", href: "/tools/privacy-act-checker" },
  { label: "Privacy Act guide for Australian small business", href: "/guides/privacy-act-small-business-australia" },
  { label: "Privacy Act obligations in plain English", href: "/privacy-act" },
];

export const DEEP_PRIVACY: Record<string, GlossaryDeep> = {
  "privacy-act": {
    name: "the Privacy Act 1988",
    body: [
      "The Privacy Act 1988 is the Commonwealth law that sets the rules for personal information held by Australian Government agencies and by many private organisations. Its centrepiece is Schedule 1, the 13 Australian Privacy Principles. The Act also holds the Notifiable Data Breaches scheme, the credit reporting rules, the tax file number rules and the powers of the Information Commissioner to investigate complaints and apply to a court for penalties.",
      "Who is covered is the question small businesses ask first. Agencies and organisations with an annual turnover above AU$3 million are covered. Smaller businesses are outside the Act unless they fall into a listed category, for example private health service providers, businesses that sell or buy personal information, and contractors to the Commonwealth. Business owners often assume the exemption protects them and do not check the list.",
      "The Act changed in December 2024, with the changes starting in stages. One that matters to anyone using software to make decisions is the requirement, from 10 December 2026, to describe certain automated decisions in the privacy policy. State laws, such as those on surveillance and health records, sit alongside the Privacy Act. This page is general information, and a business with a specific question should ask a privacy lawyer.",
    ],
    example: {
      title: "Two businesses, different answers",
      text: "A plumber with a turnover of AU$900,000 who keeps customer names and phone numbers is probably outside the Act but may still want a privacy policy, because larger customers and some platforms ask for one. A physiotherapy clinic with the same turnover is covered whatever its size, because it provides a health service and holds health information.",
    },
    steps: [
      "Work out whether you are covered, using the OAIC small business test.",
      "If covered, write down how you meet each of the 13 principles.",
      "Publish a privacy policy that matches what you actually do.",
      "Prepare a data breach response plan before you need one.",
    ],
    mistakes: [
      "Assuming the small business exemption applies without checking the exceptions.",
      "Copying another firm's privacy policy.",
      "Treating the law as a document exercise and not a set of habits.",
    ],
    see: ["app", "small-business-exemption", "ndb", "oaic", "adm"],
    links: PRIV_LINKS,
  },
  app: {
    name: "the Australian Privacy Principles",
    body: [
      "The 13 principles follow the life of personal information from first contact to deletion. APP 1 asks for open and transparent management and a privacy policy. APP 2 lets people deal with you anonymously or under a pseudonym where practical. APPs 3 to 5 deal with collecting information, including unsolicited information, and telling people what you collect and why. APP 6 limits use and disclosure to the purpose you collected it for, with exceptions. APP 7 covers direct marketing, APP 8 sending information overseas, and APP 9 government identifiers such as tax file numbers.",
      "APP 10 asks that the information be accurate, up to date and complete. APP 11 requires reasonable steps to keep it secure and to destroy or de-identify it when it is no longer needed. APPs 12 and 13 give people the right to ask for access to their information and to have it corrected. Because the principles describe outcomes, not specific tools, the OAIC publishes guidelines that explain how it reads each one.",
      "The practical approach is to map where your business collects personal information, why, where it is stored and who sees it. That map answers most of the principles: the collection notice, the use limits, the overseas question and the retention question all fall out of it. An AI tool is not outside the principles. Whatever you put into one is a use or disclosure of personal information.",
    ],
    example: {
      title: "A short data map",
      text: "A clinic writes one line for each place it holds information: the booking system (names, phone, appointment reason, hosted overseas), the email inbox (referral letters), the accounting package (names and addresses) and paper files in a locked cabinet. Next to each line it notes who has access and how long it keeps the data. The map shows an old appointment export on a staff laptop that should be deleted under APP 11.",
    },
    steps: [
      "Draw up the data map: what, why, where, who, how long.",
      "Check your collection notices and privacy policy against it.",
      "Review where each vendor stores data, for APP 8.",
      "Set a retention period and delete what is past it.",
    ],
    mistakes: [
      "Collecting information just in case it is useful later.",
      "Using customer details for a new purpose without checking APP 6.",
      "Forgetting paper records and old devices.",
    ],
    see: ["privacy-act", "app-1", "app-8", "app-11", "personal-information"],
    links: PRIV_LINKS,
  },
  "small-business-exemption": {
    name: "the small business exemption",
    body: [
      "Under the Privacy Act, a small business operator is one with an annual turnover of AU$3 million or less, and a small business operator is generally not an organisation the Act applies to. That is the exemption. It is why a sole trader with a few customers does not normally have to follow the Australian Privacy Principles or notify a data breach under the NDB scheme.",
      "It comes with a long list of exceptions, and the exceptions catch many small firms. A business is covered whatever its size if it provides a health service and holds health information, if it trades in personal information by buying or selling it, if it is a contracted service provider for a Commonwealth contract, if it operates a residential tenancy database, if it is a credit reporting body, or if it is related to a business that is itself covered. A business can also opt in to the Act voluntarily.",
      "The exemption is under review and the Government has agreed in principle to look at removing or narrowing it, so a position taken today may not last. Even when exempt, a small supplier may be held to privacy standards by contract, by an insurer or by a customer's procurement process. A tidy privacy policy and basic security habits cost little and remove an objection from a sales conversation.",
    ],
    example: {
      title: "Checking the test",
      text: "An electrician with turnover of AU$600,000 uses a field service app to hold customer addresses and notes. The turnover is under AU$3 million and none of the exceptions applies, so the Act does not bind the business. The same electrician then signs a contract to work for a Commonwealth agency and handle information for it. That contract can bring the business inside the Act for that work.",
    },
    steps: [
      "Check turnover against the AU$3 million test using the OAIC guidance.",
      "Read the list of exceptions and tick any that apply to you.",
      "Check your contracts for privacy clauses that bind you anyway.",
      "Decide whether to follow the principles voluntarily and say so in a short privacy policy.",
    ],
    mistakes: [
      "Relying on the exemption without reading the exceptions.",
      "Forgetting that turnover is tested across related businesses.",
      "Assuming the position is permanent.",
    ],
    see: ["privacy-act", "app", "ndb", "oaic"],
    links: [
      ...PRIV_LINKS,
      { label: "Do sole traders need a privacy policy?", href: "/blog/sole-trader-privacy-policy-threshold" },
    ],
  },
  "app-1": {
    name: "APP 1",
    body: [
      "APP 1 has two duties. The first is to take reasonable steps to implement practices, procedures and systems that ensure the organisation complies with the other principles and can deal with inquiries and complaints. The second is to have a clearly expressed and up-to-date privacy policy. The first is the harder one, since it is about how the business actually runs, not about a document.",
      "The Act lists what the policy must contain. It must say what kinds of personal information the organisation collects and holds, how it collects and holds it, and the purposes for which it does so. It must explain how a person can access and correct their information, how they can complain and how the complaint will be handled, whether the organisation is likely to disclose information to overseas recipients, and if so which countries where practicable. It should be available free of charge and in a form people can easily use, which in practice means a link from the website footer.",
      "From 10 December 2026, the policy of an organisation that uses computer programs to make or substantially help make decisions that could significantly affect a person must also describe the kinds of personal information used and the kinds of decisions involved. A policy written in 2020 that says nothing about AI tools, call recordings or overseas hosting will usually fall short of this.",
    ],
    example: {
      title: "A clause that matches reality",
      text: "A business that uses an AI receptionist adds a short section to its policy. It states that calls may be answered by an automated system, that the caller is told so at the start, that a transcript is kept for a stated period to book the job, that the provider stores data in a named overseas region and that a person can ask for the transcript to be deleted. The figures in a clause like this come from your own settings, not from a template.",
    },
    steps: [
      "Read your current policy against the list of required content.",
      "Check each statement against what the business really does.",
      "Add sections for AI tools, call recording and overseas storage where they apply.",
      "Put a visible link on every page and review the policy twice a year.",
    ],
    mistakes: [
      "Publishing a template that describes a different business.",
      "Never updating the policy after adding new software.",
      "Burying it where customers cannot find it.",
    ],
    see: ["app", "adm", "app-8", "privacy-act", "ai-receptionist"],
    links: PRIV_LINKS,
  },
  adm: {
    name: "automated decision-making",
    body: [
      "Automated decision-making is the use of software to make a decision, or to do a substantial part of making one, with little or no human judgement in the loop. The 2024 amendments to the Privacy Act do not forbid it. They add a transparency duty: from 10 December 2026, an organisation covered by the Act must set out in its privacy policy the kinds of personal information used in such decisions and the kinds of decisions made, where the decision could reasonably be expected to significantly affect the rights or interests of an individual.",
      "Whether a decision is significant is a matter of judgement. Examples that plausibly qualify are declining a credit or finance application, deciding whether to offer a person a job interview, setting a price or a limit for an individual, or refusing a service. A scheduling tool that offers a customer a time slot is not likely to qualify. Where a person reviews each outcome and genuinely can change it, the decision is less likely to be one made substantially by the program, although the line is not always clear.",
      "The sensible approach for a small business using AI is an inventory. List each tool that makes or influences a decision about an individual, note what personal information it uses, note whether a person reviews the result, and decide whether the decision is significant. That list becomes the paragraph in the privacy policy, and it also shows where a human check would reduce risk.",
    ],
    example: {
      title: "An inventory entry",
      text: "A business uses a tool that scores incoming enquiries and automatically declines those below a threshold. It records: tool name, information used (name, suburb, job description), decision (accept or decline an enquiry), human review (none for declines), significance (low, since the person can simply call another trader). It decides to add a human review for declines anyway, and describes the arrangement in its privacy policy.",
    },
    steps: [
      "List every tool that decides or recommends something about a person.",
      "Record what personal information each tool uses.",
      "Decide which decisions could significantly affect someone and who reviews them.",
      "Add a plain description to your privacy policy before 10 December 2026 if the Act covers you.",
    ],
    mistakes: [
      "Assuming it only applies to large banks.",
      "Describing a decision as human-made when nobody reviews it.",
      "Forgetting tools that are built into other software.",
    ],
    see: ["app-1", "privacy-act", "ai-receptionist", "personal-information", "byok"],
    links: [...PRIV_LINKS, { label: "Privacy Act changes and the 10 December 2026 date", href: "/blog/privacy-act-small-business-deadline" }],
  },
  "app-8": {
    name: "APP 8",
    body: [
      "APP 8 applies when an organisation discloses personal information to a person outside Australia, other than itself or the individual. Before disclosing, it must take reasonable steps to make sure the recipient does not breach the Australian Privacy Principles in relation to that information. In many cases the Act then treats an overseas recipient's breach as the Australian organisation's own, through the accountability rule in section 16C, so the obligation does not end at the border.",
      "Overseas disclosure is common without anyone deciding it. A customer database in a software service may be stored in another country. An email platform may process messages in a regional data centre. An AI service may send a call transcript to servers overseas. Often the business does not know, because the answer is in the vendor's terms or settings and not in the sales page.",
      "The usual reasonable steps are contractual and practical. Ask the vendor where data is stored and processed, choose an Australian region when it is offered, check that the contract requires protection similar to the APPs and prohibits wider use, and record the answers. Informed consent is an exception, but it only works where the individual is told clearly that APP 8 protection will not apply and still agrees, which is hard to achieve in practice.",
    ],
    example: {
      title: "A vendor check in four lines",
      text: "Before connecting a new booking tool, a clinic asks the vendor four questions: which countries store the data, which countries can access it, whether an Australian region is offered, and what the contract says about use of the data for training or analytics. It records the replies and the date. The vendor offers an Australian region, so the clinic selects it and updates the privacy policy.",
    },
    steps: [
      "List the software services that hold or process personal information.",
      "Ask each vendor where data is stored and accessed.",
      "Choose an Australian region where offered and record the setting.",
      "State likely overseas disclosures and countries in your privacy policy.",
    ],
    mistakes: [
      "Assuming a vendor with an Australian website stores data here.",
      "Relying on the vendor's marketing instead of the contract.",
      "Forgetting AI and transcription services.",
    ],
    see: ["app", "app-1", "app-11", "byok", "ai-receptionist"],
    links: PRIV_LINKS,
  },
  "app-11": {
    name: "APP 11",
    body: [
      "APP 11 has two parts. The first requires an organisation to take reasonable steps to protect the personal information it holds from misuse, interference and loss, and from unauthorised access, modification or disclosure. The second requires it to take reasonable steps to destroy the information or ensure it is de-identified once it is no longer needed for any purpose permitted by the Act, unless the law requires it to be kept.",
      "Reasonable is not defined as a fixed list. The OAIC looks at the nature of the organisation, the amount and sensitivity of the information, the harm if it is compromised, the practical cost of safeguards and whether staff and systems were set up to protect it. A clinic holding health records is expected to do more than a shop with a mailing list. The OAIC's guidance names categories of steps, including governance, staff training, access limits, technical controls such as encryption and secure configuration, physical security, and a plan for breaches.",
      "The Essential Eight is a practical way to show the technical side. Multi-factor authentication, patching, backups and limits on administrator accounts line up with what a regulator is likely to ask about after a breach. The second part of APP 11, deleting data when it is no longer needed, is often neglected. Information you no longer hold cannot be breached, so a retention schedule is one of the cheapest controls available.",
    ],
    example: {
      title: "A retention rule",
      text: "A business decides to delete customer enquiry emails that did not become jobs after 12 months, and job records after the period it needs for tax and warranty purposes. It sets a calendar reminder each January to run the deletion, and notes the rule in its privacy policy. The rule is its own, chosen for its records, and is not a legal requirement.",
    },
    steps: [
      "Limit who can see customer information to those who need it.",
      "Turn on multi-factor authentication and keep systems patched.",
      "Set retention periods and delete data past them.",
      "Write a short breach response plan and tell staff where it is.",
    ],
    mistakes: [
      "Keeping everything forever.",
      "Sharing logins between staff.",
      "Assuming the software vendor handles all of it.",
    ],
    see: ["app", "essential-eight", "ndb", "mfa", "backups"],
    links: PRIV_LINKS,
  },
  ndb: {
    name: "the NDB scheme",
    body: [
      "The Notifiable Data Breaches scheme, in Part IIIC of the Privacy Act, requires covered organisations to tell the OAIC and the affected individuals when an eligible data breach happens. A breach is eligible when there is unauthorised access to or disclosure of personal information, or a loss in circumstances where that is likely, and the result is likely to cause serious harm to a person. Credit reporting bodies, tax file number recipients and some others are covered regardless of size.",
      "Two time rules matter. If an organisation suspects a breach but is not sure it is eligible, it must carry out a reasonable and expeditious assessment and take all reasonable steps to complete it within 30 days. If it believes it has had an eligible breach, it must prepare a statement for the OAIC and notify affected individuals as soon as practicable. The statement describes the organisation, the breach, the kinds of information involved and recommended steps for the people affected.",
      "An exception applies where remedial action means serious harm is no longer likely, which is why quick containment matters. For example, if a lost laptop is remotely wiped before anyone accesses it, the breach may not be eligible. Keep a record of the assessment and what you did either way, because the OAIC may ask for it, and a plan prepared in advance saves hours on the day.",
    ],
    example: {
      title: "A suspected breach, step by step",
      text: "A staff member clicks a phishing link and a mailbox holding customer names, addresses and quote details may have been accessed. On the day, the business resets the password, removes the attacker's forwarding rule and checks the sign-in log. It starts an assessment note with the date, decides within the 30 days whether serious harm is likely, and if it is, notifies the OAIC through the online form and writes to the affected customers.",
    },
    steps: [
      "Contain the breach first: change passwords, remove access, recover what you can.",
      "Start a dated assessment record the same day.",
      "Decide whether serious harm is likely, within 30 days at the latest.",
      "If so, notify the OAIC and affected individuals as soon as practicable.",
    ],
    mistakes: [
      "Waiting for certainty before starting the assessment.",
      "Not recording the decision when you conclude no notification is needed.",
      "Telling customers informally but never notifying the OAIC.",
    ],
    see: ["eligible-data-breach", "oaic", "app-11", "backups", "bec"],
    links: [
      ...PRIV_LINKS,
      { label: "The 30-day rule small businesses miss", href: "/blog/notifiable-data-breach-scheme-small-business" },
    ],
  },
  "eligible-data-breach": {
    name: "an eligible data breach",
    body: [
      "An eligible data breach has three elements, all of which must be present. First, there is unauthorised access to personal information, unauthorised disclosure of it, or a loss of it in circumstances where unauthorised access or disclosure is likely. Second, a reasonable person would conclude that this is likely to result in serious harm to one or more of the individuals. Third, the organisation has not been able to prevent the likely risk of serious harm with remedial action.",
      "Serious harm can be physical, psychological, emotional, economic or financial, and harm to reputation. The Act lists the factors to weigh: the kind and sensitivity of the information, whether it is protected by security such as encryption, who could obtain it and the likelihood they have the intent to cause harm, and the nature of the harm. Health information, identity documents, financial details and combinations of data that allow identity theft sit at the serious end. A breach that exposes only a business name and a trade phone number sits at the other.",
      "Remedial action can take a breach out of the category. If a misdirected email is recalled or deleted by an unintended recipient who confirms it in writing, or a lost device is wiped before access, the likelihood of harm may fall below the threshold. The decision needs a record that shows what was known and when. When in doubt, the OAIC encourages organisations to notify.",
    ],
    example: {
      title: "Three situations, assessed",
      text: "A spreadsheet of customer names, addresses and phone numbers sent to the wrong supplier, who deletes it and confirms in writing, may not be eligible after remedial action. An unencrypted laptop with scanned driver licences left in a car and never recovered is likely eligible. A hacked mailbox containing invoices and bank details is likely eligible, particularly if forwarding rules show someone was reading it.",
    },
    steps: [
      "Write down what information was involved and how many people.",
      "Ask who could have it and how it could be misused.",
      "Record remedial steps and whether they removed the risk.",
      "If serious harm is still likely, move to notification.",
    ],
    mistakes: [
      "Counting only financial harm and ignoring embarrassment or safety.",
      "Assuming encryption always settles the question without checking the keys were safe.",
      "Making the decision verbally with no record.",
    ],
    see: ["ndb", "oaic", "personal-information", "app-11", "bec"],
    links: PRIV_LINKS,
  },
  oaic: {
    name: "the OAIC",
    body: [
      "The Office of the Australian Information Commissioner is an independent Commonwealth agency that regulates privacy and freedom of information. For privacy, it supervises compliance with the Privacy Act, investigates complaints from the public, receives notifications under the NDB scheme and can start its own investigations. It can make determinations, accept enforceable undertakings and apply to the Federal Court for civil penalties for serious or repeated interferences with privacy.",
      "A large part of its work for a small business is guidance. The OAIC publishes the APP guidelines, a plain-language guide for small business, resources on responding to a data breach, and guidance on privacy and the use of commercially available AI products. Those documents are the primary sources for what the principles require, so a business that follows them has a record that points to the right place when a question arises.",
      "The OAIC does not give legal advice to individual organisations and does not approve privacy policies in advance. It also does not enforce the Essential Eight, which belongs to the ACSC. If a business receives a complaint or a letter from the OAIC, the sensible response is to keep records, respond within the stated time and speak to a lawyer who works in privacy. Notifications of data breaches are made through the OAIC's online form.",
    ],
    example: {
      title: "A complaint, from the business side",
      text: "A customer complains to the business that their information was shared without permission, and then complains to the OAIC. The OAIC usually asks the business to respond first. A business with a data map, a privacy policy and a note of the decision it made on disclosure can answer in a few paragraphs, with the documents attached.",
    },
    steps: [
      "Bookmark the OAIC small business and data breach pages.",
      "Keep a copy of your privacy policy and data map where staff can find them.",
      "Know who responds if the OAIC contacts you and keep a record of every step.",
      "Take privacy-specific legal advice before any formal response.",
    ],
    mistakes: [
      "Assuming a regulator letter can wait.",
      "Treating the OAIC as the body for cyber security advice.",
      "Citing blog posts instead of the OAIC guidance in a reply.",
    ],
    see: ["privacy-act", "ndb", "app", "acsc", "eligible-data-breach"],
    links: PRIV_LINKS,
  },
  "personal-information": {
    name: "personal information",
    body: [
      "The Privacy Act defines personal information as information or an opinion about an identified individual, or an individual who is reasonably identifiable. It does not matter whether the information is true, or whether it is recorded in a material form. The test of reasonably identifiable asks whether a person can be identified from the information, possibly together with other information the holder has or could get, and the answer depends on the context.",
      "Everyday examples include names, addresses, phone numbers, email addresses, photos, signatures, job applications, call recordings and notes on a customer file. A set of facts that look anonymous alone can identify someone when combined, such as a suburb, a job and a date. Sensitive information is a special subset covering health, racial or ethnic origin, political opinions, religious or philosophical beliefs, sexual orientation, criminal record, genetic and biometric information. Collecting it generally needs consent, and it receives stronger protection.",
      "The definition matters for modern tools. A voice recording of a caller is personal information. So is a customer's job description pasted into a chatbot, and so is a transcript. Using them is a use or disclosure that must fit the principles, and an overseas service may add APP 8 duties. Information about a company is not personal information, but information about its director can be.",
    ],
    example: {
      title: "Spotting it in a workflow",
      text: "A tradie's quote template contains a customer's name, address, mobile number and a note that they will be away on holiday next week. Each element is personal information, and the holiday note could also reveal that the house is empty, which makes it more sensitive in practice. The business decides to remove the note from the shared quote and keep it in the private job record.",
    },
    steps: [
      "Walk through one job from enquiry to invoice and underline every item that identifies a person.",
      "Mark anything sensitive, such as health details.",
      "Check who sees each item and where it is stored.",
      "Remove what you do not need from shared documents and tools.",
    ],
    mistakes: [
      "Treating a phone number or email as harmless.",
      "Forgetting notes and recordings.",
      "Pasting identifying detail into AI tools without a reason.",
    ],
    see: ["app", "privacy-act", "eligible-data-breach", "ai-receptionist", "app-8"],
    links: PRIV_LINKS,
  },
  byok: {
    name: "BYOK",
    body: [
      "In an AI product, the model provider charges for each use. Under the usual vendor-pays model, the software company holds one account, pays the provider, and recovers the cost in its subscription. Under bring your own key, you open your own account with the provider, create an API key and enter it into the software. The provider bills you directly for what your business uses, and the software vendor does not resell usage.",
      "The benefits are practical. Cost is visible to the person paying, because the provider's dashboard shows usage and lets you set a spending cap. The relationship with the provider is direct, so you can read its terms on data retention and training and choose settings such as zero retention where offered. You can revoke the key at any time to stop the software using your account. For privacy under APP 8, you know which provider processes your data and can record it.",
      "The responsibility is also yours. A key is a credential, and anyone who holds it can spend your money and send requests as you. Store it in the software's secret field, never in a shared document or email, set a usage limit, and rotate it if a staff member who knew it leaves. The alternative is prepaid credits bought from the software vendor, which is simpler but puts the vendor between you and the provider.",
    ],
    example: {
      title: "Setting a cap",
      text: "A business creates a key in its own account with a model provider, sets a monthly spending limit in the provider's console, and pastes the key into the software's settings. When a month's usage reaches the limit, requests stop instead of the bill growing. The owner can see the cost per day in the provider's dashboard without asking anyone.",
    },
    steps: [
      "Create an account with the provider and read its data handling terms.",
      "Create a key used only for this software and set a monthly limit.",
      "Enter it in the software's secret field and nowhere else.",
      "Rotate it when anyone with access leaves.",
    ],
    mistakes: [
      "Emailing the key to the person setting up the software.",
      "Using one key for several tools so you cannot tell which spends what.",
      "Leaving no spending limit.",
    ],
    see: ["app-8", "mcp", "ai-receptionist", "personal-information"],
    links: [
      { label: "How TITANOS prices agent tools", href: "/agents" },
      { label: "Free Privacy Act checker", href: "/tools/privacy-act-checker" },
      { label: "What an AI automation costs a small business", href: "/blog/ai-automation-cost-small-business" },
    ],
  },
  "missed-call-text-back": {
    name: "missed-call text-back",
    body: [
      "When a call goes unanswered, many callers do not leave a voicemail. They ring the next business on the list. Missed-call text-back is a small automation that detects the missed call and sends a text to the caller within seconds, so there is a thread to continue. It suits businesses where the owner is often on the tools, in a consult or driving, such as trades, clinics and salons.",
      "A good message is short and honest. It names the business, says the call was missed, asks what the person needs and offers a next step such as a booking link or a promise to call back at a stated time. It should not pretend to be a person if it is automated, it should not contain marketing, and it should reply only to the call just made. Australian businesses must also keep within the Spam Act 2003, which covers commercial electronic messages including SMS, and the ACMA guidance explains consent, identification and unsubscribe. A direct reply to a call someone just made is a different thing from an unsolicited promotion.",
      "The privacy side is simple but real. The caller's number is personal information, any conversation that follows may be too, and the messaging provider may store it overseas. The business should say in its privacy policy that it contacts callers this way and which provider it uses. How much it recovers depends on the business and the callback habit, so measure your own missed calls before you buy anything.",
    ],
    example: {
      title: "A message that is safe to send",
      text: "Hi, this is Example Electrical. Sorry we missed your call. Reply with what you need and we will get back to you today, or book a time at the link below. The message identifies the sender, refers only to the call, contains no offer and invites a reply. Replace the wording with your own and test it on your own phone first.",
    },
    steps: [
      "Count your missed calls for two weeks to see whether it is worth doing.",
      "Write a short message that identifies the business and offers a clear next step.",
      "Check your provider's location for data storage and update your privacy policy.",
      "Review replies weekly and stop messaging anyone who opts out.",
    ],
    mistakes: [
      "Adding promotions to the automatic text.",
      "Sending a message long after the call.",
      "Forgetting to tell callers they may be dealing with an automated system.",
    ],
    see: ["ai-receptionist", "personal-information", "app-8", "app-1"],
    links: [
      { label: "Free missed-call calculator", href: "/tools/missed-call-calculator" },
      { label: "Tradie automation guide for Australia", href: "/guides/tradie-automation-australia" },
      { label: "Dead quotes and hidden revenue", href: "/blog/dead-quotes-hidden-revenue" },
    ],
  },
  "ai-receptionist": {
    name: "an AI receptionist",
    body: [
      "An AI receptionist answers calls or messages using software. For a voice call it turns speech to text, uses a language model to work out what the caller wants and what to say, and converts the reply back to speech. It can answer common questions, take a message, check a diary and offer a booking. Done well, it covers the times nobody can pick up, such as after hours or when a tradie is up a ladder.",
      "It is not the same as a human answering service following a script, and the difference matters for honesty and privacy. Callers should be told early that they are speaking to an automated system, and should be able to ask for a person. Because the call can contain names, addresses, health details and payment talk, the business needs to know what is recorded, where it is stored, how long it is kept and who at the vendor can access it. Those answers go into the privacy policy under APP 1 and, for overseas processing, APP 8.",
      "The business also stays responsible for what the system says. Limit what it can promise, such as prices and availability, to information you have approved, and send anything unusual to a person. Titanos describes this as giving hours back to a team, and it works best as a way to cover missed calls without replacing anyone. The OAIC has published guidance on privacy and commercially available AI products that is worth reading before choosing a vendor.",
    ],
    example: {
      title: "A sensible set-up",
      text: "A plumbing business lets the receptionist answer after 5 pm and when both phones are busy. It opens with a line saying it is an automated assistant for the business, takes the caller's name, address and problem, offers the next available inspection slot from the diary and flags any mention of gas or flooding to the on-call plumber by text. Callers can say they want a person and are put through or promised a callback.",
    },
    steps: [
      "Decide which calls it handles and which go straight to a person.",
      "Write the opening disclosure that it is automated.",
      "Ask the vendor where audio and transcripts are stored and for how long.",
      "Update the privacy policy and review a sample of calls each week.",
    ],
    mistakes: [
      "Letting it quote prices it has not been given.",
      "Hiding that it is automated.",
      "Keeping recordings with no retention period.",
    ],
    see: ["missed-call-text-back", "app-1", "app-8", "adm", "byok"],
    links: [
      { label: "Is an AI receptionist Privacy Act compliant?", href: "/blog/ai-receptionist-compliance" },
      { label: "AI receptionist guide for Australian trades", href: "/guides/ai-receptionist-australia-trades" },
      { label: "Free missed-call calculator", href: "/tools/missed-call-calculator" },
    ],
  },
  mcp: {
    name: "MCP",
    body: [
      "Language models can write text, but to do useful work they need to read data and take actions in other systems. Until recently, each assistant needed its own custom connection to each tool. The Model Context Protocol, introduced by Anthropic in November 2024, is an open standard that replaces that with one shape. A developer writes an MCP server that lists the tools it offers, what each does and what inputs it takes. Any application that speaks MCP can discover the list and call the tools.",
      "A server might offer a calendar lookup, a customer record search, a file reader or a security check. The model chooses which tool to call and with what inputs, and the application runs it and returns the result. This is powerful, and it means a connected tool can do real things: read private data, send a message, spend money. The security advice follows from that. Give each connection the narrowest permissions that work, keep a log of every call, prefer read-only tools where possible, and require a person to approve anything that sends, spends or deletes.",
      "Treat the content a tool returns as data, not instructions, because a web page or a message can contain text designed to steer the model. For a small business the practical question is not the protocol but the permissions: which systems is an AI assistant connected to, with whose key, and what is the worst thing it could do with that access? The Titanos agent tools follow the MCP pattern and the public endpoint is in preview.",
    ],
    example: {
      title: "A scoped connection",
      text: "A business connects an assistant to its diary through an MCP server that can read free slots and create a provisional booking, but cannot delete events or see other calendars. Every call is logged. The owner reviews the log weekly and confirms bookings before they become firm. If the key were stolen, the damage would be limited to unwanted provisional bookings.",
    },
    steps: [
      "List each system an assistant is connected to and with which credentials.",
      "Give each connection the least permission that does the job.",
      "Log every call and review the log.",
      "Require approval for anything that sends, spends or deletes.",
    ],
    mistakes: [
      "Connecting an assistant with an administrator key.",
      "Trusting text returned by a tool as if the owner had written it.",
      "Never reviewing what the assistant actually did.",
    ],
    see: ["byok", "app-11", "mfa", "ai-receptionist", "admin-privileges"],
    links: [
      { label: "TITANOS agent door (preview)", href: "/agents" },
      { label: "Free Privacy Act checker", href: "/tools/privacy-act-checker" },
      { label: "Tradie automation guide for Australia", href: "/guides/tradie-automation-australia" },
    ],
  },
};
