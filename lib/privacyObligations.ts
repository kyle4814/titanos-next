/**
 * Privacy Act obligation explainers (seo2 push, 2026-11-28).
 * One entry per obligation. Every requirement below was checked on 2026-11-28 against the primary text:
 *   - Privacy Act 1988, Compilation No. 104 (compilation date 4 June 2026), legislation.gov.au C2004A03712
 *   - Privacy and Other Legislation Amendment Act 2024 (No. 128, 2024), legislation.gov.au C2024A00128
 *   - the OAIC pages listed in each entry's sources.
 * General information, not legal advice. Copy rules: Australian English, no em or en dashes.
 */

export type Source = { label: string; url: string; note: string };
export type Faq = { q: string; a: string };

export type Obligation = {
  slug: string;
  short: string; // card label
  title: string; // <= 60 characters, unique
  description: string; // 140 to 160 characters
  h1: string;
  term: string; // target search term
  answer: string; // the one-paragraph direct answer
  commences: string; // plain-language date line, used in the hub table
  smallBusiness: string; // does it reach a small business? used in the hub table
  appliesTo: string[];
  requires: { heading: string; body: string }[];
  example: { heading: string; scenario: string; walk: string[]; takeaway: string };
  checklist: string[];
  traps: string[];
  faq: Faq[];
  sources: Source[];
  related: string[]; // sibling slugs
};

export const LAST_REVIEWED = "2026-11-28";
export const LAST_REVIEWED_LONG = "28 November 2026";

export const ACT_URL = "https://www.legislation.gov.au/C2004A03712/latest/text";
export const POLA_URL = "https://www.legislation.gov.au/C2024A00128/latest/text";

const ACT: Source = {
  label: "Privacy Act 1988 (Cth), current compilation",
  url: ACT_URL,
  note: "Compilation No. 104, dated 4 June 2026, was the latest compilation when this page was reviewed.",
};
const POLA: Source = {
  label: "Privacy and Other Legislation Amendment Act 2024 (No. 128, 2024)",
  url: POLA_URL,
  note: "The amending Act. Section 2 sets out when each part commences.",
};

