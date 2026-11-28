import type { Guide } from "@/lib/guides";

export const tenders: Guide = {
  slug: "government-tenders-small-business-australia",
  seoTitle: "Government Tenders for Small Business in Australia",
  h1: "Government Tenders for Small Business in Australia: Where to Start",
  description:
    "How a small Australian business finds and wins government work: AusTender, state portals, panels, a bid/no-bid scorecard and subcontracting as an easy way in.",
  cluster: "Government tenders",
  targetTerms: ["government tenders small business australia", "how to find government tenders australia", "austender for small business", "capability statement small business tender"],
  date: "2026-11-28",
  updated: "2026-11-28",
  answer:
    "Small businesses can win government work by learning a repeatable routine: find open approaches to market on AusTender and the state portals, get your documents ready before you bid, and judge each tender's worth before you start. Awarded contract notices are intelligence, not opportunities you can bid on.",
  intro: [
    {
      t: "p",
      x: "Governments in Australia buy an enormous range of goods and services, from cleaning, trades and landscaping to IT support, training and consulting, and a good share of it is open to small businesses. The process looks forbidding from outside: unfamiliar portals, long documents, scoring criteria and compliance forms. In practice it is a learnable routine, and small firms win work every week by being ready, selective and clear.",
    },
    {
      t: "p",
      x: "This guide covers where tenders are published, how Commonwealth, state and local buying works at a high level, what to have ready before you bid, how to decide whether a tender is worth your time, how to read the documents, how panels and subcontracting offer an easier way in, and the mistakes that sink first bids. It is general information based on public sources, with links to each, and it makes no promise that you will win anything.",
    },
    {
      t: "note",
      title: "Awards are intelligence, not opportunities",
      x: "AusTender publishes both open approaches to market, which you can bid on, and **awarded contract notices**, which you cannot. Awarded notices are still valuable: they show who buys what, at what value and who the incumbent is. Do not confuse the two lists.",
    },
  ],
  sections: [
    {
      id: "where-tenders-are",
      h2: "Where tenders are published",
      blocks: [
        { t: "p", x: "There is no single national list. Each level of government has its own portal, and some buyers use private procurement platforms. A small business should know the ones that match where it works." },
        {
          t: "table",
          caption: "Main places to look",
          head: ["Buyer", "Where", "Notes"],
          rows: [
            ["Commonwealth departments and agencies", "[AusTender](https://www.tenders.gov.au)", "The central Australian Government procurement site. Lists approaches to market, contract notices and standing offers (panels)."],
            ["Commonwealth digital and ICT", "[BuyICT](https://www.buyict.gov.au)", "Digital Transformation Agency marketplace for ICT services and panels. Sellers apply to be listed."],
            ["Queensland", "[QTenders](https://qtenders.epw.qld.gov.au)", "State government e-tendering for Queensland agencies."],
            ["New South Wales", "[NSW eTendering](https://buy.nsw.gov.au)", "Whole-of-government portal for NSW tenders and contracts."],
            ["Victoria", "[Tenders VIC](https://www.tenders.vic.gov.au)", "Victorian government tenders."],
            ["Western Australia", "[Tenders WA](https://www.tenders.wa.gov.au)", "WA state government tenders."],
            ["South Australia", "[SA Tenders and Contracts](https://www.tenders.sa.gov.au)", "SA government opportunities."],
            ["Tasmania", "[Tasmanian Government Tenders](https://www.tenders.tas.gov.au)", "Tasmanian tenders and contracts."],
            ["Northern Territory", "[NT Government tenders](https://tendersonline.nt.gov.au)", "NT notices and quotations."],
            ["Councils and local government", "Council websites, VendorPanel, Tenderlink and similar", "Procedures vary by council. Many publish a panel of preferred suppliers."],
            ["Universities, health and large public bodies", "Their own procurement pages", "Often follow state rules and publish on state portals."],
          ],
        },
        { t: "p", x: "Check each portal's own pages for how to register and how to receive notifications, because processes change. Most let you save a search by category and location and get an email when something matches, which is the cheapest way to build a pipeline." },
        { t: "p", x: "Our free [tender digest](/offers/free-tender-digest) is a weekly email of the ten newest government tenders in your category and state, and the [offers page](/offers) lists the other tender tools we have built." },
      ],
    },
    {
      id: "how-it-works",
      h2: "How Commonwealth buying works, in outline",
      blocks: [
        { t: "p", x: "Commonwealth entities follow the **Commonwealth Procurement Rules** (CPRs), issued by the Department of Finance. The core principle is **value for money**, not lowest price. Non-corporate Commonwealth entities have additional obligations above set thresholds, including a requirement to approach the market openly for many procurements. The threshold at the time of writing is 80,000 dollars for most goods and services and more for construction, but the current figures are in the CPRs, so check there." },
        { t: "p", x: "The common approaches to market you will see:" },
        {
          t: "ul",
          x: [
            "**Open tender.** Published for anyone to respond.",
            "**Limited tender.** The buyer invites selected suppliers, or uses a panel, in the circumstances the rules allow.",
            "**Panel or standing offer.** A list of pre-approved suppliers. Once on it, you compete for work among panel members. Joining often happens in a defined window every few years.",
            "**Request for quote.** For smaller procurements, a simpler process with fewer documents.",
          ],
        },
        { t: "p", x: "Commonwealth contracts valued at 10,000 dollars or more are reported on AusTender through contract notices. That gives the public view you can use for research, such as who won, the value and the period." },
        { t: "p", x: "The Commonwealth also has policies to help small and medium businesses, including measures to pay eligible small business invoices quickly. The [Department of Finance's procurement pages](https://www.finance.gov.au/government/procurement) are the source for the current policies and thresholds. States and local governments have their own thresholds and rules, which differ in detail, and you must read the document in front of you." },
      ],
    },
    {
      id: "readiness",
      h2: "What to have ready before you bid",
      blocks: [
        { t: "p", x: "Most first-bid failures are not about price or quality. They are about missing paperwork found at the last minute. Build a **bid library** once and reuse it." },
        {
          t: "ol",
          x: [
            "**ABN and GST registration** details, and your entity type. Verify your listing at [ABN Lookup](https://abr.business.gov.au).",
            "**Insurance certificates:** public liability, professional indemnity where relevant, and workers compensation. Buyers set minimum cover, so know your limits.",
            "**Licences and qualifications** for your trade or field, and for staff who will do the work.",
            "**A capability statement:** one or two pages describing what you do, who you have done it for, your key people, your certifications and contact details.",
            "**Referees and past work:** three or more clients who will take a call, with short, specific descriptions. Use real ones only.",
            "**Policies:** work health and safety, quality, privacy, and incident reporting, at a size that suits your business.",
            "**Financial information:** some tenders ask for financial viability evidence. Have your accountant ready.",
            "**Security evidence:** a short statement of your cyber practices. For the [Essential Eight](/guides/essential-eight-small-business), know your approximate maturity and have evidence of MFA, backups and updates.",
            "**Business continuity and key people cover** in a paragraph.",
            "**Standard answers** to the questions that recur: methodology, risk, quality assurance, supply chain, safety.",
          ],
        },
        { t: "p", x: "A **capability statement** is the one document that does the most work. Keep it factual, include numbers you can prove, and add a line on how you meet each category buyers ask about. Do not copy a template from another business unchanged." },
        { t: "p", x: "Our [Trade Panel Pack](/offers/trade-panel-pack) turns panel paperwork into a submission-ready pack for businesses that have never had a panel listing, and the [Supplier Cyber Readiness Pass](/offers/supplier-cyber-readiness-pass) produces a tender-ready security answers sheet. Each is a starting point you review before submitting." },
      ],
    },
    {
      id: "bid-or-no-bid",
      h2: "Should you bid at all? A scoring method",
      blocks: [
        { t: "p", x: "Bidding costs time. A serious response can take several days, and a no-bid decision made quickly is a good decision. Score each tender from 0 to 2 on these questions." },
        {
          t: "table",
          caption: "Bid or no-bid scorecard",
          head: ["Question", "0", "1", "2"],
          rows: [
            ["Can we meet every mandatory requirement today?", "No", "With effort", "Yes"],
            ["Have we done very similar work, with a referee?", "No", "Somewhat", "Yes"],
            ["Do we know the buyer or have a relationship?", "No", "Slightly", "Yes"],
            ["Is the contract size right for our capacity?", "Too large or too small", "Stretch", "Comfortable"],
            ["Is the timeline and location workable?", "No", "Tight", "Yes"],
            ["Is price the only criterion, or does quality count?", "Price only", "Mixed", "Quality weighted"],
            ["Can we make acceptable margin at the likely price?", "No", "Thin", "Yes"],
            ["Is the incumbent obviously entrenched?", "Yes", "Maybe", "No or none"],
          ],
        },
        { t: "p", x: "Add the scores. Fourteen or more: bid. Ten to thirteen: bid only if you can reuse most of your library. Under ten: skip. The point of the method is to protect your time, because winning one in three well-chosen bids beats losing nine in ten scattergun ones." },
        {
          t: "note",
          title: "A no is information too",
          x: "Record why you did not bid. After ten tenders you will see which categories and buyers suit you, and you will bid better.",
        },
      ],
    },
    {
      id: "reading-the-documents",
      h2: "Reading a tender without getting lost",
      blocks: [
        { t: "p", x: "Tender documents vary, but most have the same parts. Read them in this order." },
        {
          t: "ol",
          x: [
            "**The summary or request:** what the buyer wants, the contract period, the value if given, and the closing date and time. Check the time zone.",
            "**Conditions of tender:** how to submit, whether late bids are rejected, questions deadlines and the contact person.",
            "**Mandatory requirements:** pass or fail items. Missing one usually means your bid is not assessed.",
            "**Evaluation criteria and weightings:** where your points come from. If price is 30 per cent and capability 70 per cent, spend your effort accordingly.",
            "**Draft contract:** insurance, liability, intellectual property, payment terms, termination. Flag anything you cannot accept.",
            "**Response schedules:** the forms and pricing templates you must complete.",
          ],
        },
        { t: "p", x: "Use the **questions period**. Buyers answer questions in writing and share the answers with all bidders. A good question clarifies scope or the evaluation without giving away your plan. Do not ask something the document already answers." },
        { t: "p", x: "Write every response to the criterion, not about yourself. If the criterion is \"demonstrated experience in similar projects\", the answer is two or three specific projects with scope, value, outcome and a referee, not a company history." },
      ],
    },
    {
      id: "writing-the-bid",
      h2: "Writing a bid that scores",
      blocks: [
        {
          t: "ul",
          x: [
            "**Answer every question,** in the order asked, using the buyer's headings.",
            "**Be specific.** \"We completed 14 school sites in 2025 on time and under budget\" scores better than \"we have extensive experience\", provided it is true and you can name a referee.",
            "**Show how, not just that.** Evaluators want method, people, timelines and risk handling.",
            "**Price clearly.** Complete the schedule exactly. Hidden assumptions and unexplained gaps cost points. Check the arithmetic.",
            "**Stay inside the limits.** If the word limit is 500, write 500.",
            "**Proof and edit.** Have someone who did not write it read it cold.",
            "**Submit early.** Portals fail near deadlines. Aim to be done a day before.",
            "**Do not misstate.** Overstating experience or capacity can disqualify you or cause trouble during the contract.",
          ],
        },
        { t: "p", x: "AI tools can help with structure, checking against criteria and tightening wording, but you must supply the facts and check every line. A bid written by a tool that has not been given your real projects and numbers reads generic and scores badly. Many tenders also ask whether AI was used. If so, answer truthfully." },
        { t: "p", x: "For a single named tender where you have no bid writer, the [Bid Pack](/offers/bid-pack) is our submission-ready pack for one tender. You still review and submit it." },
      ],
    },
    {
      id: "panels-and-subcontracting",
      h2: "Panels and subcontracting: the easier door",
      blocks: [
        { t: "p", x: "A first prime contract is the hardest path. Two others are friendlier." },
        { t: "h3", x: "Panels" },
        { t: "p", x: "A panel is a list of approved suppliers. Getting on one involves a larger application, but afterwards you can be invited to quote for jobs without a full open tender each time. Panels often reopen periodically, so keep an eye on the dates. Councils, state departments and large companies all use them. Ask each buyer how and when they refresh theirs." },
        { t: "h3", x: "Subcontracting" },
        { t: "p", x: "Large contractors win government work and then need local trades and services to deliver it. Awarded contract notices on AusTender and state portals show who won, what, and where. A short, specific note to the winner offering a capability they need, such as a licensed trade in the region, is a legitimate way to get work and build a track record. Our [Job Flow Lite: Subbie Finder](/offers/subbie-finder-lite) delivers weekly summaries of who won government work near you, so you can offer to help." },
        { t: "p", x: "Subcontracting gives you referees and past-performance examples, which is exactly what a first prime tender asks for." },
      ],
    },
    {
      id: "cyber-and-privacy",
      h2: "Security and privacy questions you will meet",
      blocks: [
        { t: "p", x: "Many tenders now include a security schedule. Common asks are multi-factor authentication, patching, backups, data location, incident reporting and privacy compliance. The ACSC's Essential Eight is the usual reference. Work-from-home staff, subcontractors and cloud tools are all in scope for these questions." },
        { t: "p", x: "If your work touches personal information on the buyer's behalf, you may be treated as a contracted service provider, and the Privacy Act can apply to that work even if you are otherwise exempt. See the [Privacy Act guide](/guides/privacy-act-small-business-australia). Answer honestly, and state what you can evidence today and what you will do by when." },
        { t: "p", x: "Email security is a cheap quick win: a business that cannot show a DMARC policy looks careless on a security questionnaire. See [email security for small business](/guides/email-security-small-business-australia)." },
      ],
    },
    {
      id: "mistakes",
      h2: "Common first-bid mistakes",
      blocks: [
        {
          t: "ul",
          x: [
            "Bidding on everything and winning nothing.",
            "Missing a mandatory item, such as an insurance certificate or a signed form.",
            "Answering the question you wish had been asked.",
            "Pricing below cost to \"get a foot in the door\" and then losing money for years.",
            "Copying a competitor's language or a template from the internet without matching it to your business.",
            "Leaving the submission to the last hour.",
            "Not asking for feedback after a loss. Most buyers will give a debrief if you ask politely, and it is the cheapest training you can get.",
          ],
        },
      ],
    },
    {
      id: "first-ninety-days",
      h2: "A first 90 days",
      blocks: [
        {
          t: "ol",
          x: [
            "**Weeks 1 to 2:** write your capability statement, gather insurances, licences and three referees into one folder.",
            "**Weeks 3 to 4:** set saved searches and alerts on AusTender and your state portal. Read ten awarded notices in your category to learn who buys and at what size.",
            "**Weeks 5 to 8:** read five live tenders end to end without bidding. Score them with the scorecard above.",
            "**Weeks 9 to 12:** submit one bid, or one panel application, that scores fourteen or more. Ask for feedback whatever the result.",
          ],
        },
        { t: "p", x: "Expect the first win to take longer than three months. Public buyers move on their own calendars, and a no-bid month spent building your library is not wasted." },
      ],
    },
  ],
  faq: [
    {
      q: "Where do I find government tenders in Australia?",
      a: "The Commonwealth publishes on AusTender. Each state and territory has its own portal, such as QTenders in Queensland and NSW eTendering. Councils publish on their own sites or procurement platforms. Set saved searches and email alerts on the portals that match where you work.",
    },
    {
      q: "Can a small business win government contracts?",
      a: "Yes. Governments buy a very wide range of services, many contracts are modest in size, and policies encourage buying from small and medium businesses. Small firms win by being ready, choosing tenders carefully and reusing a strong bid library. There is no guarantee for any single bid.",
    },
    {
      q: "Do I need to register to see tenders on AusTender?",
      a: "You can view published approaches to market without paying. Creating a free account lets you save searches and receive notifications. Always follow the instructions in each tender for how to respond, as submission methods vary.",
    },
    {
      q: "What is a capability statement?",
      a: "A one or two page summary of what your business does, who it has done it for, its key people, qualifications and certifications and how to contact you. Buyers use it to judge whether to invite or shortlist you, so keep it factual and specific.",
    },
    {
      q: "What is the difference between a tender and a panel?",
      a: "A tender is a competition for a specific job or contract. A panel is a list of pre-approved suppliers a buyer can choose from over several years. Joining a panel takes an application, after which you can be invited to quote for individual jobs.",
    },
    {
      q: "Do I need to meet the Essential Eight to win a government tender?",
      a: "Not always, but many tenders include a security schedule and ask about it. Know your approximate maturity level and have evidence of MFA, patching and backups. See the [Essential Eight guide](/guides/essential-eight-small-business).",
    },
    {
      q: "Can I subcontract instead of bidding directly?",
      a: "Yes, and it is often the easiest way in. Winners of larger contracts need local suppliers. Awarded notices show who won, so you can offer a specific capability. It also builds referees for later bids.",
    },
  ],
  sources: [
    { label: "AusTender", url: "https://www.tenders.gov.au", note: "Australian Government approaches to market, contract notices and standing offers" },
    { label: "Department of Finance: Commonwealth Procurement Rules and policies", url: "https://www.finance.gov.au/government/procurement", note: "Rules, thresholds and small business policies" },
    { label: "BuyICT", url: "https://www.buyict.gov.au", note: "Digital Transformation Agency marketplace for ICT services" },
    { label: "QTenders (Queensland)", url: "https://qtenders.epw.qld.gov.au", note: "Queensland Government tenders" },
    { label: "NSW eTendering", url: "https://buy.nsw.gov.au", note: "New South Wales Government tenders" },
    { label: "Tenders VIC", url: "https://www.tenders.vic.gov.au", note: "Victorian Government tenders" },
    { label: "Tenders WA", url: "https://www.tenders.wa.gov.au", note: "Western Australian Government tenders" },
    { label: "SA Tenders and Contracts", url: "https://www.tenders.sa.gov.au", note: "South Australian Government tenders" },
    { label: "Tasmanian Government Tenders", url: "https://www.tenders.tas.gov.au", note: "Tasmanian Government tenders" },
    { label: "ABN Lookup", url: "https://abr.business.gov.au", note: "Verify business registration details" },
    { label: "ACSC: Essential Eight", url: "https://www.cyber.gov.au/resources-business-and-government/essential-cyber-security/essential-eight", note: "Security baseline commonly referenced in tender security schedules" },
  ],
  related: {
    posts: ["essential-eight-small-trade-business", "sole-trader-privacy-policy-threshold", "free-scan-legitimacy-check", "ai-automation-cost-small-business"],
    tools: [
      { label: "Free Tender Digest", href: "/offers/free-tender-digest", blurb: "A free weekly email of the 10 newest government tenders in your category and state." },
      { label: "Job Flow Lite: Subbie Finder", href: "/offers/subbie-finder-lite", blurb: "Weekly view of who won government work near you, for subcontracting offers." },
      { label: "Free security scan", href: "/scan", blurb: "Public email security check that helps with tender security questions." },
      { label: "All offers", href: "/offers", blurb: "Every Titanos door, from free to enterprise." },
    ],
    products: [
      { label: "Bid Pack", href: "/offers/bid-pack", blurb: "A submission-ready pack for one named tender, for you to review and submit." },
      { label: "Trade Panel Pack", href: "/offers/trade-panel-pack", blurb: "Panel paperwork turned into a submission-ready pack." },
      { label: "Supplier Cyber Readiness Pass", href: "/offers/supplier-cyber-readiness-pass", blurb: "A tender-ready security answers sheet and ranked fix list." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Get the free tender digest",
    href: "/offers/free-tender-digest",
    text: "The easiest first step is to see what is being bought near you. The free digest sends the newest government tenders in your category and state each week, with no obligation.",
  },
};
