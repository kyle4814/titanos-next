import type { Offer } from "../types";

export const OFFERS_SPECIALIST: Offer[] = [
  {
    slug: "privacy-adm-fix",
    name: "Privacy ADM Fix",
    group: "specialist",
    buyer: "Principal or practice manager at an accounting, law, financial planning, medical, allied health, NDIS or aged care firm",
    bluf: "We read your live privacy policy and show you the exact wording it is missing for the 10 December 2026 automated-decision rule (as we read the Privacy Act amendments; confirm with your adviser), with wording you can adapt.",
    forWho: [
      "Accounting, law and financial planning practices",
      "Medical, allied health, NDIS and aged care providers",
      "Any practice whose privacy policy has not been updated for automated decisions",
    ],
    youGet: [
      "A reading of your actual live privacy policy, with the missing automated-decision (ADM) wording pointed out",
      "Compliant wording you can adapt and paste in",
      "A 10-point checklist to work through",
      "Every finding dated and sourced",
    ],
    howItWorks: [
      "You send your website address, your sector and a contact email.",
      "We read your live policy and compare it with the new rule.",
      "You receive the reading, the wording and the checklist.",
    ],
    edge:
      "We run a privacy-policy reader over your real, live policy, not a generic template. It looks for the specific gap of automated-decision wording being absent.",
    priceAud: 197,
    cadence: "one-off",
    priceNote: "AU$197 one-off. No GST is charged.",
    status: "READY",
    freeHook:
      "A free one-line result: your policy does or does not mention automated decisions, with the line quoted from your page.",
    faq: [
      {
        q: "Who are you and how did you find my policy?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254. We only read the privacy policy you have already published on your website.",
      },
      {
        q: "Do you touch my systems?",
        a: "No. We read public pages only. Nothing is installed, scanned or accessed inside your business.",
      },
      {
        q: "Is this legal advice?",
        a: "No. This is general information, not legal advice. Coverage statements should be confirmed with your own lawyer or advisor before you rely on them.",
      },
      {
        q: "Does my IT provider or lawyer get replaced?",
        a: "No. Your IT provider and your lawyer stay exactly where they are. This gives them a clear starting point.",
      },
      {
        q: "What does it cost, and is there GST?",
        a: "AU$197 once. We are not GST registered, so no GST is charged. There is no subscription.",
      },
      {
        q: "What if I say no?",
        a: "A no is welcome. The free one-line result is yours to keep either way.",
      },
    ],
    ladderUp: "/compliance",
    kyleMinutes: 3,
  },
  {
    slug: "privacy-essential-eight-pack",
    name: "Privacy Act and Essential Eight Pack",
    group: "specialist",
    buyer: "Owner or compliance lead at a medical, allied health, NDIS, aged care, legal or financial practice holding client health or financial data",
    bluf: "A done-with-you pack that gives your practice a privacy policy, a breach plan, a supplier register and a checklist, so you hold evidence of your privacy and basic cyber controls.",
    forWho: [
      "Practices that hold client health or financial information",
      "Owners with no evidence trail for privacy and basic cyber controls",
      "Teams that cannot justify a full consultancy",
    ],
    youGet: [
      "A privacy policy built for your sector",
      "A breach response runbook (what to do, in order, if something goes wrong)",
      "A vendor register listing the suppliers that hold your data",
      "An Essential Eight checklist (the Australian Government's eight basic cyber controls)",
      "A dated baseline of your current public email security and policy wording",
    ],
    howItWorks: [
      "We take your website address, sector and headcount.",
      "We read your public posture to set a dated baseline, then fill the sector template with you.",
      "You review the finished pack and keep it as your evidence.",
    ],
    edge:
      "A normal consultant starts from a questionnaire. We start from passive evidence of your current posture (our SpoofGuard email reading and our policy reader), then use our pack templates.",
    priceAud: 5997,
    cadence: "one-off",
    priceNote: "AU$5,997 one-off. No GST is charged.",
    status: "READY",
    freeHook: "A free SpoofGuard email security reading plus an automated-decision wording check on your policy.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "What do you look at to set the baseline?",
        a: "Public records only: your public DNS email settings and your published policy. Nothing inside your systems is touched.",
      },
      {
        q: "Does this make me compliant?",
        a: "The pack gives you documents and evidence to work from. It is general information, not legal advice, and it does not certify compliance. We do not claim any law requires a specific setting such as DMARC.",
      },
      {
        q: "Does my IT provider get replaced?",
        a: "No. Your IT provider stays. The pack gives them and you a shared checklist.",
      },
      {
        q: "What does it cost?",
        a: "AU$5,997 once, with no GST charged. Ongoing monitoring is a separate, optional step.",
      },
      {
        q: "Can I say no or ask for time?",
        a: "Yes. A no is welcome, and you can take time to talk it through with your team or accountant first.",
      },
    ],
    ladderUp: "/monitor",
    kyleMinutes: 10,
  },
  {
    slug: "referrer-map-property-finance",
    name: "Referrer Map for Property and Finance",
    group: "specialist",
    buyer: "Real estate agents, property managers, mortgage brokers",
    bluf: "A local map of 50 businesses you could partner with for referrals, plus a draft introduction you can send.",
    forWho: [
      "Real estate agents and property managers",
      "Mortgage brokers",
      "Anyone who wants referral partners such as accountants, conveyancers and builders nearby",
    ],
    youGet: [
      "A map of 50 local referral-partner candidates for your suburb",
      "Each candidate's public email security posture, as a conversation starter",
      "A draft partner introduction, ready for you to approve",
    ],
    howItWorks: [
      "You tell us your suburb and the partner types you want.",
      "We build the list from public business sources and check the contact details.",
      "You receive the map and the draft. You decide who to contact.",
    ],
    edge:
      "We combine business emails sourced from public maps listings with technology data, and we check that the contacts can actually receive mail.",
    priceAud: 297,
    cadence: "one-off",
    priceNote: "AU$297 one-off. No GST is charged.",
    status: "CHECK",
    freeHook: "A free 5-partner sample for your suburb.",
    faq: [
      {
        q: "Who are you and where do the names come from?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254. Names come from public business listings.",
      },
      {
        q: "Will you email these people for me?",
        a: "No. You get the list and a draft. Any introduction email is shown to you on an approval card first, and the Spam Act applies to what you send. The sender is responsible for complying with the Spam Act.",
      },
      {
        q: "Does this replace my referral relationships?",
        a: "No. It helps you find new people to start a conversation with. Nobody is replaced.",
      },
      {
        q: "What does it cost?",
        a: "The price is AU$297 once. No GST is charged.",
      },
      {
        q: "What if it is not for me?",
        a: "A no is welcome. The 5-partner sample is yours to keep.",
      },
    ],
    ladderUp: "/leads",
    kyleMinutes: 4,
  },
  {
    slug: "quarterly-board-cyber-privacy-briefing",
    name: "Quarterly Board Cyber and Privacy Briefing",
    group: "specialist",
    buyer: "Board or CEO of an aged care group, large clinic network, school or charity",
    bluf: "Every quarter your board gets a plain-English reading of your organisation's public cyber and privacy posture, with actions as simple steps.",
    forWho: [
      "Boards and CEOs who must show they oversee cyber and privacy",
      "Aged care groups, clinic networks, schools and charities",
      "Organisations that want a short reading, not a technical report",
    ],
    youGet: [
      "A quarterly briefing on your public posture over time",
      "Email security and privacy-policy wording tracked quarter to quarter",
      "A change log showing what moved since last quarter",
      "Actions written as simple steps",
    ],
    howItWorks: [
      "You give us your organisation's website address and a board contact.",
      "Each quarter we read your public posture and compare it with the last reading.",
      "The board receives the briefing and the steps to take.",
    ],
    edge:
      "We keep a dated, passive history of your own public posture across quarters, built on our dossier template.",
    priceAud: 1997,
    cadence: "quote",
    priceNote: "AU$1,997 per quarter. No GST is charged.",
    status: "CHECK",
    freeHook: "A free first-page posture reading, the same page that opens a full briefing.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "What do you look at?",
        a: "Public records only, such as your public email settings and your published policy. Nothing inside your systems is touched.",
      },
      {
        q: "Does this replace our IT provider or risk committee?",
        a: "No. Your IT provider and committee stay. The briefing gives them and the board one shared page.",
      },
      {
        q: "What does it cost, and can we cancel?",
        a: "The price is AU$1,997 per quarter, with no GST charged. We will confirm the terms, including how to stop, before anything starts.",
      },
      {
        q: "What if the board wants time first?",
        a: "Take it. A no or a later yes are both welcome, and the first-page reading is yours either way.",
      },
    ],
    ladderUp: "/enterprise",
    kyleMinutes: 8,
  },
  {
    slug: "five-jurisdiction-privacy-bundle",
    name: "Five-Jurisdiction Privacy Bundle",
    group: "specialist",
    buyer: "Online seller, freelancer or SaaS founder with customers in two or more of UK, NZ, EU, CA, SG",
    bluf: "One pack and one checklist for selling online into the UK, New Zealand, the EU, Canada and Singapore, with a single page of the strictest wording that covers them.",
    forWho: [
      "Online sellers and freelancers with customers overseas",
      "SaaS founders selling to more than one region",
      "Anyone who cannot afford a lawyer in each country",
    ],
    youGet: [
      "The regional privacy kits for the UK, NZ, EU, Canada and Singapore in one pack",
      "One combined gap reading of your page",
      "A single page of the strictest wording common to all the regions",
    ],
    howItWorks: [
      "You tell us your website address and the countries your customers are in.",
      "We read your page against each region's rules.",
      "You receive the combined reading and the one-page wording.",
    ],
    edge:
      "One setup feeds five regional kits, so you get all five from a single request at one low price.",
    priceAud: 49,
    cadence: "one-off",
    priceNote: "AU$49 one-off. No GST is charged.",
    status: "CHECK",
    freeHook: "A free which-regions-apply-to-me picker.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "Is this legal advice?",
        a: "No. This is general information, not legal advice, in every region it covers. For a firm view, talk to a lawyer in that region.",
      },
      {
        q: "What do you look at?",
        a: "Only the public page you point us to. Nothing in your systems is touched.",
      },
      {
        q: "What does it cost?",
        a: "The price is AU$49 once. No GST is charged and there is no subscription.",
      },
      {
        q: "What if I only sell in one or two regions?",
        a: "The free picker shows which regions apply to you first, so you can decide whether the bundle fits. A no is welcome.",
      },
    ],
    ladderUp: "/monitor",
    kyleMinutes: 2,
  },
  {
    slug: "job-flow",
    name: "Job Flow",
    group: "specialist",
    buyer: "Owner-operator of a 1 to 15 person trade or local service business",
    bluf: "Each month you get a list of who has just been awarded work near you, up to 50 local leads, and ready-to-use follow-up messages in your own voice.",
    forWho: [
      "Electricians, plumbers, builders, landscapers, solar installers, pest controllers and cleaners",
      "Owner-operators with 1 to 15 staff",
      "Tradies who depend on word of mouth and want steadier work",
    ],
    youGet: [
      "A winners-near-you list of contract awards in your postcode and radius, with value, scope, suburb and how to reach the head contractor",
      "Up to 50 sourced leads each month",
      "Review-request and follow-up templates written in your voice",
      "Email security monitoring on your own domain (SpoofGuard Monitor)",
      "A one-page report each month",
    ],
    howItWorks: [
      "You tell us your trade, postcode, radius and website, and send a sample of how you write.",
      "Each month we build your lists and templates, and you approve one card.",
      "You get the report and start calling.",
    ],
    edge:
      "We read live Australian Government contract awards (AusTender) down to supplier, suburb and value, and combine them with public business listings. An ordinary lead agency does not have the contract-winner data.",
    priceAud: 249,
    cadence: "month",
    priceNote: "AU$249 a month. No GST is charged.",
    status: "CHECK",
    freeHook:
      "A free sample: five contract winners within 25 km of your postcode this month, sourced and dated. Federal data is ready now. State and council data is being checked area by area.",
    faq: [
      {
        q: "Who are you and how did you find me?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254. We use public records, such as published government contract awards and public business listings.",
      },
      {
        q: "Do you touch my website or systems?",
        a: "No. We read public information only. The email monitoring looks at your public email settings.",
      },
      {
        q: "Will you contact people for me?",
        a: "No. You get lists and templates. Anything sent in your name goes through you first.",
      },
      {
        q: "Does this replace anyone?",
        a: "No. It gives you your time back by doing the research. You still do the quoting and the work.",
      },
      {
        q: "What does it cost, and can I cancel?",
        a: "AU$249 a month, with no GST charged. We will confirm cancellation terms before you start.",
      },
      {
        q: "What if there is no work near me?",
        a: "The free sample shows you what exists in your radius first. If it is thin, you will see that before you pay anything.",
      },
    ],
    ladderUp: "/tradies",
    kyleMinutes: 8,
  },
  {
    slug: "commercial-property-tenant-trigger-feed",
    name: "Commercial Property Tenant Trigger Feed",
    group: "specialist",
    buyer: "Commercial and industrial leasing agents, shopping-centre and business-park managers",
    bluf: "A weekly list of businesses that have just opened, changed their registered address or won contracts in your suburbs, so you hear about space needs early.",
    forWho: [
      "Commercial and industrial leasing agents",
      "Shopping-centre and business-park managers",
      "Anyone who wants to reach a business before it talks to a rival agent",
    ],
    youGet: [
      "A weekly feed of new registrations, registered-address changes and tender winners in the suburbs you choose",
      "Results grouped by industry and size band",
      "A spreadsheet (CSV) plus a short digest",
    ],
    howItWorks: [
      "You choose your suburbs, industries and the event types you care about.",
      "Each week we filter our company records and contract awards to match.",
      "The feed and digest arrive by your preferred channel.",
    ],
    edge:
      "We hold address-change history across millions of Australian companies, which only exists as a time series. Contract awards add a growth signal, since winners often need more space.",
    priceAud: 149,
    cadence: "month",
    priceNote: "AU$149 to AU$299 a month, depending on area and volume. No GST is charged.",
    status: "BUILD",
    freeHook:
      "A free sample: who moved or opened in your top suburb last quarter. How often our address data refreshes is still being checked, so we will not promise a weekly cadence until it is confirmed.",
    faq: [
      {
        q: "Who are you and where does the data come from?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254. Data comes from public company registers and published government contract awards.",
      },
      {
        q: "Do you contact the businesses?",
        a: "No. You receive the feed. What you do with it is up to you.",
      },
      {
        q: "How fresh is the data?",
        a: "We are still checking how often the address records refresh. The free sample will show what is realistic before we commit to a cadence.",
      },
      {
        q: "Does this replace my own market knowledge?",
        a: "No. It adds early signals to what you already know about your patch.",
      },
      {
        q: "What does it cost?",
        a: "The range is AU$149 to AU$299 a month. No GST is charged. A no is welcome.",
      },
    ],
    ladderUp: "/leads",
    kyleMinutes: 0,
  },
  {
    slug: "change-feed-connector-automation-agencies",
    name: "Change Feed Connector for Automation Agencies",
    group: "specialist",
    buyer: "Automation and CRM consultants who build lead flows for local clients",
    bluf: "A ready-made trigger feed for Make, Zapier and n8n: company change events, filtered for each of your clients, sent straight to your workflow.",
    forWho: [
      "Make, Zapier and n8n consultants",
      "CRM and lead-flow builders serving local businesses",
      "Agencies that cannot build a company-change dataset themselves",
    ],
    youGet: [
      "A documented webhook (an automatic message sent to your workflow when something changes)",
      "A Make and Zapier trigger recipe",
      "Client-specific filtered change events posted to your endpoint",
      "A separate setting for each end client, with a white-label option",
    ],
    howItWorks: [
      "You give us a web address for your workflow and the filters for each client.",
      "We send matching events to that address as they happen.",
      "Your automation takes it from there.",
    ],
    edge:
      "A ready-made trigger feed with history behind it. Each consultant becomes a channel to dozens of clients without building the data themselves.",
    priceAud: 199,
    cadence: "month",
    priceNote: "AU$199 a month plus AU$20 a month for each additional end client. No GST is charged.",
    status: "BUILD",
    freeHook: "A free sandbox endpoint with sample events, so you can test your workflow first.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "Where do the events come from?",
        a: "Public company registers and published government contract awards.",
      },
      {
        q: "Do I keep my client relationships?",
        a: "Yes, entirely. The white-label option means your clients deal with you.",
      },
      {
        q: "What does it cost?",
        a: "The price is AU$199 a month plus AU$20 for each additional end client. No GST is charged.",
      },
      {
        q: "Can I test it first?",
        a: "Yes. The free sandbox sends sample events. A no after testing is welcome.",
      },
    ],
    ladderUp: "/ai-delivery",
    kyleMinutes: 3,
  },
  {
    slug: "outbound-gate-outreach-lint",
    name: "Outbound Gate and Outreach Lint for Agent Builders",
    group: "specialist",
    buyer: "Agency building cold or follow-up email agents under the Spam Act",
    bluf: "A safety layer for email agents: nothing sends until a person approves it, and banned claims, fake urgency and missing unsubscribe lines are caught before they go out.",
    forWho: [
      "Agencies and freelancers building cold or follow-up email agents",
      "Builders who send on behalf of clients in Australia",
      "Anyone worried about the Spam Act and their clients' sender reputation",
    ],
    youGet: [
      "A send-only-after-approval module",
      "A checker for banned phrases and AI-sounding wording (urgency and fear words, invented statistics)",
      "Checks for an unsubscribe line and clear sender identity",
      "A daily send cap with random spacing between messages",
      "Tests that prove the gate works",
    ],
    howItWorks: [
      "You tell us your banned-phrase additions, daily cap and sender identity.",
      "We set up the module for each client sender.",
      "Your agent can only send what passes the gate and gets approved.",
    ],
    edge:
      "This is the same outreach gate and content checker TITANOS runs on its own outbound email. It includes the lessons from an earlier scanner of ours that we retired.",
    priceAud: 197,
    cadence: "one-off",
    priceNote: "AU$197 one-off, with updates bundled in the Core Kit. No GST is charged.",
    status: "CHECK",
    freeHook:
      "A free banned-phrase list and a plain-English Spam Act sending checklist. This is general information, not legal advice.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "Does this make my emails legal?",
        a: "No. It reduces common mistakes, but it is general information only. It is not legal advice and it is not a compliance guarantee.",
      },
      {
        q: "Does it replace human review?",
        a: "No. It enforces human approval. Nothing sends without a person saying yes.",
      },
      {
        q: "What does it cost?",
        a: "The price is AU$197 once, with no GST charged.",
      },
      {
        q: "Can I try the idea first?",
        a: "Yes. The free banned-phrase list and checklist are yours to keep. A no is welcome.",
      },
    ],
    ladderUp: "/ai-delivery",
    kyleMinutes: 3,
  },
  {
    slug: "agent-preflight-test-harness",
    name: "Agent Pre-Flight Test Kit",
    group: "specialist",
    buyer: "Freelancer or agency wanting a repeatable 'safe to ship' gate before go-live",
    bluf: "A test kit that attacks your AI agent before the client sees it, plus a signed-off pre-flight report you can hand over.",
    forWho: [
      "Freelancers and agencies handing AI agents to paying clients",
      "Builders whose agents worked in a demo and nowhere else",
      "Anyone who wants a repeatable go-live check",
    ],
    youGet: [
      "A test kit with ready-made cases: prompt-injection strings (text that tries to hijack the agent), empty and malformed inputs, and stale-data cases",
      "Fail-closed checks on every safety gate (if the gate cannot decide, it blocks)",
      "A pre-flight report template to give your client",
    ],
    howItWorks: [
      "You tell us your agent's entry point and the gates to attack.",
      "We set up the test kit for that agent.",
      "You run it, fix what fails, and hand over the report.",
    ],
    edge:
      "It comes from how TITANOS tests its own work: we deliberately try to break passing tests and record the false greens we catch. Ordinary agencies ship without adversarial test cases.",
    priceAud: 297,
    cadence: "one-off",
    priceNote: "AU$297 one-off, or AU$199 with the Core Kit. No GST is charged.",
    status: "BUILD",
    freeHook: "A free ten-case starter set (injection and empty-input cases) in our public write-up.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "Does a pass mean my agent is safe?",
        a: "No. It means the agent survived these cases. It is a repeatable check, not a guarantee.",
      },
      {
        q: "Do you see my client's data?",
        a: "No. The test kit runs on your side with your own agent.",
      },
      {
        q: "What does it cost?",
        a: "The price is AU$297 once, or AU$199 with the Core Kit. No GST is charged.",
      },
      {
        q: "Can I look before buying?",
        a: "Yes. The free ten-case starter set is public. A no is welcome.",
      },
    ],
    ladderUp: "/ai-delivery",
    kyleMinutes: 3,
  },
  {
    slug: "club-sponsor-prospect-list",
    name: "Club Sponsor Prospect List",
    group: "specialist",
    buyer: "Volunteer treasurer or sponsorship officer at a junior club or P&C",
    bluf: "A ranked list of 60 to 150 local businesses near your club, with a one-page summary of who to ask first.",
    forWho: [
      "Junior sports clubs, school P&Cs and surf clubs",
      "Local event organisers",
      "Volunteers tired of asking the same five businesses every season",
    ],
    youGet: [
      "A ranked list of 60 to 150 local businesses within your chosen distance",
      "Each scored for fit by industry, size, local presence and a verified business email",
      "A spreadsheet plus a one-page who-to-ask-first summary",
    ],
    howItWorks: [
      "You tell us your club name, postcode, distance and what you are asking for.",
      "We build and rank the list from public business sources.",
      "You receive the sheet and summary and decide who to approach.",
    ],
    edge:
      "We combine our own database of millions of Australian businesses (industry, size, website) with verified business emails from public map listings, filtered by distance from your club.",
    priceAud: 49,
    cadence: "one-off",
    priceNote: "AU$49 one-off per season for a list of 60. AU$99 for 150 with full contact fields. No GST is charged.",
    status: "CHECK",
    freeHook: "A free top-10 local sponsor shortlist for any club that sends a postcode and distance. No signup needed.",
    faq: [
      {
        q: "Who are you and where do the names come from?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254. Names come from public business listings.",
      },
      {
        q: "Whose details are in the list?",
        a: "Business contact details only. Where a business is a sole trader we take care and keep to business contact fields.",
      },
      {
        q: "Do you contact the businesses?",
        a: "No. You get the list. The asking is yours.",
      },
      {
        q: "What does it cost?",
        a: "AU$49 for a list of 60 per season, or AU$99 for 150 with full contact fields. No GST is charged.",
      },
      {
        q: "What if our committee wants to see it first?",
        a: "The free shortlist is built for that. A no is welcome.",
      },
    ],
    ladderUp: "sponsor-send-rail",
    kyleMinutes: 3,
  },
  {
    slug: "sponsor-send-rail",
    name: "Sponsor Send Rail (Volunteer Tap-to-Send)",
    group: "specialist",
    buyer: "Volunteer who will approve 10 emails a week but will not manage a mailing tool",
    bluf: "Each sponsor email appears as a card on your phone. You tap to send, and we track who was asked and who replied.",
    forWho: [
      "Volunteers who can approve a few emails a week",
      "Clubs and P&Cs that worry about sending badly or too much",
      "Anyone who wants to know who was asked and who answered",
    ],
    youGet: [
      "Each pitch email as an approval card showing what, why, cost and whether it can be undone, with a tap to send",
      "Emails sent from your club's own address, spaced out over time",
      "Business addresses only, with a plain unsubscribe line",
      "A reply watcher that lists who answered",
      "A one-line status each week",
    ],
    howItWorks: [
      "You give us the club's sender address, daily cap and target list.",
      "Each email arrives as a card for you to approve or skip.",
      "Approved emails go out, and replies are listed for you.",
    ],
    edge:
      "We already run an approval-card email sender, an outreach checker, an inbox watcher and a reply drafter for our own work. An ordinary freelancer does not have that governance layer.",
    priceAud: 149,
    cadence: "one-off",
    priceNote: "AU$149 per season, including up to 100 sends. AU$19 a month refresh while active. No GST is charged.",
    status: "CHECK",
    freeHook: "A free dry run: see the first three cards with sample text before you connect any inbox.",
    faq: [
      {
        q: "Who are you?",
        a: "TITANOS is a Queensland sole trader business run by Kyle Deligny, ABN 34 318 502 254.",
      },
      {
        q: "Is this allowed under the Spam Act?",
        a: "We send to business addresses only, with a clear sender identity and an unsubscribe line. This is general information, not legal advice, and you remain responsible for what your club sends. The sender is responsible for complying with the Spam Act.",
      },
      {
        q: "Can something go out without me?",
        a: "No. Nothing is sent until you tap approve on its card.",
      },
      {
        q: "What if someone says no?",
        a: "A no is welcome. Our wording says so, and anyone who unsubscribes is not contacted again.",
      },
      {
        q: "What does it cost?",
        a: "AU$149 per season including up to 100 sends, then AU$19 a month for a refresh while active. No GST is charged.",
      },
    ],
    kyleMinutes: 6,
  },
];
