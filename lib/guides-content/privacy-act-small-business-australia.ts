import type { Guide } from "@/lib/guides";

export const privacyAct: Guide = {
  slug: "privacy-act-small-business-australia",
  seoTitle: "Privacy Act for Small Business: 2026 Guide",
  h1: "The Privacy Act and Your Small Business: What Applies in 2026",
  description:
    "Does the Privacy Act apply to your small business? Who is exempt, the 10 December 2026 automated decision rule, breach notification and a policy checklist.",
  cluster: "Privacy Act",
  targetTerms: ["privacy act small business australia", "privacy policy australia small business", "privacy act 10 december 2026", "do sole traders need a privacy policy"],
  date: "2026-11-28",
  updated: "2026-11-28",
  intro: [
    {
      t: "p",
      x: "Most Australian small businesses have heard that the Privacy Act \"doesn't apply to us because we turn over less than 3 million dollars\". That sentence is true for many of them and wrong for a surprising number. It also ignores two things that do not depend on size: the notifiable data breach rules for some businesses, and the practical expectations of customers, insurers and larger clients.",
    },
    {
      t: "p",
      x: "This guide explains in plain language who the Privacy Act covers, what the 13 Australian Privacy Principles ask of you, what changes on **10 December 2026**, what a data breach obligation looks like, what a privacy policy needs to say and what a small business can do this week. It is general information, not legal advice. Where the law is uncertain or still being reformed, we say so.",
    },
    {
      t: "note",
      title: "Status check, 28 November 2026",
      x: "The automated decision transparency rules in the Privacy and Other Legislation Amendment Act 2024 commence on 10 December 2026. A full removal of the small business exemption has been discussed in reform proposals but, as far as we can establish from the OAIC and the Attorney-General's Department, is not law. Check the [OAIC](https://www.oaic.gov.au/privacy) before you rely on this page, because the position can move.",
    },
  ],
  sections: [
    {
      id: "does-it-apply",
      h2: "Does the Privacy Act apply to your business?",
      blocks: [
        { t: "p", x: "The Privacy Act 1988 binds \"APP entities\": Commonwealth agencies and organisations that are not small businesses, plus some small businesses that fall into special categories. A **small business operator** is a business with annual turnover of 3 million dollars or less, and small business operators are generally not APP entities. That is the small business exemption." },
        { t: "p", x: "The exemption has exceptions. A small business is covered by the Privacy Act regardless of turnover if it:" },
        {
          t: "ul",
          x: [
            "provides a **health service** and holds health information, which includes some businesses that do not think of themselves as health providers, such as gyms, counsellors, naturopaths and some child care or weight-loss services;",
            "**trades in personal information**, by buying or selling it or its disclosure for a benefit, such as selling customer lists;",
            "is a **contracted service provider** under a Commonwealth contract;",
            "is related to a larger business that is covered, in some circumstances;",
            "is a **reporting entity** under anti-money laundering rules, which is the group being widened by the 2026 reforms, including many accountants, lawyers and real estate agents;",
            "is a credit reporting body, or holds **tax file numbers** in a way that triggers the TFN rules;",
            "has chosen to opt in to the Act.",
          ],
        },
        { t: "p", x: "The [OAIC's guidance on the small business exemption](https://www.oaic.gov.au/privacy/your-privacy-rights/more-privacy-rights-topics/small-business) lists the categories in full and has a self-assessment. Use it, and write down your conclusion and the date. If a customer, insurer or tender evaluator asks why you believe you are exempt, a dated note is a good answer." },
        {
          t: "table",
          caption: "Quick check by type of business (general guide only)",
          head: ["Business", "Usually covered?", "Why"],
          rows: [
            ["Sole trader electrician under 3 million turnover", "Usually no", "Small business operator with no special category, but check TFN handling and any government contracts."],
            ["Physio, counsellor or naturopath", "Yes", "Health service provider holding health information."],
            ["Small accounting or bookkeeping practice", "Often yes from 1 July 2026", "Expected to become a reporting entity under the AML/CTF reforms, which removes the exemption. Confirm with your adviser."],
            ["Online shop with its own customer list, turnover under 3 million", "Usually no", "Unless it trades in the list. Selling or renting customer data would change that."],
            ["Business with a Commonwealth contract", "Yes for that work", "Contracted service providers are bound by the Act for the contract."],
            ["Business turning over more than 3 million", "Yes", "Not a small business operator."],
          ],
        },
        { t: "p", x: "Our post on [whether sole traders need a privacy policy](/blog/sole-trader-privacy-policy-threshold) walks through the same categories for the smallest operators." },
      ],
    },
    {
      id: "even-if-exempt",
      h2: "Why many exempt businesses behave as if covered",
      blocks: [
        { t: "p", x: "Being legally exempt does not mean being free from questions. Four things drive small businesses to follow the principles anyway." },
        {
          t: "ol",
          x: [
            "**Customers and clients ask.** Supplier questionnaires from councils, builders, franchisors and large corporates increasingly include privacy and security sections. \"We are exempt\" is a poor answer if a competitor can show a policy and a breach plan.",
            "**Insurers ask.** Cyber and professional indemnity applications ask how you protect personal information.",
            "**The exemption can change.** The government has agreed in principle to reconsider it, and categories have already widened. Building the habits now is cheaper than doing it in a hurry.",
            "**A new civil claim exists.** Since 10 June 2025 a statutory tort for serious invasions of privacy allows individuals to sue. The tort is not limited to APP entities, so careless handling of private information carries real risk even for a small operator. Check the current detail and exceptions with your lawyer.",
          ],
        },
      ],
    },
    {
      id: "thirteen-principles",
      h2: "The 13 Australian Privacy Principles, in plain language",
      blocks: [
        { t: "p", x: "If you are an APP entity, or choose to behave like one, the principles are your checklist. Here they are, translated for a small business." },
        {
          t: "table",
          caption: "APP 1 to 13",
          head: ["Principle", "In plain language", "A small business example"],
          rows: [
            ["APP 1 Open and transparent management", "Have a policy that says how you handle personal information, and keep it current.", "A privacy page on your website that matches what you actually do."],
            ["APP 2 Anonymity and pseudonymity", "Let people deal with you anonymously where practical.", "A general enquiry form that does not demand a full name."],
            ["APP 3 Collection of solicited information", "Collect only what you reasonably need, by fair means.", "Do not ask for date of birth on a quote request."],
            ["APP 4 Unsolicited information", "Decide what to do with information you did not ask for.", "A customer emails a medical document by mistake: delete or return it."],
            ["APP 5 Notification", "Tell people what you collect and why when you collect it.", "A line on the quote form linking to your policy."],
            ["APP 6 Use and disclosure", "Use information for the reason you collected it.", "Do not add quote requesters to a marketing list without consent."],
            ["APP 7 Direct marketing", "Rules for marketing to individuals, alongside the Spam Act.", "Opt-out in every marketing message."],
            ["APP 8 Cross-border disclosure", "Take reasonable steps before sending information overseas.", "Check where your cloud tools and AI tools store data."],
            ["APP 9 Government identifiers", "Do not use identifiers such as Medicare numbers as your own customer ID.", "Use your own customer number."],
            ["APP 10 Quality", "Keep information accurate and up to date.", "Fix wrong phone numbers when you find them."],
            ["APP 11 Security", "Take reasonable steps to protect information, and destroy it when no longer needed.", "Multi-factor authentication, backups, deleting old files."],
            ["APP 12 Access", "Give people access to what you hold about them on request.", "Know where each customer's record sits."],
            ["APP 13 Correction", "Correct information on request.", "A process for updating details across systems."],
          ],
        },
        { t: "p", x: "The [OAIC's APP pages](https://www.oaic.gov.au/privacy/australian-privacy-principles) give the full text and guidelines. Our advice matches the regulator's emphasis: concentrate on APP 1, 5, 6, 8 and 11 first, because those are where small businesses most often have a gap." },
      ],
    },
    {
      id: "10-december-2026",
      h2: "What changes on 10 December 2026",
      blocks: [
        { t: "p", x: "The Privacy and Other Legislation Amendment Act 2024 made the first set of changes from the government's long-running privacy reform. One of them has a start date of **10 December 2026**: new transparency rules for **automated decision-making** inside APP 1." },
        { t: "p", x: "In summary, an APP entity that uses a computer program to make a decision, or to do something substantially and directly related to making a decision, that could significantly affect an individual's rights or interests, and where the program uses personal information, must say so in its privacy policy. The policy has to describe the kinds of personal information used and the kinds of decisions made solely by the program or where the program does something substantially and directly related to making the decision." },
        { t: "p", x: "Put plainly, if you are covered by the Act and you use software to decide who gets a loan, a quote, an approval, a booking, a job interview, a discount or a service, your privacy policy needs a short, honest paragraph describing it. Merely using a calendar tool or a mail-merge is not what the rule is aimed at." },
        { t: "h3", x: "Examples that could be caught" },
        {
          t: "ul",
          x: [
            "A tool that scores enquiries and automatically refuses some customers.",
            "An AI phone assistant that decides who receives a callback and who does not.",
            "Software that sets a customer's price or credit limit with little human review.",
            "Automated screening of job applications.",
          ],
        },
        { t: "h3", x: "Examples unlikely to be caught" },
        {
          t: "ul",
          x: [
            "Reminder texts triggered by a booking date.",
            "An AI tool that drafts a reply that you read and change before sending.",
            "A scheduling tool that offers free slots but does not decide who gets work.",
          ],
        },
        { t: "p", x: "The OAIC is publishing guidance as the date approaches. If you are covered and use automated tools in this way, update your policy before 10 December. If you are not covered, the rule does not bind you, though it is a good model for being honest with customers about how your software treats them." },
        {
          t: "note",
          title: "Where to get wording",
          x: "Our [privacy wording guide for automated decisions](/products/privacy-adm-wording-guide) explains what counts and gives sample sentences. For an accounting, legal, health or NDIS practice, the [Privacy ADM Fix](/offers/privacy-adm-fix) reads your live policy and shows the wording it is missing. These are starting points, not legal advice: confirm with your adviser.",
        },
      ],
    },
    {
      id: "data-breach",
      h2: "Data breaches and the 30-day rule",
      blocks: [
        { t: "p", x: "The Notifiable Data Breaches scheme requires APP entities to notify the OAIC and affected people when an **eligible data breach** occurs: unauthorised access to, or disclosure or loss of, personal information that is likely to result in serious harm. It is not limited to hacking. An email with a client list sent to the wrong person can qualify." },
        { t: "p", x: "If you suspect a breach, you must carry out a reasonable and expeditious assessment, and the law says to complete it within 30 days. If you decide it is an eligible breach, you must notify as soon as practicable. You can often reduce the likelihood of serious harm through quick remedial action, which can change the outcome of the assessment." },
        { t: "ol", x: ["**Contain.** Stop the spread: recall the email, reset the passwords, remove access.", "**Assess.** Write down what was involved, who could be harmed and how, and what you did.", "**Notify** if serious harm is likely: the OAIC through its online form, and the affected individuals.", "**Review.** Fix the cause, not only the incident."] },
        { t: "p", x: "Our post on [the 30-day rule small businesses miss](/blog/notifiable-data-breach-scheme-small-business) has examples, and the [breach response runbook](/products/breach-response-runbook) gives a one-page plan you can print and keep. Having it before an incident is the whole point: the assessment clock runs while you decide what to do." },
        { t: "p", x: "Penalties for serious or repeated interferences with privacy can be very large for companies, and the 2024 amendments added a tier of lower penalties and infringement notices for less serious breaches. The practical risk for a small business is usually less the fine than the loss of trust and the time lost during an incident." },
      ],
    },
    {
      id: "privacy-policy",
      h2: "What a privacy policy needs to say",
      blocks: [
        { t: "p", x: "A privacy policy is not a legal charm. It is a readable account of what you actually do. A good one for a small business is one to two pages and covers these points." },
        {
          t: "ol",
          x: [
            "**Who you are** and how to contact you about privacy.",
            "**What you collect:** names, phone numbers, addresses, emails, job photos, payment details, call recordings, website data.",
            "**Why you collect it:** to quote, do the job, invoice, comply with the law, and contact people about their job.",
            "**How you collect it:** forms, phone calls, emails, job software, your website.",
            "**Who you share it with:** your accountant, job software provider, payment processor, subcontractors, and where relevant overseas providers, by country if you know it.",
            "**Automated decisions and AI tools:** short, honest description if you use them in the way described above.",
            "**How you keep it safe** and how long you keep it.",
            "**How people can ask for access or correction,** and how to complain.",
          ],
        },
        { t: "p", x: "The mistakes we see most are copying another business's policy without checking it matches what you do, listing tools you no longer use, and omitting your AI and cloud providers. A policy that says \"we never share your information\" while your job software, email host and accountant all hold it is worse than none." },
        { t: "p", x: "Our [privacy policy template pack](/products/privacy-policy-template-pack) gives a fill-in-the-blanks version and a collection notice. For anything unusual, such as health information or overseas customers, have a lawyer review it." },
      ],
    },
    {
      id: "ai-tools-and-vendors",
      h2: "Using AI tools and suppliers",
      blocks: [
        { t: "p", x: "Every cloud tool is a supplier that may hold your customers' information. The OAIC's guidance on commercially available AI products says, in short: do not enter personal information into public AI tools without checking where it goes and how it is used, and be able to explain your use to the people affected." },
        { t: "p", x: "Practical rules we follow and recommend:" },
        {
          t: "ul",
          x: [
            "Use business accounts with settings that stop your content being used to train public models, rather than free consumer accounts.",
            "Keep customer details out of prompts where you can. A first name and a job type are often enough.",
            "List your AI and cloud providers in your policy.",
            "Ask vendors where data is stored, whether it is used for training and how you can delete it. See our [AI receptionist guide](/guides/ai-receptionist-australia-trades) for a ten-question list.",
            "Keep a human reviewing anything that affects a person's access to a service.",
          ],
        },
      ],
    },
    {
      id: "security-basics",
      h2: "Security basics that satisfy \"reasonable steps\"",
      blocks: [
        { t: "p", x: "APP 11 asks for reasonable steps, not perfection. What is reasonable depends on the sensitivity of the information and the size and resources of the business, and the regulator publishes guidance on the topic. For a small business, a sensible baseline is:" },
        {
          t: "ul",
          x: [
            "Multi-factor authentication on email, accounting and job software.",
            "Automatic updates on phones and computers.",
            "Backups that you have tested by restoring something.",
            "Separate logins for each staff member, with the minimum access they need.",
            "Email domain protection so no one can send fake messages as you. See the [email security guide](/guides/email-security-small-business-australia).",
            "The ACSC's [Essential Eight](/guides/essential-eight-small-business) as the next level of detail.",
            "Deleting personal information you no longer need.",
          ],
        },
        { t: "p", x: "Our free [security scan](/scan) checks the public side of this, such as your email domain's records, without needing a login or touching your systems." },
      ],
    },
    {
      id: "this-week",
      h2: "A practical list for this week",
      blocks: [
        {
          t: "ol",
          x: [
            "Decide whether you are covered. Use the OAIC's small business tests and write the answer and the date.",
            "List every place customer information lives: job software, email, phone, spreadsheets, accounting, cloud storage, AI tools.",
            "Read your privacy policy. Does it match that list? Fix it.",
            "If you are covered and use software to make decisions about people, add the automated decision paragraph before 10 December.",
            "Turn on multi-factor authentication for email and accounting.",
            "Write a one-page breach plan: who to ring, who decides, who notifies.",
            "Ask your top three suppliers where they store your data and put the answers in a folder.",
          ],
        },
        { t: "p", x: "A few days of focused work covers most of this for a small business. If you would rather have it done for you, the [compliance pack](/compliance) covers the policy, breach plan, email protection, logins, data map and AI disclosure in one working session." },
      ],
    },
    {
      id: "what-we-do-not-know",
      h2: "What is uncertain",
      blocks: [
        { t: "p", x: "Reform of the Privacy Act is continuing. The government has accepted in principle that the small business exemption should be reconsidered, but no date or final form has been legislated that we can point to. Treat any headline that says it has \"already gone\" with scepticism and check the OAIC." },
        { t: "p", x: "Detailed rules also depend on regulations, codes and guidance still being developed, including OAIC guidance on the automated decision rule. This page will be updated when they are published, and the \"last reviewed\" date at the top changes only when we make a real edit." },
      ],
    },
  ],
  faq: [
    {
      q: "Does the Privacy Act apply to small businesses in Australia?",
      a: "Many small businesses with annual turnover of 3 million dollars or less are exempt, but not all. Health service providers, businesses that trade in personal information, Commonwealth contractors and some others are covered regardless of size. Use the OAIC's small business tests and record your conclusion.",
    },
    {
      q: "Do sole traders need a privacy policy?",
      a: "Not always legally, but it is good practice and increasingly expected by customers, insurers and larger clients. A one-page, accurate policy takes an afternoon. See [Do sole traders need a privacy policy in Australia?](/blog/sole-trader-privacy-policy-threshold).",
    },
    {
      q: "What happens on 10 December 2026?",
      a: "New transparency rules about automated decision-making commence for organisations covered by the Privacy Act. If you use software to make or substantially help make decisions that significantly affect people, your privacy policy must describe it. Check the OAIC's guidance for the detail.",
    },
    {
      q: "What counts as an eligible data breach?",
      a: "Unauthorised access to, or disclosure or loss of, personal information that is likely to result in serious harm to an individual. It includes accidental disclosures, such as emailing the wrong person, as well as hacking and lost devices. Covered businesses must assess suspected breaches within 30 days and notify if the threshold is met.",
    },
    {
      q: "How much can a Privacy Act penalty be?",
      a: "For serious or repeated interferences with privacy, penalties for companies can reach tens of millions of dollars or a share of turnover, and the 2024 amendments added lower tiers and infringement notices. Small businesses rarely face the top end, but see the Act and OAIC pages for current figures.",
    },
    {
      q: "Is using ChatGPT or another AI tool with customer details a privacy breach?",
      a: "Not automatically, but it is a disclosure to a supplier that you must be able to justify. Use business accounts with training turned off where available, keep personal details out of prompts where you can, and list the tool in your policy. The OAIC has specific guidance on this.",
    },
  ],
  sources: [
    { label: "OAIC: Privacy", url: "https://www.oaic.gov.au/privacy", note: "The regulator's main privacy pages, including reform updates and guidance" },
    { label: "OAIC: Australian Privacy Principles", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles", note: "Full text and summaries of APP 1 to 13" },
    { label: "OAIC: small business", url: "https://www.oaic.gov.au/privacy/your-privacy-rights/more-privacy-rights-topics/small-business", note: "The small business exemption and the categories it does not cover" },
    { label: "OAIC: Notifiable Data Breaches", url: "https://www.oaic.gov.au/privacy/notifiable-data-breaches", note: "What an eligible data breach is, assessment and notification steps, the online form" },
    { label: "Privacy Act 1988 (Federal Register of Legislation)", url: "https://www.legislation.gov.au/C2004A03712/latest/text", note: "The Act as amended, including APP 1 and the automated decision provisions once in force" },
    { label: "OAIC: guidance on privacy and the use of commercially available AI products", url: "https://www.oaic.gov.au/ai", note: "Vendor due diligence and transparency when using AI tools" },
    { label: "Attorney-General's Department: Privacy Act review", url: "https://www.ag.gov.au/rights-and-protections/privacy", note: "Reform background and government responses" },
  ],
  related: {
    posts: ["privacy-act-small-business-deadline", "sole-trader-privacy-policy-threshold", "notifiable-data-breach-scheme-small-business", "ai-receptionist-compliance"],
    tools: [
      { label: "Compliance pack", href: "/compliance", blurb: "Policy, breach plan, email, logins, data map and AI disclosure in one working call." },
      { label: "Free security scan", href: "/scan", blurb: "Checks the public side of your email security. No login, nothing touched." },
      { label: "Privacy ADM Fix", href: "/offers/privacy-adm-fix", blurb: "For accounting, legal, health and care practices: reads your live policy for the automated decision wording." },
      { label: "Compliance Monitor", href: "/monitor", blurb: "Ongoing checks after the first fix." },
    ],
    products: [
      { label: "Privacy Policy Template Pack", href: "/products/privacy-policy-template-pack", blurb: "Policy and collection notice templates in everyday words." },
      { label: "Privacy Wording for Automated Decisions", href: "/products/privacy-adm-wording-guide", blurb: "What counts, sample sentences and vendor questions." },
      { label: "Breach Response Runbook", href: "/products/breach-response-runbook", blurb: "A one-page plan for the 30-day assessment." },
      { label: "Five-Jurisdiction Privacy Bundle", href: "/products/five-jurisdiction-privacy-bundle", blurb: "For businesses with customers in more than one country." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "See the compliance pack",
    href: "/compliance",
    text: "If you would rather have the policy, breach plan and AI disclosure sorted in one working call, the fixed-price compliance pack covers exactly the list above. If you only need an answer to \"does this apply to me\", the free audit will give you one.",
  },
};
