import type { Guide } from "@/lib/guides";

export const aiReceptionist: Guide = {
  slug: "ai-receptionist-australia-trades",
  seoTitle: "AI Receptionist for Trades: Cost, Privacy, Setup",
  h1: "AI Receptionist for Australian Trade Businesses: Cost, Consent and Setup",
  description:
    "What an AI receptionist does for a trade business, what it costs, whether it is Privacy Act compliant, how call recording consent works and a setup checklist.",
  cluster: "AI receptionists",
  targetTerms: ["ai receptionist australia trades", "is an ai receptionist privacy act compliant", "ai receptionist call recording consent australia", "ai receptionist cost australia"],
  date: "2026-11-28",
  updated: "2026-11-28",
  intro: [
    {
      t: "p",
      x: "An AI receptionist is software that answers your business phone, talks to the caller, collects the details of the job and passes them to you by text, email or your job software. For a trade business that spends the day on tools instead of at a desk, the appeal is obvious: the phone gets answered at 7am, at lunch and while you are under a house.",
    },
    {
      t: "p",
      x: "The risks are less obvious. The moment the system records or transcribes a customer's voice, you hold a new kind of personal information, you may be disclosing it to overseas companies and, depending on your state, you may be recording a private conversation. This guide explains how these systems work, what they cost, what Australian privacy and recording rules say, how to test one before you trust it and how to set it up so a bad call does not cost you a job or a complaint.",
    },
    {
      t: "note",
      title: "Short answer",
      x: "Using an AI receptionist is legal in Australia. It is compliant in practice when you tell callers up front, keep the data where you can account for it, get a written commitment from the vendor about storage and training, and give every urgent call a path to a human. Each of those is covered below.",
    },
  ],
  sections: [
    {
      id: "what-it-does",
      h2: "What an AI receptionist does, and what it does not",
      blocks: [
        { t: "p", x: "Under the label sit three quite different products. Knowing which one you are being sold saves money and avoids disappointment." },
        {
          t: "table",
          caption: "Three kinds of phone answering",
          head: ["Type", "How it works", "Good for", "Watch for"],
          rows: [
            ["Missed-call text-back", "Does not answer the call. Texts the caller after a missed call.", "The cheapest fix for lost calls. See the [tradie automation guide](/guides/tradie-automation-australia).", "Caller must be willing to type. Emergencies may ring the next tradie."],
            ["AI voice agent", "Answers the call, speaks, asks questions and collects details using speech recognition and a language model.", "After hours, busy periods, repetitive enquiries.", "Recording, transcripts, offshore processing, mistakes on accents and noise."],
            ["Hybrid or human-backed", "AI first, a human takes over on request or on certain words.", "Businesses that cannot risk a missed emergency call.", "Higher per-call cost. Check who the humans are and where they sit."],
          ],
        },
        { t: "p", x: "A voice agent can usually do these jobs: greet the caller in your business name, ask what the problem is and the address, check the caller's details against your customer list, offer booking times from your calendar, take a message and send you a summary. It is poor at the same things a new human receptionist is poor at: unusual requests, angry callers, strong accents on a bad line, and anything that needs judgement about safety." },
        { t: "p", x: "It also does not know your trade the way you do unless you tell it. A plumber's agent needs to know that a burst pipe is urgent and a dripping tap is not. A sparky's agent needs a rule for \"burning smell from the switchboard\". Writing those rules is most of the real work." },
      ],
    },
    {
      id: "what-it-costs",
      h2: "What it costs",
      blocks: [
        { t: "p", x: "Prices change often and differ widely, so a table of vendor prices would be out of date quickly and we have not verified any here. What does stay stable is the structure of the cost. Ask every vendor to fill in each line below." },
        {
          t: "table",
          caption: "Cost lines to ask about",
          head: ["Line", "What to ask", "Why it matters"],
          rows: [
            ["Monthly platform fee", "Is it flat, per seat or per phone number?", "The base cost even in a quiet month."],
            ["Per-minute or per-call charge", "Are minutes rounded up? Is there a cap before overage?", "A talkative caller on a long call changes your bill."],
            ["Phone number", "Do I keep my existing number? What if I leave?", "Your number is an asset. Porting it out should be simple."],
            ["Setup or onboarding", "Is there a one-off fee? Who writes the call script?", "Some vendors charge for configuration you could do yourself."],
            ["Integrations", "Does it connect to my job software and calendar? Included or extra?", "Without it you retype every message."],
            ["Call recording and storage", "Is recording on by default? Where is it stored and for how long?", "Ties directly to the privacy section below."],
            ["Contract", "Month to month or fixed term? Cancellation notice?", "Avoid a twelve-month lock-in until you have measured results."],
          ],
        },
        { t: "h3", x: "A break-even check you can do on the back of a card" },
        {
          t: "example",
          title: "Worked example (made-up numbers, replace with yours)",
          x: [
            "Suppose the service costs 300 dollars a month all in and your average job is worth 500 dollars. It needs to win one extra job every two months to break even on revenue, before your own time and any margin.",
            "Now estimate honestly: how many calls do you currently miss, how many are genuine new enquiries, and how many would still have gone elsewhere because the caller wanted an answer in five minutes? Count for four weeks before you sign anything.",
          ],
        },
        { t: "p", x: "Compare it to the alternatives on equal terms: a missed-call text-back for a fraction of the price, a part-time human answering service, a family member on a roster, or an answering service your phone provider already offers. Our post on [what AI automation should cost a small trade business](/blog/ai-automation-cost-small-business) lays out the same comparison for the wider toolkit." },
      ],
    },
    {
      id: "privacy-act",
      h2: "Is an AI receptionist Privacy Act compliant?",
      blocks: [
        { t: "p", x: "The Privacy Act 1988 does not mention AI receptionists. It applies to personal information, and a caller's name, phone number, address, voice recording and description of their problem are all personal information. Whether the Act applies to you depends on whether you are an \"APP entity\". Many sole traders and small businesses with annual turnover under 3 million dollars are not, but the exceptions are wider than people think. Our [Privacy Act guide](/guides/privacy-act-small-business-australia) sets out who is caught." },
        { t: "p", x: "Even if you are exempt, three practical reasons to follow the principles anyway: your customers expect it, larger clients and insurers ask about it, and the rules can narrow. The principles that matter most for phone answering are these." },
        {
          t: "table",
          caption: "Australian Privacy Principles applied to a call-answering tool",
          head: ["Principle", "What it asks", "What to do"],
          rows: [
            ["APP 1: open and transparent", "Have a clear, current privacy policy.", "Mention call handling, recording, AI tools and the vendors you use."],
            ["APP 3: collection", "Collect only what is reasonably necessary.", "Set the agent to ask for name, address and problem, not date of birth or card details."],
            ["APP 5: notice", "Tell people what you collect and why, at or before collection.", "Play a short disclosure at the start of the call."],
            ["APP 6: use and disclosure", "Use information for the purpose collected.", "Do not let the vendor reuse call content to train its own models without clear agreement."],
            ["APP 8: overseas disclosure", "Take reasonable steps before sending personal information overseas.", "Ask where audio, transcripts and the AI model processing sit."],
            ["APP 11: security", "Take reasonable steps to protect information.", "Choose vendors with access controls and a deletion policy. You stay accountable for what a supplier holds."],
            ["APP 12 and 13: access and correction", "Let people see and correct their information.", "Know how you would find and delete a person's recording if asked."],
          ],
        },
        { t: "p", x: "The Office of the Australian Information Commissioner has published guidance on [privacy and the use of commercially available AI products](https://www.oaic.gov.au/ai), which covers due diligence on vendors, transparency and why entering personal information into a tool deserves caution. Read it before you pick a product. It does not treat AI as banned, it treats it as a tool whose use you must be able to explain." },
        { t: "p", x: "We covered the three checks that matter most, consent, storage location and vendor accountability, in [Is an AI receptionist for your trade business actually Privacy Act compliant?](/blog/ai-receptionist-compliance). This guide goes further on cost, consent law and setup." },
        {
          t: "note",
          title: "A date to know",
          x: "From 10 December 2026, new transparency rules for automated decisions that significantly affect people commence for organisations covered by the Privacy Act. A receptionist that books jobs is rarely making that kind of decision. One that screens, scores or refuses callers might be. See the [Privacy Act guide](/guides/privacy-act-small-business-australia).",
        },
      ],
    },
    {
      id: "call-recording",
      h2: "Call recording consent in Australia",
      blocks: [
        { t: "p", x: "Recording a phone call is regulated by two layers of law. Federal law, the Telecommunications (Interception and Access) Act 1979, restricts intercepting communications passing over a telecommunications system. State and territory surveillance devices laws govern recording private conversations. The details differ by state, and several states prohibit recording a private conversation unless every party consents, with limited exceptions." },
        { t: "p", x: "Because rules vary, the safe, simple standard is the same everywhere: **tell the caller at the start, in plain words, that the call is handled by an automated assistant and may be recorded, and let them carry on or ask for a person.** Continuing after a clear notice is generally treated as consent, and it also meets the Privacy Act notice expectation. If you operate in more than one state, or take calls from interstate customers, apply the strictest standard to all calls." },
        {
          t: "example",
          title: "Example opening line",
          x: ["\"Thanks for calling Reliable Plumbing. This is an automated assistant. This call may be recorded and transcribed so we can book your job. If you'd rather speak to a person, just say so.\""],
        },
        { t: "p", x: "A few further points worth knowing:" },
        {
          t: "ul",
          x: [
            "A notice at the start does not help if the system records before it plays. Test the timing yourself.",
            "If the call transfers to your mobile, make sure the recording stops or the notice repeats, depending on how the transfer works.",
            "Keep recordings for as short a time as is useful. Deleting them after a defined period is itself a good privacy practice.",
            "Do not record calls where callers pay by card over the phone unless your payment provider's rules allow it.",
          ],
        },
        { t: "p", x: "This is general information. If your business takes sensitive calls, such as health related enquiries, or you operate across states, get advice from a lawyer who knows your state's surveillance devices law." },
      ],
    },
    {
      id: "vendor-questions",
      h2: "Ten questions to ask any vendor",
      blocks: [
        { t: "p", x: "Send these in writing and keep the answers. Vague or evasive replies tell you something. A good vendor answers in a paragraph." },
        {
          t: "ol",
          x: [
            "Where are call audio and transcripts stored, by country and provider?",
            "Which AI model providers see the audio or text, and are they in Australia?",
            "Do you use my customers' calls to train any model, yours or a third party's? Can I opt out in writing?",
            "How long are recordings and transcripts kept, and can I set the period?",
            "Can I export and delete all data for my account and for one caller on request?",
            "What happens to my phone number and data if I cancel?",
            "What security controls protect access: logins, multi-factor authentication, staff access to my data?",
            "What is your breach notification process, and how quickly would you tell me? (See the [data breach scheme](/blog/notifiable-data-breach-scheme-small-business).)",
            "Do you have a data processing clause in the contract, and who is liable if your system leaks a recording?",
            "Can I hear a sample of calls handled for a trade business like mine, including a difficult one?",
          ],
        },
        { t: "p", x: "Under APP 11 you remain accountable for reasonable steps to protect personal information even after it sits with a supplier. A written answer to these questions is part of showing you took those steps." },
      ],
    },
    {
      id: "setup",
      h2: "Setting one up properly",
      blocks: [
        { t: "h3", x: "1. Write the call flow before you touch the tool" },
        { t: "p", x: "On one page, list: the greeting, the five questions to ask, what counts as urgent, what the agent must never promise (price, arrival time, warranty) and who it should ring or text when something is urgent. Most disappointments come from skipping this step." },
        { t: "h3", x: "2. Give every urgent call a human path" },
        { t: "p", x: "Define trigger words and situations: gas smell, sparks, flooding, no hot water for an elderly customer, someone trapped. The agent should either transfer to you or a backup, or tell the caller to ring 000 where life or safety is at risk. Test these by ringing in and trying to confuse it." },
        { t: "h3", x: "3. Limit what it can do" },
        { t: "p", x: "Start with taking messages and booking inspection times. Do not allow it to quote prices, confirm warranties or commit you to arrival windows until you have reviewed a month of real calls." },
        { t: "h3", x: "4. Run it alongside you for two weeks" },
        { t: "p", x: "Forward only after-hours calls first. Read or listen to every transcript. Keep a tally: calls handled, calls handled well, calls that needed a fix, and jobs booked." },
        { t: "h3", x: "5. Tell people" },
        { t: "p", x: "Update your privacy policy and your website with a line explaining that calls may be handled by an automated assistant and recorded. Add the vendor's name to your list of service providers." },
        { t: "h3", x: "6. Review monthly" },
        { t: "p", x: "Check the bill, the number of jobs attributed to the agent, any customer complaints and any calls you would have handled differently. Retrain the instructions and repeat." },
      ],
    },
    {
      id: "measuring",
      h2: "Measuring whether it works",
      blocks: [
        { t: "p", x: "Pick three numbers and write them down before you start, then compare after thirty and ninety days." },
        {
          t: "ul",
          x: [
            "**Answer rate:** the share of inbound calls that reach a person or the agent. Your phone log gives the baseline.",
            "**Booked jobs from calls the agent handled,** as against the same period before.",
            "**Complaints or corrections:** how many calls needed you to fix a mistake. This is the quality measure that matters most.",
          ],
        },
        { t: "p", x: "Be wary of any dashboard that reports only \"calls handled\". A call handled badly is worse than a missed call, because the customer now believes you were rude or unreliable." },
        { t: "p", x: "If the numbers do not justify the cost, cancel it. A month-to-month contract exists for exactly this decision." },
      ],
    },
    {
      id: "when-not-to-use",
      h2: "When an AI receptionist is the wrong tool",
      blocks: [
        {
          t: "ul",
          x: [
            "Most of your calls are emergencies where a few minutes' delay is dangerous.",
            "Your customers are mostly older people who dislike talking to machines, and your reviews already mention how personal you are.",
            "You take calls containing health, financial or other sensitive information and cannot get a clear answer on storage and training.",
            "Your phone volume is so low that a missed-call text and a voicemail message already catch everything.",
            "You cannot spare an hour a week for the first month to read transcripts.",
          ],
        },
        { t: "p", x: "None of these rules out automation altogether. A missed-call text-back, a booking link and a clear voicemail message solve a large share of the problem at a small fraction of the risk." },
      ],
    },
    {
      id: "wording-for-privacy-policy",
      h2: "What to say in your privacy policy",
      blocks: [
        { t: "p", x: "If you adopt an AI receptionist, your privacy policy should say, in plain words: that calls may be answered by an automated assistant, that they may be recorded and transcribed, what you use them for, which categories of service provider handle them, whether any are overseas and how a person can ask for access or deletion." },
        {
          t: "example",
          title: "Example wording to adapt (not legal advice)",
          x: ["\"When you call us, an automated assistant may answer and record the call so we can take your details and book your job. Recordings and transcripts are stored by our service provider and kept for up to 90 days. We do not allow the provider to use them to train its models. To ask for a copy or deletion of your recording, email us.\""],
        },
        { t: "p", x: "Only claim what is true. If the vendor does use calls for training, say so, or choose a vendor that does not. The [privacy policy template pack](/products/privacy-policy-template-pack) and the [wording guide for automated decisions](/products/privacy-adm-wording-guide) in our shop give fuller starting points." },
      ],
    },
  ],
  faq: [
    {
      q: "Is it legal to use an AI receptionist in Australia?",
      a: "Yes. No law bans it. The rules that apply are the same ones that cover any tool handling customer information: privacy obligations if you are covered by the Privacy Act, surveillance and telecommunications laws on recording, and consumer law on misleading customers.",
    },
    {
      q: "Do I have to tell callers that an AI is answering?",
      a: "There is no single rule that says the word \"AI\", but a short notice that the call is automated and may be recorded meets the privacy notice expectation and the safest reading of recording laws, and it is honest. Say it at the start of every call.",
    },
    {
      q: "Where is the call data stored?",
      a: "It depends entirely on the vendor. Many are US-built services, and audio or transcripts may pass through overseas servers and third-party model providers. Ask in writing and keep the reply. Under APP 8 you are expected to take reasonable steps before disclosing personal information overseas.",
    },
    {
      q: "How much does an AI receptionist cost for a small trade business?",
      a: "Prices vary and change often, so check each vendor's current page. Expect a monthly platform fee plus per-minute or per-call charges, and ask about setup, integrations, number porting and recording storage. Work out how many extra jobs a month you need to break even before signing.",
    },
    {
      q: "Can an AI receptionist handle emergency calls?",
      a: "It should not be left to decide alone. Set trigger words that transfer to a person or tell the caller to ring 000 where safety is at risk, and test them before going live.",
    },
    {
      q: "Should I choose an AI receptionist or a missed-call text-back?",
      a: "Start with the text-back. It costs less, carries far less privacy risk and fixes much of the lost-call problem. Add a voice agent only if the numbers show you still lose enough jobs to justify it.",
    },
  ],
  sources: [
    { label: "OAIC: guidance on privacy and the use of commercially available AI products", url: "https://www.oaic.gov.au/ai", note: "Due diligence, transparency and caution on entering personal information into AI tools" },
    { label: "OAIC: Australian Privacy Principles", url: "https://www.oaic.gov.au/privacy/australian-privacy-principles", note: "Full text and summaries of APP 1 to 13" },
    { label: "Privacy Act 1988 (Federal Register of Legislation)", url: "https://www.legislation.gov.au/C2004A03712/latest/text", note: "The Act itself, including the small business definition" },
    { label: "Telecommunications (Interception and Access) Act 1979", url: "https://www.legislation.gov.au/C2004A02124/latest/text", note: "Federal restrictions on interception; state surveillance devices laws sit alongside it" },
    { label: "Department of Industry, Science and Resources: Voluntary AI Safety Standard", url: "https://www.industry.gov.au/publications/voluntary-ai-safety-standard", note: "Government guidance on safe and responsible AI use by businesses" },
    { label: "ACMA: Avoid sending spam", url: "https://www.acma.gov.au/avoid-sending-spam", note: "Applies if the receptionist also sends text messages" },
  ],
  related: {
    posts: ["ai-receptionist-compliance", "ai-automation-cost-small-business", "notifiable-data-breach-scheme-small-business", "ai-audit-what-we-actually-find"],
    tools: [
      { label: "Free AI audit", href: "/audit", blurb: "Covers the compliance side as well as whether a tool will save time." },
      { label: "Compliance pack", href: "/compliance", blurb: "Privacy policy, breach plan and AI disclosure sorted in one working call." },
      { label: "Free security scan", href: "/scan", blurb: "Checks your domain's public email security settings." },
      { label: "Find the right offer", href: "/find", blurb: "Three questions, about thirty seconds, runs on your device." },
    ],
    products: [
      { label: "Privacy Policy Template Pack", href: "/products/privacy-policy-template-pack", blurb: "Policy and collection notice templates in everyday words." },
      { label: "Privacy Wording for Automated Decisions", href: "/products/privacy-adm-wording-guide", blurb: "How to describe software-assisted decisions in your policy." },
      { label: "Course: AI for Tradies", href: "/products/course-ai-for-tradies", blurb: "Short course on using AI tools safely in a trade business." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Book the free AI audit",
    href: "/audit",
    text: "Weighing up a voice agent against a simple text-back? The free audit looks at your call volume and workflow, covers the privacy and recording questions, and tells you plainly if you do not need one yet.",
  },
};