export const OBLIGATIONS: Obligation[] = [
  {
    slug: "app-1-automated-decisions",
    short: "APP 1 and automated decisions",
    title: "APP 1 and Automated Decision Privacy Policy Duty",
    description:
      "From 10 December 2026 a privacy policy must say when software makes or helps make decisions about people. Who it covers, the test, and a worked example.",
    h1: "APP 1 and the automated decision privacy policy duty",
    term: "automated decision making privacy policy australia",
    answer:
      "From 10 December 2026, an organisation covered by the Privacy Act must add three things to its privacy policy if it has set up a computer program to make, or do something substantially and directly related to making, a decision that could reasonably be expected to significantly affect someone's rights or interests, using their personal information. It is a disclosure duty. It does not ban automated decisions, and it does not give people a new right to an explanation.",
    commences: "10 December 2026 (Schedule 1, Part 15 of the 2024 amending Act)",
    smallBusiness: "Only if the business is covered by the Act (see the small business exemption)",
    appliesTo: [
      "Any APP entity. That is an organisation the Act covers (a business over the AU$3 million turnover line, or a smaller business caught by one of the exceptions) or a government agency.",
      "A business that has arranged for software to make a decision, or to do a thing substantially and directly related to making it, where personal information is used and the decision could reasonably be expected to significantly affect the person's rights or interests.",
      "It applies to decisions made after 10 December 2026, even when the software was set up earlier or the personal information was collected earlier (item 89 of Part 15).",
    ],
    requires: [
      {
        heading: "What APP 1 already requires",
        body: "APP 1.3 requires a clearly expressed and up-to-date privacy policy. APP 1.4 lists what it must contain: the kinds of personal information collected and held, how it is collected and held, the purposes, how a person can access and correct it, how to complain, and whether information is likely to go overseas (with the countries where practicable). APP 1.5 says make it available free of charge and in an appropriate form, which is usually the website. APP 1.2 sits underneath: take reasonable steps to put in place practices, procedures and systems that let you comply and handle complaints. None of that changes on 10 December 2026. The new duty is added after APP 1.6.",
      },
      {
        heading: "The new test in APP 1.7",
        body: "Three conditions must all be true. First, you have arranged for a computer program to make a decision, or to do a thing substantially and directly related to making a decision. Second, the decision could reasonably be expected to significantly affect the rights or interests of an individual. Third, personal information about that individual is used in running the program. The Act says making a decision includes refusing or failing to make one, and that rights or interests can be affected for better or worse (APP 1.9). Its examples are a decision to grant or refuse a benefit, a decision that affects a person's rights under a contract, and a decision that affects access to a significant service or support. The Act does not define 'significantly', so this is a judgement call that you should be able to explain.",
      },
      {
        heading: "What the policy must then say (APP 1.8)",
        body: "If the test is met, the privacy policy must describe the kinds of personal information used in the operation of those programs, the kinds of decisions made solely by the programs, and the kinds of decisions where the program does a thing substantially and directly related to making the decision (a human still signs off, but the software scored, ranked or filtered). The wording is about kinds, not individual decisions, so a short plain paragraph per tool is the target. Because the duty sits inside the APP 1.4 family, it is judged the same way as the rest of the policy: clearly expressed and up to date.",
      },
    ],
    example: {
      heading: "Worked example: a 14-person trade supplier with online credit accounts",
      scenario:
        "A 14-person Brisbane plumbing supplier is over the AU$3 million line, so the Act covers it. Trade customers apply for a 30-day account online. Since 2025 the supplier has used a scoring add-on in its accounting software: it reads the applicant's name, ABN, director details and trade references, and the add-on either approves the account, declines it, or flags it for the owner to look at. The owner glances at the flagged ones only.",
      walk: [
        "Condition 1: a computer program makes the decision (approve or decline) and, for flagged files, does a thing substantially and directly related to it (the flag). Met.",
        "Condition 2: refusing a credit account affects a person's access to a service and their rights under a contract. A reasonable person would call that significant. Met.",
        "Condition 3: it uses personal information about the director (an individual). Met.",
        "Contrast: the same business uses a chatbot that suggests a delivery window. That has no real effect on anyone's rights or interests, so APP 1.7 is likely not triggered. Keep a one-line note of why you reached that view.",
        "Policy change before 10 December 2026: add a short section naming the kinds of information used (identity, business and credit-reference details), the kind of decision made solely by the software (approve or decline small accounts) and the kind where the software only helps (flagging larger accounts for the owner).",
      ],
      takeaway:
        "The work is an inventory: list every tool that scores, ranks, filters, approves or declines people, then decide tool by tool whether it meets the three conditions and write the paragraph. For this supplier it is one section of about 120 words and an hour of checking.",
    },
    checklist: [
      "Confirm the Act covers you (turnover over AU$3 million, or one of the small business exceptions).",
      "List every tool that scores, ranks, filters, approves, declines, prices or schedules people: CRM lead scoring, credit checks, hiring filters, fraud rules, dynamic pricing, roster tools.",
      "For each tool, ask the three APP 1.7 questions and write one sentence recording the answer.",
      "Ask each vendor in writing what personal information the tool uses and whether a human reviews outcomes.",
      "Add the APP 1.8 information to the privacy policy: kinds of information, kinds of decisions made solely by software, kinds of decisions the software only supports.",
      "Publish the updated policy before 10 December 2026 and keep the previous version on file.",
      "Diary a review whenever a new tool is switched on.",
    ],
    traps: [
      "Reading the duty as 'we use AI, so we must disclose'. The trigger is a decision that significantly affects someone, not the presence of AI.",
      "Assuming a human click ends it. A program that does a thing substantially and directly related to the decision is still inside APP 1.7.",
      "Leaving it to a vendor's terms. The duty sits on you as the entity that arranged the program.",
      "Overreaching: do not claim 'no automated decisions' unless you have checked every tool.",
    ],
    faq: [
      {
        q: "Does the automated decision duty apply to small businesses?",
        a: "Only to those the Privacy Act covers. A business with turnover of AU$3 million or less is generally outside the APPs unless an exception in section 6D applies, such as providing a health service or trading in personal information.",
      },
      {
        q: "Does it ban automated decisions?",
        a: "No. APP 1.7 and 1.8 only require the privacy policy to say what kinds of information are used and what kinds of decisions are made or supported by software.",
      },
      {
        q: "Does a decision made before 10 December 2026 count?",
        a: "The new clause applies to decisions made after the commencement date. It does not matter whether the program was arranged or the personal information was collected earlier.",
      },
    ],
    sources: [
      POLA,
      { label: "Privacy Act 1988, Schedule 1, APP 1 (clause 1)", url: ACT_URL, note: "APP 1.2 to 1.6 as they stand today." },
      {
        label: "OAIC: APP guidelines, Chapter 1 (open and transparent management)",
        url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-1-app-1-open-and-transparent-management-of-personal-information",
        note: "The regulator's reading of the existing privacy policy rules.",
      },
    ],
    related: ["app-5-notification-of-collection", "app-8-cross-border-disclosure", "small-business-exemption"],
  },

  {
    slug: "app-5-notification-of-collection",
    short: "APP 5 notification",
    title: "APP 5 Collection Notice: What to Tell People and When",
    description:
      "APP 5 says tell people who you are, why you collect their details and who sees them, at or before collection. The ten matters, with a worked quote form.",
    h1: "APP 5 notification of collection: the collection notice explained",
    term: "app 5 collection notice australia",
    answer:
      "APP 5 requires an organisation covered by the Privacy Act to take reasonable steps, at or before the time it collects personal information (or as soon as practicable afterwards), to tell the person the relevant matters in APP 5.2 or to make sure they are already aware of them. That is usually a short collection notice next to each form, plus the link to the full privacy policy.",
    commences: "In force now",
    smallBusiness: "Only if the business is covered by the Act",
    appliesTo: [
      "Any APP entity that collects personal information, whether directly from the person or from someone else.",
      "Solicited information (a form, a call, a booking) and unsolicited information you keep rather than destroy or de-identify.",
      "A small business that falls outside the Act is not bound, but a covered one is, and so is any business that is a contractor to a covered customer through the contract.",
    ],
    requires: [
      {
        heading: "The standard: reasonable steps, at the right time",
        body: "APP 5.1 asks for such steps, if any, as are reasonable in the circumstances to notify the person of the APP 5.2 matters that are reasonable, or to otherwise ensure they are aware of them. The timing is at or before collection or, if that is not practicable, as soon as practicable after. The OAIC's guidelines read 'reasonable steps' as depending on things like how sensitive the information is, who the person is and how it is collected. A notice is not needed for a matter the person already knows, but you should be able to show why you thought they knew.",
      },
      {
        heading: "The matters you may need to cover (APP 5.2)",
        body: "The identity and contact details of your business. The fact and circumstances of collection where you collected from someone else or the person may not be aware you collected it. Whether an Australian law or a court or tribunal order requires or authorises the collection, naming the law. The purposes of collection. The main consequences for the person if some or all of the information is not collected. The other bodies or types of bodies you usually disclose that kind of information to. A statement that your privacy policy explains how to access and correct information. A statement that it explains how to complain. Whether you are likely to disclose the information to overseas recipients and, if so and practicable, the countries.",
      },
      {
        heading: "How APP 5 connects to the rest",
        body: "The overseas items in APP 5.2(i) and (j) mirror APP 1.4(f) and (g), so a notice and a policy that disagree is a common fault. If you start using a new tool that sends data offshore (an AI transcription service, a new CRM) the notice needs updating, and APP 8 may need attention too. From 10 December 2026, if automated decisions fall inside APP 1.7, the policy the notice points to must say so.",
      },
    ],
    example: {
      heading: "Worked example: a 9-person landscaping firm's online quote form",
      scenario:
        "A 9-person Gold Coast landscaping business collects name, mobile, email, street address and photos of the yard through a web quote form. It also takes the same details by phone. Turnover is AU$3.4 million, so the Act covers it. It uses a third-party CRM hosted offshore and a review-request tool.",
      walk: [
        "Identity and contact: business name, ABN and a privacy email address under the form.",
        "Purpose: to prepare and deliver the quote, schedule the work and send a review request after the job.",
        "Consequence of not providing: 'we cannot quote without the property address'. Optional fields are marked optional.",
        "Disclosure: the CRM provider, the scheduling tool and the review-request tool, described as types of provider if names change often.",
        "Policy pointers: 'Our privacy policy explains how to see and correct your information and how to complain', with the link.",
        "Overseas: 'Our CRM provider stores data in the United States'. This is the only country that is practicable to state, and it must match the privacy policy.",
        "Phone collection: the same matters are said in one sentence at the start of the call, and the link is texted with the confirmation.",
      ],
      takeaway:
        "One 90 word notice, in plain words, placed where the person types their details, covers the form. The phone script reuses it, so the business keeps one source of truth.",
    },
    checklist: [
      "List every place you collect personal information: web forms, phone, email, in person, photos, third-party lead lists.",
      "Put a short notice at or before each point of collection, not only in the footer.",
      "Cover each APP 5.2 matter that is reasonable in the circumstances, and write down why you left any out.",
      "Name the countries in the notice if you disclose overseas and it is practicable.",
      "Make the notice match the privacy policy (purposes, recipients, overseas disclosure).",
      "For information collected from someone else, say so and say how it was collected.",
      "Review when you add a tool or a new purpose.",
    ],
    traps: [
      "A privacy policy link in the footer only. APP 5 is about notifying at the time of collection.",
      "Listing a purpose you do not have, or omitting a purpose you do (such as marketing).",
      "Forgetting information collected indirectly, for example from a lead list or a referral partner.",
      "Notice and policy disagreeing on overseas recipients.",
    ],
    faq: [
      {
        q: "Is a collection notice the same as a privacy policy?",
        a: "No. The privacy policy (APP 1) is the full document. The collection notice (APP 5) is the short statement given at or before the point of collection, which points to the policy.",
      },
      {
        q: "Do I need the notice if the person already knows everything in it?",
        a: "APP 5.1(b) allows you to 'otherwise ensure' the person is aware of the matters. Keep evidence of why you were satisfied they were.",
      },
      {
        q: "When must the notice be given?",
        a: "At or before collection, or if that is not practicable, as soon as practicable afterwards.",
      },
    ],
    sources: [
      { label: "Privacy Act 1988, Schedule 1, APP 5 (clause 5)", url: ACT_URL, note: "APP 5.1 and the ten matters in APP 5.2." },
      {
        label: "OAIC: APP guidelines, Chapter 5 (notification of collection)",
        url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-5-app-5-notification-of-the-collection-of-personal-information",
        note: "Explains reasonable steps, timing and how to give notice.",
      },
    ],
    related: ["app-1-automated-decisions", "app-8-cross-border-disclosure", "small-business-exemption"],
  },

  {
    slug: "app-8-cross-border-disclosure",
    short: "APP 8 cross-border",
    title: "APP 8 and AI Tools: Overseas Disclosure Explained",
    description:
      "APP 8 makes you answerable for how an overseas recipient handles personal information. When AI tools and offshore SaaS count, the exceptions, a worked example.",
    h1: "APP 8 cross-border disclosure, including AI tools and offshore SaaS",
    term: "app 8 cross border disclosure ai tools australia",
    answer:
      "Before an organisation covered by the Privacy Act discloses personal information to someone outside Australia, it must take reasonable steps to make sure that recipient does not breach the APPs (other than APP 1). If it does not, and the recipient mishandles the information, section 16C treats the Australian business as having breached the Act. Typing customer details into a public overseas AI chatbot is a disclosure. Storing data with an overseas cloud provider may be only a 'use' if three contract conditions are met.",
    commences: "In force now",
    smallBusiness: "Only if the business is covered by the Act",
    appliesTo: [
      "Any APP entity that discloses personal information to a person who is not in Australia or an external Territory and who is not the entity or the individual.",
      "Businesses that use offshore software as a service, overseas support or outsourcing, or generative AI tools that run on servers outside Australia.",
      "The test is about the act of disclosure. It does not matter whether the recipient meant to receive the information or already knew it.",
    ],
    requires: [
      {
        heading: "APP 8.1 and section 16C",
        body: "APP 8.1 requires reasonable steps, before disclosure, to ensure the overseas recipient does not breach the APPs other than APP 1. The OAIC's guidelines say it is generally expected that you will have an enforceable contract with the recipient requiring it to handle the information in line with the APPs, covering the kinds of information and purposes, compliance with the APPs on collection, use, disclosure, storage and destruction, subcontractors, and complaint handling. Section 16C sits behind it: if the recipient is not itself bound by the APPs and does something that would breach them, that act is taken to be your act and your breach.",
      },
      {
        heading: "Disclosure or use: the cloud question",
        body: "The OAIC treats routing information through an overseas server in transit as usually a 'use', and says a disclosure generally does not occur until the overseas recipient can access or modify the information. Giving information to an overseas cloud provider only to store it and keep it accessible to you may be a 'use' rather than a disclosure if a binding contract limits the provider to those purposes, any subcontractors agree to the same, and the contract gives you effective control (including the power to access, change, retrieve and delete). Where it is a use, APP 8 does not apply, but you are still treated as 'holding' the information and the other APPs, including security, remain yours.",
      },
      {
        heading: "AI tools",
        body: "The OAIC's guidance on commercially available AI products says that entering personal information into a publicly available chatbot is a disclosure to the owner of the tool, so APP 6 and APP 8 are both engaged, along with collection, accuracy and notice obligations. As a matter of best practice, it recommends organisations do not enter personal information, and particularly sensitive information, into publicly available generative AI tools. It says that a proprietary system with protections ensuring information is not disclosed outside the organisation, for example to the developer, will be a use rather than a disclosure. Check the vendor's terms for retention, training on your inputs and subprocessors.",
      },
      {
        heading: "The exceptions in APP 8.2 and 8.3",
        body: "APP 8.1 does not apply if you reasonably believe the recipient is subject to a law or binding scheme that protects the information in a way that is, overall, at least substantially similar to the APPs and that the person can enforce; if the person, after being expressly told that APP 8.1 will not apply, consents; if the disclosure is required or authorised by an Australian law or court order; or if a permitted general situation exists. APP 8.3 adds recipients subject to the laws of a country, or participants in a binding scheme, prescribed by the regulations. The prescribed list was not checked for this page, so do not assume a country qualifies without looking.",
      },
    ],
    example: {
      heading: "Worked example: a 12-person physiotherapy clinic",
      scenario:
        "A Brisbane clinic with 12 staff that provides a health service (so the Act covers it whatever its turnover) uses three offshore tools: a booking platform hosted in the United States, an AI note-taker that transcribes client calls, and a free public chatbot that staff use to tidy up emails. Health information is sensitive information.",
      walk: [
        "Booking platform: stores and processes data for the clinic under a contract. Read the data processing terms. If they limit the provider to hosting, bind subcontractors and let the clinic export and delete, treat it as a use and record why. If not, treat it as a disclosure and rely on a contract or another APP 8.2 exception.",
        "AI note-taker: a vendor that keeps recordings to train models is not limited to storage. Treat it as a disclosure, get a contract that rules out training on clinic data, or choose an Australian-hosted option.",
        "Public chatbot: stop pasting client details into it. The OAIC's best practice position is not to enter personal information, particularly sensitive information, into public tools. Give staff a rule and an approved alternative.",
        "Notice and policy: update the APP 5 notice and the privacy policy to say information may go to the United States, naming the country.",
        "Record: keep a one-page register of each vendor, the data it receives, where it is hosted and which route you relied on.",
      ],
      takeaway:
        "APP 8 comes down to a vendor register and three contract questions for each tool. The AI tool most likely to cause trouble is the free one a staff member started using without telling anyone.",
    },
    checklist: [
      "Make a register of every offshore vendor and AI tool that touches personal information, with hosting location.",
      "For each, decide: no personal information, use (three contract conditions met) or disclosure.",
      "For disclosures, get a written contract requiring APP-standard handling, covering subcontractors and complaints.",
      "Check vendor terms for training on your data, retention, subprocessors and deletion.",
      "Set a staff rule for public AI tools and give an approved alternative.",
      "Name the likely countries in the privacy policy (APP 1.4(g)) and in collection notices (APP 5.2(j)).",
      "If you rely on consent, make sure it expressly says APP 8.1 will not apply and is freely given.",
    ],
    traps: [
      "Assuming 'cloud' always means 'use'. Only the three-condition case does.",
      "Relying on a vendor's marketing page rather than a contract.",
      "Forgetting free tools that staff adopted themselves.",
      "Broad consent buried in terms. The exception needs an express statement and a real choice.",
    ],
    faq: [
      {
        q: "Is using an overseas SaaS tool a cross-border disclosure?",
        a: "It can be. It is a disclosure if the provider can access or handle the information for its own purposes. It may be only a use if a contract limits the provider to storage, binds subcontractors and leaves you in effective control.",
      },
      {
        q: "Is pasting customer details into ChatGPT or a similar tool a disclosure?",
        a: "The OAIC's guidance says entering personal information into a publicly available chatbot is a disclosure to the tool's owner, and recommends not entering personal information, particularly sensitive information, into such tools.",
      },
      {
        q: "What does section 16C do?",
        a: "If an overseas recipient is not bound by the APPs and does something that would breach them, that act is treated as yours and as a breach by you.",
      },
    ],
    sources: [
      { label: "Privacy Act 1988, Schedule 1, APP 8 (clause 8) and section 16C", url: ACT_URL, note: "APP 8.1 to 8.3 and the accountability rule." },
      {
        label: "OAIC: APP guidelines, Chapter 8 (cross-border disclosure)",
        url: "https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-8-app-8-cross-border-disclosure-of-personal-information",
        note: "Disclosure versus use, cloud providers, reasonable steps and the exceptions.",
      },
      {
        label: "OAIC: guidance on privacy and the use of commercially available AI products",
        url: "https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/guidance-on-privacy-and-the-use-of-commercially-available-ai-products",
        note: "Published 21 October 2024; includes the chatbot example.",
      },
    ],
    related: ["app-5-notification-of-collection", "app-1-automated-decisions", "notifiable-data-breaches"],
  },

  {
    slug: "notifiable-data-breaches",
    short: "Notifiable Data Breaches",
    title: "Notifiable Data Breaches Scheme: 30-Day Steps",
    description:
      "When a data breach must be reported to the OAIC and your customers, the serious harm test, the 30-day assessment and a worked example for a small team.",
    h1: "The Notifiable Data Breaches scheme: what a small business must do",
    term: "notifiable data breaches scheme small business",
    answer:
      "Under Part IIIC of the Privacy Act, an organisation covered by the Act that has reasonable grounds to believe an eligible data breach has happened must prepare a statement, give it to the OAIC as soon as practicable, and notify the affected individuals. A suspected breach must be assessed quickly, and the Act requires all reasonable steps to finish the assessment within 30 days of becoming aware.",
    commences: "In force now",
    smallBusiness: "Only if the business is covered by the Act",
    appliesTo: [
      "APP entities holding personal information, and also credit reporting bodies, credit providers and tax file number recipients for the information they hold.",
      "A business that is exempt as a small business is not subject to the scheme for its general customer records, which is one reason the exemption matters in practice.",
      "Breaches caused by staff, suppliers or criminals. The scheme looks at the outcome, not the cause.",
    ],
    requires: [
      {
        heading: "What an eligible data breach is (sections 26WE and 26WG)",
        body: "There are two routes. Either there is unauthorised access to, or unauthorised disclosure of, the information and a reasonable person would conclude it would be likely to result in serious harm to any of the individuals; or the information is lost in circumstances where unauthorised access or disclosure is likely and, assuming it occurred, a reasonable person would conclude serious harm would be likely. In deciding likelihood of serious harm, the Act lists matters to weigh: the kinds and sensitivity of the information, whether security measures protect it and how likely they are to be overcome, who has or could obtain it, whether encryption or similar technology was used and how likely it is that someone with harmful intent could get the key, the nature of the harm and any other relevant matters.",
      },
      {
        heading: "Fixing it first (section 26WF)",
        body: "If you take remedial action before the access or disclosure results in serious harm, and as a result a reasonable person would conclude serious harm is no longer likely, it is not an eligible data breach. If that is true for particular individuals only, you do not have to notify those individuals. This is why speed matters: containing the problem fast can change the legal answer.",
      },
      {
        heading: "Assess within 30 days, then notify (sections 26WH, 26WK, 26WL)",
        body: "If you suspect a breach but are not yet sure, you must carry out a reasonable and expeditious assessment and take all reasonable steps to complete it within 30 days of becoming aware. Once you have reasonable grounds to believe it is an eligible data breach, you must prepare a statement with your identity and contact details, a description of the breach, the kinds of information involved and recommendations on what individuals should do, and give a copy to the Commissioner as soon as practicable. You then notify the individuals: each person whose information is involved if practicable, or else those at risk; if neither is practicable, publish the statement on your website and take reasonable steps to publicise it. The OAIC provides an online form for the Commissioner notification.",
      },
      {
        heading: "Security duty underneath",
        body: "The scheme sits beside APP 11.1, which requires reasonable steps to protect personal information from misuse, interference, loss and unauthorised access, modification or disclosure. Strong logins, encryption on laptops and phones, and tested backups reduce both the chance of a breach and the chance that one reaches the serious harm threshold.",
      },
    ],
    example: {
      heading: "Worked example: a 12-person building products wholesaler",
      scenario:
        "On a Tuesday a 12-person wholesaler learns that a bookkeeper's work laptop was stolen from a car overnight. It held trade account application forms with director names, addresses, driver licence images and bank details for about 400 customers. The business is over AU$3 million, so the Act covers it.",
      walk: [
        "Hour 0 to 4: contain. Remote lock and wipe the laptop, change the bookkeeper's passwords, revoke sessions, and write down the time you became aware.",
        "Day 1: assess. Was the disk encrypted and the device locked? If the disk was fully encrypted with a strong password and the key is not with the laptop, a reasonable person may conclude serious harm is not likely (section 26WG(h)). If it was not, the driver licence images and bank details point strongly towards serious harm.",
        "Day 2 to 5: decide and record. Write down what you knew, what you checked, who decided and why. If you cannot decide quickly, you are in the suspected breach path and the 30-day clock applies.",
        "If eligible: prepare the statement (who you are, what happened, what kinds of information, what customers should do such as watch for impersonation and consider replacing licences), lodge it with the OAIC and email or call each affected customer.",
        "After: fix the cause. Enforce device encryption, stop storing licence images on laptops, and add the incident to the register.",
      ],
      takeaway:
        "The facts that decide it are encryption, sensitivity and who may hold the device. A one-page response plan with names and phone numbers, written before the incident, is what turns a bad Tuesday into a manageable one.",
    },
    checklist: [
      "Confirm whether the Act covers you. If it does, the scheme applies to you.",
      "Name an incident lead and a backup, and keep their phone numbers off the systems that might be down.",
      "Write a one-page response plan: contain, assess, decide, notify, review.",
      "Record the time you became aware of any suspected breach.",
      "Keep a register of incidents including ones you decide are not notifiable and why.",
      "Prepare a draft statement with the four required items so it can be finished quickly.",
      "Check supplier contracts require them to tell you promptly about breaches affecting your customers' data.",
      "Turn on encryption, multi-factor authentication and tested backups.",
    ],
    traps: [
      "Waiting until the end of the 30 days. The Act asks for a reasonable and expeditious assessment.",
      "Treating the assessment as private paperwork. Keep a written record of reasoning.",
      "Assuming the supplier will notify. Check who holds the information and whose breach it is, and note section 26WJ avoids double notification only where one entity has complied.",
      "Telling customers a vague 'we had an issue'. The statement needs specific content.",
    ],
    faq: [
      {
        q: "How long do I have to assess a suspected data breach?",
        a: "You must take all reasonable steps to complete a reasonable and expeditious assessment within 30 days after becoming aware of the suspicion.",
      },
      {
        q: "Do I notify the OAIC and the customers?",
        a: "Yes, for an eligible data breach. The statement goes to the Commissioner as soon as practicable, and the individuals are notified in one of the three ways in section 26WL.",
      },
      {
        q: "What if I fix the problem before anyone is harmed?",
        a: "Section 26WF says that effective remedial action taken before serious harm results can mean the incident is not an eligible data breach, or that particular individuals need not be notified.",
      },
    ],
    sources: [
      { label: "Privacy Act 1988, Part IIIC (sections 26WA to 26WR)", url: ACT_URL, note: "Eligible data breach, remedial action, assessment, statement and notification." },
      {
        label: "OAIC: about the Notifiable Data Breaches scheme",
        url: "https://www.oaic.gov.au/privacy/notifiable-data-breaches/about-the-notifiable-data-breaches-scheme",
        note: "The regulator's overview and links to the notification form.",
      },
      {
        label: "OAIC: data breach preparation and response",
        url: "https://www.oaic.gov.au/privacy/notifiable-data-breaches/preventing-preparing-for-and-responding-to-data-breaches/data-breach-preparation-and-response",
        note: "Guide to building a response plan and handling a breach.",
      },
    ],
    related: ["app-8-cross-border-disclosure", "small-business-exemption", "serious-invasion-of-privacy-tort"],
  },

  {
    slug: "small-business-exemption",
    short: "Small business exemption",
    title: "Privacy Act Small Business Exemption and Exceptions",
    description:
      "The AU$3 million small business exemption, how turnover is counted, and the exceptions that pull a small business back in. A checklist and worked cases.",
    h1: "The Privacy Act small business exemption and its exceptions",
    term: "privacy act small business exemption $3 million",
    answer:
      "A business with annual turnover of AU$3 million or less is a small business, and a small business operator is generally outside the Privacy Act. But section 6D takes a business out of the exemption if it has had turnover over AU$3 million in a financial year since it started (or since section 6D began, if later), provides a health service and holds health information, trades in personal information, is a Commonwealth contractor, is a credit reporting body, or is related to a larger body corporate. Others are caught by section 6E or opt in under 6EA.",
    commences: "In force now",
    smallBusiness: "This is the test that decides whether a small business is covered",
    appliesTo: [
      "Sole traders, partnerships, companies and trusts that carry on one or more businesses with turnover of AU$3 million or less.",
      "Anyone asking 'does the Privacy Act apply to us?' before spending on a privacy policy or breach plan.",
      "Businesses close to the line or that grew recently, because the test looks at the previous financial year.",
    ],
    requires: [
      {
        heading: "The turnover test (sections 6D and 6DA)",
        body: "A business is a small business at a given time if its annual turnover for the previous financial year was AU$3,000,000 or less. A new business with no previous year uses the current year. Turnover is the total earned in the course of the business: sales of goods and services, commission, repair and service income, rent, leasing and hiring income, government bounties and subsidies, interest, royalties and dividends and other operating income. A part-year is scaled up by days. The OAIC adds that turnover does not include assets held, capital gains or proceeds of capital sales. For a business with only one activity, the Act's note says turnover will often be similar to the instalment income reported to the ATO.",
      },
      {
        heading: "The ratchet: once over the line",
        body: "Section 6D(4)(a) says a business is not a small business operator if it carries on a business that has had annual turnover of more than AU$3,000,000 for a financial year that ended after the later of when it started carrying on the business and the commencement of section 6D. The practical reading is that a single year above the line takes you out of the exemption, and a later fall below it does not by itself bring you back. Check the wording with a lawyer before relying on a return to exempt status.",
      },
      {
        heading: "The exceptions that apply whatever your turnover (section 6D(4) to (9))",
        body: "The business provides a health service to another individual and holds health information (other than in an employee record). It discloses personal information about another individual to anyone else for a benefit, service or advantage, or provides a benefit, service or advantage to collect personal information about another individual from anyone else (with carve-outs where the person consents or the law requires or authorises it). It is a contracted service provider for a Commonwealth contract. It is a credit reporting body. A body corporate related to a body corporate that carries on a business that is not a small business is also out. The OAIC's list adds, from sections 6E and related provisions, reporting entities under the AML/CTF Act, residential tenancy database operators, protected action ballot agents, consumer data right accredited businesses and businesses prescribed by regulation.",
      },
      {
        heading: "Opting in (section 6EA)",
        body: "A small business operator can choose to be treated as an organisation and be covered by the Act, which some do to satisfy a larger client. The OAIC lists opting in as one of the ways a small business is covered.",
      },
    ],
    example: {
      heading: "Worked examples: four small businesses, four answers",
      scenario:
        "Four businesses each turn over under AU$3 million this year. Whether the Act covers each one depends on what they do, not on size.",
      walk: [
        "A two-person bookkeeping practice with AU$450,000 turnover that never discloses client details for a benefit: a small business operator, so the APPs do not apply by default. It may still opt in under 6EA.",
        "A six-person physiotherapy clinic with AU$1.4 million turnover: it provides a health service and holds health information, so section 6D(4)(b) takes it out of the exemption. The APPs and the NDB scheme apply.",
        "A five-person marketing agency, AU$900,000, that buys and sells contact lists: disclosing personal information for a benefit or collecting it for a benefit under 6D(4)(c) and (d) takes it out, unless the individuals consented or the law authorised it (6D(7) and (8)).",
        "A 15-person electrical contractor that exceeded AU$3 million three years ago and is now at AU$2.4 million: the ratchet in 6D(4)(a) means it should assume it is still covered.",
      ],
      takeaway:
        "Ask three questions in order: have we ever been over AU$3 million, do we do any of the section 6D(4) things, and are we related to a bigger company? A yes to any of them means you plan as a covered business.",
    },
    checklist: [
      "Write down last financial year's turnover using the section 6DA categories, and the year before.",
      "Check whether any past financial year exceeded AU$3 million.",
      "Check if you provide a health service (including counselling, gyms or allied health) and hold health information.",
      "Check if you buy, sell, swap or hand over personal information, or are paid to collect it.",
      "Check if you hold a Commonwealth contract, are a reporting entity or are related to a larger company.",
      "If exempt, record the date and reasoning, and diary the check for each 1 July.",
      "If you choose to opt in, put it in writing and plan for APPs 1 to 13.",
    ],
    traps: [
      "Reading 'exempt' as 'no obligations'. The statutory tort and other laws still apply (see the tort explainer).",
      "Counting only profit or only invoiced sales. Turnover is gross and covers listed categories.",
      "Forgetting the group. A related larger company changes the answer.",
      "Treating this as permanent. Re-check the Act and your turnover each year.",
    ],
    faq: [
      {
        q: "Does the AU$3 million exemption still exist?",
        a: "Yes. Section 6D is in the current compilation of the Privacy Act (Compilation No. 104, 4 June 2026). Reform to narrow or remove the exemption has been proposed, so check the OAIC for the current position and re-check the Federal Register of Legislation before relying on this.",
      },
      {
        q: "Is a sole trader a small business operator?",
        a: "A sole trader is an individual who can be a small business operator if turnover is AU$3 million or less and none of the section 6D(4) exceptions apply.",
      },
      {
        q: "Does an exempt small business have to report data breaches?",
        a: "The Notifiable Data Breaches scheme applies to entities the Act covers. An exempt small business operator is not generally subject to it, though contracts with customers may impose similar duties.",
      },
    ],
    sources: [
      { label: "Privacy Act 1988, sections 6D, 6DA, 6E and 6EA", url: ACT_URL, note: "The turnover test, the exceptions and the opt-in." },
      {
        label: "OAIC: small business",
        url: "https://www.oaic.gov.au/privacy/privacy-for-organisations/small-business",
        note: "The regulator's summary of who is covered regardless of turnover.",
      },
    ],
    related: ["notifiable-data-breaches", "app-1-automated-decisions", "serious-invasion-of-privacy-tort"],
  },

  {
    slug: "serious-invasion-of-privacy-tort",
    short: "Statutory privacy tort",
    title: "Statutory Tort for Serious Invasions of Privacy",
    description:
      "Since 10 June 2025 a person can sue over a serious privacy invasion. The elements, defences, damages cap, deadlines and what a small business should do now.",
    h1: "The statutory tort for serious invasions of privacy: what it means for a small business",
    term: "statutory tort serious invasion of privacy australia small business",
    answer:
      "Since 10 June 2025, Schedule 2 of the Privacy Act lets an individual sue another person in court if that person intentionally or recklessly invaded their privacy in a serious way, by intruding on their seclusion or misusing information about them, where they had a reasonable expectation of privacy and the public interest in their privacy outweighed any competing public interest. The OAIC says it reaches beyond APP entities, so a business exempt from the APPs can still face it.",
    commences: "10 June 2025",
    smallBusiness: "The OAIC says it extends beyond APP entities, so it can reach a small business",
    appliesTo: [
      "Individuals, businesses and other entities, including some that are not APP entities, as the OAIC puts it. The Schedule is to be read separately from the rest of the Act.",
      "Schedule 2 commenced on 10 June 2025.",
      "Not people under 18, intelligence and law enforcement bodies acting in their roles, and journalists in certain circumstances.",
    ],
    requires: [
      {
        heading: "The five elements (clause 7)",
        body: "The claimant must show that the defendant invaded their privacy by intruding on their seclusion or misusing information relating to them; that a person in their position would have had a reasonable expectation of privacy in all the circumstances; that the invasion was intentional or reckless; that it was serious; and that the public interest in their privacy outweighed any competing public interest. It is actionable without proof of damage. Intruding on seclusion includes physically entering private space and watching, listening to or recording private activities. Misusing information includes collecting, using or disclosing it. It does not matter whether the information was true.",
      },
      {
        heading: "What 'serious' and 'reasonable expectation' weigh",
        body: "A court can consider the means and technology used, the purpose, the person's age and occupation, whether they invited publicity, the place of an intrusion, the nature of information (intimate, family, health, financial), how it was held or communicated and whether it was already public. For seriousness, it can consider the offence, distress or harm to dignity likely to be caused to a person of ordinary sensibilities, whether the defendant knew or ought to have known that, and whether malice was involved.",
      },
      {
        heading: "Defences, remedies and time limits",
        body: "Defences include conduct required or authorised by law or a court order, consent, a reasonable belief that the invasion was necessary to prevent or lessen a serious threat to life, health or safety, and proportionate, necessary and reasonable action incidental to defending persons or property. Defamation-style defences apply to publication. Remedies include damages, an injunction, an apology order, a correction order, an account of profits and destruction of material. Damages for non-economic loss and exemplary damages together are capped at the greater of AU$478,550 and the defamation cap, and aggravated damages cannot be awarded. A claim must generally be started within one year of the person becoming aware and no later than three years after the invasion, with a longer period for people who were under 18 and a court power to extend up to six years.",
      },
      {
        heading: "How this differs from the APPs",
        body: "The APPs are enforced by the regulator against organisations. The tort is a private claim by a person against a defendant, and it needs intention or recklessness. A genuine accident, such as a misdirected email, does not meet that element on the text, whereas deliberately using a customer's private information for an unrelated reason, or being indifferent to an obvious risk, can.",
      },
    ],
    example: {
      heading: "Worked example: a 7-person salon and the owner's phone",
      scenario:
        "A 7-person hair salon is well under AU$3 million turnover and does not provide a health service, so it is probably outside the APPs. The owner takes a client's phone number and a note about her recent separation from the booking system and posts a screenshot to a local Facebook group to complain about a no-show, naming her.",
      walk: [
        "Misusing information: the owner collected and disclosed information about the client for a purpose unrelated to the booking.",
        "Reasonable expectation: personal and family information held in a booking system is the kind of information the Act lists as relevant.",
        "Intentional: posting was deliberate, so the fault element is likely met.",
        "Serious: a public post naming a person and referring to a separation could cause offence or distress to a person of ordinary sensibilities.",
        "Defences: none obviously apply. Consent was not given and there was no legal authority.",
        "Practical result: a court could order the post removed, an apology and damages. Even if the owner would win, defending costs money, which is why the sensible step is the policy below.",
      ],
      takeaway:
        "For a small business, the tort is mostly a staff conduct and information discipline issue: who can see what, what may be posted or shared, and surveillance in private spaces.",
    },
    checklist: [
      "Write a one-page rule on what customer and staff information may be shared and where.",
      "Restrict booking and CRM access to people who need it.",
      "Do not install cameras or recording in private spaces such as toilets or change rooms, and tell staff and customers about any cameras you do run.",
      "Ban posting customer details on social media, including to complain.",
      "Make staff sign they have read the rule, and keep the record.",
      "Have an apology and removal process ready, because the Act lets courts consider apologies and corrections.",
      "Check your insurance for privacy claims.",
    ],
    traps: [
      "Thinking the small business exemption protects you. The OAIC says the tort is broader than the Privacy Act.",
      "Treating it as only a media issue. The Schedule covers ordinary businesses and individuals.",
      "Assuming a quiet apology is an admission. The Act says an apology is not an admission of fault or liability (clause 13).",
      "Relying on this page for a live dispute. Get legal advice.",
    ],
    faq: [
      {
        q: "When did the privacy tort start?",
        a: "10 June 2025. The OAIC page on the tort states that the changes commenced on that date.",
      },
      {
        q: "Does it apply to small businesses?",
        a: "The OAIC says the tort extends to individuals and entities that may not be APP entities, so it can reach a business that is exempt from the APPs.",
      },
      {
        q: "How long does someone have to sue?",
        a: "Generally before the earlier of one year after becoming aware of the invasion and three years after it occurred. People under 18 at the time have until their 21st birthday, and a court can extend the period to no later than six years.",
      },
    ],
    sources: [
      { label: "Privacy Act 1988, Schedule 2 (statutory tort)", url: ACT_URL, note: "Clauses 6 to 14 and the exemptions in clauses 15 to 18." },
      POLA,
      {
        label: "OAIC: statutory tort for serious invasions of privacy",
        url: "https://www.oaic.gov.au/privacy/your-privacy-rights/more-privacy-rights/statutory-tort-for-serious-invasions-of-privacy",
        note: "Published 19 June 2025; confirms the commencement date and the broader reach.",
      },
    ],
    related: ["small-business-exemption", "notifiable-data-breaches", "app-5-notification-of-collection"],
  },
];

export function getObligation(slug: string): Obligation | undefined {
  return OBLIGATIONS.find((o) => o.slug === slug);
}

export const HUB = {
  title: "Privacy Act Obligations for Small Business, Explained",
  description:
    "Six Privacy Act obligations explained in plain English for 5 to 20 person businesses, each checked against the Act and OAIC guidance, with dates and checklists.",
  h1: "Privacy Act obligations for a small Australian business",
};
