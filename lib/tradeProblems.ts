// Programmatic family 1 (PLAN_90D.md): trade x problem guides, batch 1 (5 pages).
// Every entry carries its own scenarios, exact message wording, worked-example inputs and FAQs.
// Nothing here is templated by swapping a noun: a page is added only when it passes the quality bar
// (distinct query, 600+ words, 40%+ body unique, one thing the results page lacks, primary sources).
// Worked-example numbers are EXAMPLES, labelled as such on the page. They are not industry statistics.

export type Msg = { label: string; when: string; text: string; source: "kit" | "page" };
export type Faq = { q: string; a: string };
export type Source = { label: string; href: string };

export type MissedCallsExample = { kind: "missed-calls"; callsPerWeek: number; missedPct: number; replyPct: number; bookPct: number; jobValue: number; weeks: number };
export type QuoteExample = { kind: "quote-follow-up"; quotesPerMonth: number; silentPct: number; revivePct: number; winPct: number; avgQuote: number; marginPct: number };
export type InvoiceExample = { kind: "invoice-chasing"; invoicesPerMonth: number; latePct: number; avgInvoice: number; daysLateNow: number; daysLateWith: number };
export type ReviewExample = { kind: "review-requests"; jobsPerMonth: number; askedNowPct: number; askedAfterPct: number; reviewPct: number };
export type Example = MissedCallsExample | QuoteExample | InvoiceExample | ReviewExample;

export type TradeProblem = {
  trade: string;
  problem: string;
  tradeLabel: string;
  problemLabel: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  lede: string;
  why: string[];
  scenariosHeading: string;
  scenarios: { t: string; b: string }[];
  messagesHeading: string;
  messagesIntro: string;
  messages: Msg[];
  messageNotes: string[];
  exampleHeading: string;
  exampleIntro: string;
  example: Example;
  stepsHeading: string;
  steps: string[];
  consentHeading: string;
  consent: string[];
  faq: Faq[];
  kit: { slug: string; name: string; fit: string };
  demo?: { href: string; label: string };
  sources: Source[];
  keyword: string;
  reviewed: string;
  published: string;
};

const ACMA: Source = { label: "ACMA: Avoid sending spam (Spam Act 2003 rules)", href: "https://www.acma.gov.au/avoid-sending-spam" };
const SPAM_ACT: Source = { label: "Spam Act 2003, legislation.gov.au", href: "https://www.legislation.gov.au/C2004A01214/latest/text" };
const OAIC_APP: Source = { label: "OAIC: Australian Privacy Principles", href: "https://www.oaic.gov.au/privacy/australian-privacy-principles" };
const ATO_INV: Source = { label: "ATO: Tax invoices", href: "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices" };
const GOOGLE_POLICY: Source = { label: "Google Maps user contributed content policy", href: "https://support.google.com/contributionpolicy/answer/7400114" };

export const TRADE_PROBLEMS: TradeProblem[] = [
  {
    trade: "plumber",
    problem: "missed-calls",
    tradeLabel: "Plumbers",
    problemLabel: "Missed calls",
    keyword: "missed call text back plumber",
    title: "Missed Call Text Back for Plumbers in Australia",
    description: "Missed call text back wording for Australian plumbers: exact in-hours and after-hours texts, a worked example, Spam Act 2003 notes and a ready-made kit.",
    h1: "Missed call text back for plumbers: the wording, the setup and a worked example",
    eyebrow: "Plumbers x missed calls",
    lede: "A plumber's phone rings most when both hands are busy: under a vanity, in a roof, behind a hot water unit. The caller with water on the floor does not leave a voicemail. They ring the next name on Google. This page gives you the exact text to send back, what to ask in it, how to count what missed calls cost you, and where the Spam Act 2003 sits.",
    why: [
      "Plumbing enquiries are urgent more often than most trades. A blocked drain, a failed hot water system or a leaking tap is a problem the customer wants fixed today, so the first plumber to reply tends to get the conversation. That is the reason a short, fast reply matters more here than a polished one.",
      "The reply also does a second job for you: it sorts the work. One question, such as whether it is a leak, a blocked drain or hot water, tells you in ten seconds which call to return first when you climb down from the job.",
    ],
    scenariosHeading: "Five plumbing situations and what the text should do in each",
    scenarios: [
      { t: "Water is leaking now", b: "A flexible hose has let go under a vanity at 6.40am. The caller wants the first plumber who responds. The after-hours text tells them to turn off the main tap, which is the one thing they can do before you arrive, and asks what is happening so you can ring back with a plan." },
      { t: "Blocked drain while you are on another job", b: "You are under a house on a stormwater repair. The caller has a slow kitchen sink. This is a job you can usually book for later that day, so the text asks one thing: is water coming back up, or just draining slowly? Their one-line answer tells you whether to ring in ten minutes or at smoko." },
      { t: "Hot water failure on a cold morning", b: "The customer has no hot water and a house full of people. The type of system matters for parts and for your quote: electric storage, gas continuous flow or solar. A reply that names the unit lets you arrive with the right fittings." },
      { t: "A property manager with a tenant's leak", b: "Agents and strata managers ring on behalf of someone else and need a job reference and an approval limit. Your text can ask for the address and who will give access. Managers who get a fast, businesslike reply often send the next job to the same plumber." },
      { t: "A smell of gas", b: "Do not rely on an automatic text for this one. Decide in advance what your voicemail and your after-hours text say about gas and emergencies, and make sure the first line sends the caller to 000 or the gas distributor's emergency line. The kit's templates cover the water case; write your own gas wording before you switch anything on." },
    ],
    messagesHeading: "The exact wording: in hours, after hours and the reply",
    messagesIntro: "The first two messages are the plumber templates from our Missed-Call Text-Back Kit, word for word. The others are extra wording written for this page. Replace the bracketed parts and keep each text to one question.",
    messages: [
      { label: "In opening hours", when: "Sent about a minute after the missed call", text: "Hi, it's [business]. Sorry we missed your call, we're on a job. Is it a leak, a blocked drain or hot water? Reply here and we'll call [when].", source: "kit" },
      { label: "After hours", when: "Sent when the call came in outside your hours", text: "Hi, it's [business]. We're closed right now. If water is actively leaking, turn off the main tap. Tell us what's happening here and we'll call [when].", source: "kit" },
      { label: "When they reply with the problem", when: "Sent by you, by hand, after the first reply", text: "Thanks. A photo of the leak or of the label on the unit helps us bring the right parts. We'll ring you by [time] with a price and a time.", source: "page" },
      { label: "Property manager version", when: "Use when the number is saved as an agency", text: "Hi, it's [business]. Sorry we missed your call. Please reply with the property address, who gives access and your job reference, and we'll call [when].", source: "page" },
    ],
    messageNotes: [
      "Fill [when] with a real promise you keep, such as \"within 30 minutes\" in hours or \"at 7.30am\" after hours. A specific time beats \"soon\".",
      "Do not quote a price in the first text. You have not seen the job, and a number sent blind is hard to take back.",
      "Add \"Reply STOP to opt out\" to the end if your system does not do it for you. That is the wording ACMA itself gives as a clear SMS example.",
    ],
    exampleHeading: "Worked example: what a text back could recover for a one-van plumber",
    exampleIntro: "Every number below is an example I made up to show the method. They are not averages, and nobody measured them. Replace each one with your own from two weeks of call history.",
    example: { kind: "missed-calls", callsPerWeek: 25, missedPct: 24, replyPct: 40, bookPct: 50, jobValue: 380, weeks: 48 },
    stepsHeading: "How to set it up, in order",
    steps: [
      "Count first. Over two weeks, note every incoming call and how many went unanswered. Your phone's call history or your job app's call log has it. Without this count you cannot tell whether the fix is worth doing.",
      "Check what you already own. Some phone providers and job-management apps can send a missed call text. Look there before you build anything.",
      "If you want to run it yourself, the Missed-Call Text-Back Kit has two importable n8n workflows, one for Twilio and one for Cellcast or any phone system that can call a webhook. It skips landlines and withheld numbers and avoids texting the same caller twice.",
      "Edit the settings: business name, your mobile for the alert, opening hours and the [when] wording. The kit refuses to send until you have replaced the placeholders.",
      "Test it. Ring the number from a spare phone, let it ring out, and read the text that arrives. Do it once in hours and once after hours.",
      "Check the log after a week. Count the replies, count the jobs booked from them, and compare with your example numbers.",
    ],
    consentHeading: "Spam Act 2003: is it allowed to text someone who rang you?",
    consent: [
      "The Spam Act 2003 covers commercial electronic messages, and an SMS is one. The ACMA, which enforces the Act, says that if you send marketing messages you need the recipient's consent, the message must accurately identify you as the sender, and it must carry a working way to unsubscribe that you honour within 5 working days.",
      "A single text that answers the call the person just made to you, about the job they rang about, is a different thing from marketing sent to a list. Whether a given message counts as commercial depends on what it says, so keep the reply to their enquiry, name your business, add the opt-out line and do not use the same system to send offers. If you later want to send promotions, you need consent for those, and the ACMA notes you cannot send a message to ask for consent, because that message is itself marketing.",
      "A caller's phone number can be personal information. If your business is covered by the Privacy Act 1988, handle it under the Australian Privacy Principles, and tell people in your privacy policy that you may text those who ring you. Many small businesses under AU$3 million turnover are exempt, with exceptions, so check with the OAIC. This is general information, not legal advice.",
    ],
    faq: [
      { q: "Is missed call text back legal for plumbers in Australia?", a: "A reply to a person who has just rung you about a job, limited to that enquiry and carrying your business name and an opt-out line, is the low-risk end of the Spam Act. Anything that promotes your services to people who did not ask is marketing and needs consent. Read the ACMA guidance and get advice if unsure." },
      { q: "What should a plumber say in a missed call text?", a: "Say who you are, that you missed the call because you are on a job, and ask one question that sorts the work, such as leak, blocked drain or hot water. Promise a call back at a stated time." },
      { q: "Does the kit use AI or record calls?", a: "No. It is a plain rules-based n8n workflow with no AI and no call recording. It texts the caller and alerts you." },
      { q: "What about callers on a landline?", a: "A landline cannot receive a text, so the kit skips landlines and withheld numbers. Keep a voicemail greeting for those callers." },
    ],
    kit: { slug: "missed-call-text-back-kit", name: "Missed-Call Text-Back Kit", fit: "Two tested n8n workflows (Twilio and Cellcast or generic), plumber and nine other trade templates, a setup guide and a test suite. Not run against live Twilio or Cellcast by us, and it says so." },
    demo: { href: "/d/plumber/", label: "See an example plumber enquiry (made-up conversation)" },
    sources: [ACMA, SPAM_ACT, OAIC_APP],
    reviewed: "2026-11-28",
    published: "2026-11-28",
  },
  {
    trade: "electrician",
    problem: "missed-calls",
    tradeLabel: "Electricians",
    problemLabel: "Missed calls",
    keyword: "missed call text back electrician australia",
    title: "Missed Call Text Back for Electricians Australia",
    description: "Missed call text back for Australian electricians: safety-first wording with 000, quote and builder variants, a worked example and the Spam Act 2003 notes.",
    h1: "Missed call text back for electricians: safety-first wording that still wins the job",
    eyebrow: "Electricians x missed calls",
    lede: "An electrician's missed call is rarely the same as a plumber's. Half your enquiries are quotes for planned work, where the caller is ringing three businesses, and a few are genuine hazards. This page gives you the text that handles both: it protects the caller first, then collects what you need to price the job.",
    why: [
      "Electrical work splits into two kinds of call. Planned jobs such as a switchboard upgrade, an EV charger, extra power points or a fit-out are priced and compared, so a caller will often ring around and book the first tradie who responds sensibly. Faults are different: no power, a tripping safety switch, or a burning smell.",
      "The text has to be safe for the second kind and useful for the first. That is why the electrician wording below leads with 000 for danger, then asks an open question. It would be a mistake to send a plumber's \"is it a leak\" style question to someone with a scorching powerpoint.",
    ],
    scenariosHeading: "Five electrical situations and what the text should do in each",
    scenarios: [
      { t: "Part of the house has lost power", b: "The safety switch will not reset, or one circuit is dead. This is a fault call, usually same day. The text invites a few details, and your next message can ask whether anything was plugged in when it tripped, which narrows the cause before you drive out." },
      { t: "A switchboard upgrade or rewire quote", b: "A homeowner is getting three quotes for a board upgrade. Speed of reply and the quality of your first question count for more than price here. Ask for suburb, house age and whether the work is for a renovation or a sale, then book a site visit." },
      { t: "Smoke alarms for a rental", b: "A property manager or landlord needs alarms checked or replaced. The text asks for the number of bedrooms and levels. A property manager who gets a fast, clear reply is more likely to send the next job to you." },
      { t: "An EV charger or solar-adjacent job", b: "A caller wants a charger installed. Ask the make of the car, where the board sits and the distance to the parking spot, in your second message, not the first. The first text should only open the conversation." },
      { t: "A burning smell or sparks", b: "No text should try to diagnose this. The after-hours template tells the caller to ring 000 if there is a fire or someone is in danger. Check your own wording with your licensing body and insurer before you switch on any automatic reply." },
    ],
    messagesHeading: "The exact wording, including the 000 line",
    messagesIntro: "The first two messages are the electrician templates from our Missed-Call Text-Back Kit, word for word. The others were written for this page for you to adapt. Keep one question per text.",
    messages: [
      { label: "In opening hours", when: "Sent about a minute after the missed call", text: "Hi, it's [business]. Sorry we missed you, we're on a job. What do you need a hand with? Reply here with a few details and we'll call [when].", source: "kit" },
      { label: "After hours", when: "Sent when the call came in outside your hours", text: "Hi, it's [business]. We're closed right now. If it's a fire or someone is in danger, call 000. Otherwise tell us what's up here and we'll call [when].", source: "kit" },
      { label: "Quote enquiry follow-up", when: "Sent by you after they reply about planned work", text: "Thanks. To price this properly, what suburb is it in, roughly how old is the house, and is it for a renovation or a sale? We can usually look at it within [days].", source: "page" },
      { label: "Builder or site contact", when: "Use when a builder or project manager calls", text: "Hi, it's [business]. Sorry we missed you. Please reply with the site address, the stage the job is at and who we should ask for on site, and we'll call [when].", source: "page" },
    ],
    messageNotes: [
      "The electrician wording asks an open question on purpose. A fault call and a quote call both fit under \"what do you need a hand with\".",
      "Do not promise a price or a call time you may not keep for an emergency. Give a time only for the call back.",
      "Add \"Reply STOP to opt out\" if your system does not append it. It is the ACMA's own example of clear SMS unsubscribe wording.",
    ],
    exampleHeading: "Worked example: the arithmetic for a two-person electrical business",
    exampleIntro: "These numbers are an example only, chosen to show the method on higher-value work. They are not industry averages. Use your own call count and your own job value.",
    example: { kind: "missed-calls", callsPerWeek: 20, missedPct: 25, replyPct: 40, bookPct: 40, jobValue: 650, weeks: 46 },
    stepsHeading: "How to set it up, in order",
    steps: [
      "Decide your emergency line before anything else. Write the exact sentence about 000 that you are comfortable sending, and have your insurer or licensing body confirm you are happy with it.",
      "Count your missed calls for two weeks and separate planned-work enquiries from faults. The split tells you whether to put the quote question or the fault question first.",
      "Pick your tool. The Missed-Call Text-Back Kit runs on your own n8n with Twilio or Cellcast. If your phone system or job app already offers a missed call text, compare it before building.",
      "Edit the settings block: business name, your mobile for the alert, hours and the call-back wording. Keep the 000 line in the after-hours text.",
      "Test both versions from a spare phone, one in hours and one after hours, and read the messages on a small screen.",
      "After a week, write down how many replies were quotes and how many were faults, and adjust the first question to suit.",
    ],
    consentHeading: "Spam Act 2003: texting a caller back, and what changes for business callers",
    consent: [
      "The Spam Act 2003 sets the rules for commercial electronic messages, including SMS. The ACMA says marketing messages need the recipient's consent, must identify the business that authorised them with correct contact details, and must include an unsubscribe option that you honour within 5 working days.",
      "A reply to someone who has just phoned you, kept to their enquiry, sits closer to a service message than to marketing, but the test is the content of the message, not the intention. Keep it to the job, include your business name, keep the opt-out line, and keep promotions out of the same workflow.",
      "Do not assume a builder or property manager is outside the rules because the caller is a business. The ACMA's guidance is written for anyone who receives your message, so treat business callers the same way. If your business is covered by the Privacy Act 1988, a caller's number can be personal information under the Australian Privacy Principles. This is general information, not legal advice.",
    ],
    faq: [
      { q: "Should an electrician's missed call text mention 000?", a: "Yes for after-hours texts. The kit's after-hours electrician template says to call 000 if it is a fire or someone is in danger, then invites details for anything else. Decide your own emergency wording and do not rely on an automatic text for urgent safety situations." },
      { q: "What should I ask in the first text for planned work?", a: "Keep the first text open: what do you need a hand with. Then ask suburb, house age and the reason for the work in a second text, written by you, once they reply." },
      { q: "Can I text a builder or property manager who rang?", a: "The Spam Act does not step aside for business callers. A reply that stays on their enquiry, names your business and carries an opt-out line is the careful approach." },
      { q: "Is a missed call text a replacement for answering the phone?", a: "No. It holds the conversation until you can ring back. Nobody is replaced, and you still make the call." },
    ],
    kit: { slug: "missed-call-text-back-kit", name: "Missed-Call Text-Back Kit", fit: "Includes the electrician in-hours and after-hours templates with the 000 line, two tested n8n workflows and a setup guide. Not run against live Twilio or Cellcast by us, and it says so." },
    demo: { href: "/d/electrician/", label: "See an example electrician enquiry (made-up conversation)" },
    sources: [ACMA, SPAM_ACT, OAIC_APP],
    reviewed: "2026-11-28",
    published: "2026-11-28",
  },
  {
    trade: "builder",
    problem: "quote-follow-up",
    tradeLabel: "Builders",
    problemLabel: "Quote follow-up",
    keyword: "quote follow up email template builder",
    title: "Quote Follow Up for Builders: Texts and Emails",
    description: "How builders can follow up a quote without chasing: day-by-day text and email wording, a worked example with margin, and the Spam Act 2003 notes.",
    h1: "Quote follow up for builders: when to message, what to say and a worked example",
    eyebrow: "Builders x quote follow-up",
    lede: "A builder's quote is a big document sent to a nervous buyer, and silence afterwards is normal. The client is comparing two other quotes, waiting on finance or talking to a partner. This page gives you the follow-up sequence, the exact words for each step and an example of what one revived quote is worth.",
    why: [
      "Building quotes are different from a plumber's callout price. They run to tens or hundreds of thousands of dollars, take days to prepare, and sit with the owner for weeks. A silent quote is usually not a no. It is more often a decision the client has not made or a question they have not asked.",
      "That changes the follow-up. You are not chasing a payment or pushing a sale. You are offering to answer the question that is holding things up, and giving a clean way to say not now. The wording below is built around that.",
    ],
    scenariosHeading: "Five building situations and the follow-up each one needs",
    scenarios: [
      { t: "The client is comparing three builders", b: "Silence for a week is common. Your follow-up should not drop the price. Offer to walk through the inclusions and exclusions, because the cheapest quote often leaves things out and an owner comparing line by line will notice a clear scope." },
      { t: "Waiting on finance or approval", b: "A renovation depends on a bank or a council decision. Ask where they are in the process and say you will hold your programme slot for a stated period. That gives them a reason to reply and you a date to plan around." },
      { t: "Price shock on an extension", b: "The owner did not expect the number. A follow-up that offers to talk about staging the work or revisiting the scope keeps the conversation open without discounting." },
      { t: "An owner-builder wanting a rough figure", b: "These clients ask for an estimate and then disappear. Mark the document as an estimate, as the Quote-to-Cash Kit does, and follow up once to see if they want a firm quote." },
      { t: "A repeat client or a referral", b: "A past client who has asked for a quote on a second job deserves a call, not a template. Use the text only to book the call." },
    ],
    messagesHeading: "The follow-up sequence, with exact wording",
    messagesIntro: "These messages were written for this page. They are a suggested cadence from general practice, not a tested one, and the timings are yours to change. Send the first by text and the second by email so the quote document sits in front of them again.",
    messages: [
      { label: "Day 3 text", when: "Three days after sending the quote", text: "Hi [first name], it's [your name] from [business]. Just checking the quote for [job] came through okay. Happy to walk you through any line if that would help.", source: "page" },
      { label: "Day 7 email", when: "A week after the quote, subject: Your quote for [job]", text: "Hi [first name],\n\nI wanted to check in on the quote I sent on [date] for [job]. If you are comparing builders, I am happy to go through what is included and what is not, so the quotes are easy to compare like for like.\n\nWe can hold a start window in [month] for another [number] days. If the timing no longer works, just let me know and I will close the quote off.\n\nKind regards,\n[your name]\n[business], ABN [ABN]", source: "page" },
      { label: "Day 14 text", when: "Two weeks after the quote", text: "Hi [first name], [your name] from [business]. I will leave the quote for [job] with you. If you want to go ahead or have questions, reply here or call me on [number]. If it is not for you, no problem at all.", source: "page" },
      { label: "If they say not now", when: "Reply by you", text: "Thanks for letting me know, [first name]. I will keep the quote on file for [number] days. If your plans change, message me and we can update it.", source: "page" },
    ],
    messageNotes: [
      "Stop after the third message unless they reply. Three polite contacts over two weeks is firm without being a chase.",
      "Never add a deadline you will not honour. A real start window is fine; a made-up expiry is the kind of pressure that costs you the job.",
      "Keep the quote itself clear: scope, price, GST, inclusions and exclusions in plain words. Check your state's rules for written contracts and deposits above set values before relying on an emailed quote as a contract.",
    ],
    exampleHeading: "Worked example: what a revived quote is worth to a small builder",
    exampleIntro: "These are example numbers I chose to show the method. They are not industry statistics. Margin in particular varies widely, so use your own.",
    example: { kind: "quote-follow-up", quotesPerMonth: 10, silentPct: 40, revivePct: 25, winPct: 50, avgQuote: 38000, marginPct: 12 },
    stepsHeading: "How to run it, in order",
    steps: [
      "List every quote sent in the last 90 days and mark each as won, lost, or silent. The silent group is your follow-up list.",
      "Pick a cadence you can keep, such as day 3 by text, day 7 by email and day 14 by text, and write it in your job sheet so it is not left to memory.",
      "Put the follow-up date on the quote record at the time you send the quote. In the Tradie Quote-to-Cash Kit, quotes live in a Google Sheet with Quotes, Jobs and Invoices tabs, which gives you one place to see which quotes are silent.",
      "Send the first message by hand for the first month. You will learn which lines get replies before you automate anything.",
      "Record the outcome of every follow-up in the sheet: replied, won, lost, or no reply after three.",
      "After 90 days, compare your own revival rate with the example. Replace the example numbers with yours.",
    ],
    consentHeading: "Spam Act 2003: following up a quote the customer asked for",
    consent: [
      "A follow-up about a quote the person asked you for is closely tied to their enquiry. The Spam Act 2003 still applies to commercial electronic messages, and the ACMA says a message needs consent, must identify the sender and must carry an unsubscribe option that is honoured within 5 working days.",
      "Our Quote-to-Cash Kit's own compliance notes take the careful line: it sends only messages about an enquiry the customer made, a quote they asked for, a job they accepted and an invoice. If you add offers, newsletters or review requests, those need their own consent and an unsubscribe. The ACMA also says inferred consent does not automatically cover sending messages after someone has just bought something.",
      "In practice: ask for the customer's phone and email on the enquiry form with a tick box, keep a record of when they gave consent, include your business name, ABN and an opt-out line in every follow-up, and stop if they ask. This is general information, not legal advice.",
    ],
    faq: [
      { q: "How many times should a builder follow up a quote?", a: "There is no measured Australian figure we can cite. A common-sense limit is three contacts over about two weeks, spread across text and email, then stop unless they reply." },
      { q: "Should I offer a discount in the follow-up?", a: "No. Offer to explain the scope or stage the work. A discount in a follow-up tells the client the first price was soft." },
      { q: "Does the kit chase unaccepted quotes automatically?", a: "No. The Quote-to-Cash Kit turns an enquiry into a draft quote, an accepted quote into a job, a finished job into an invoice and sends payment reminders. Follow-ups on unaccepted quotes are written by you, using the wording on this page, until you decide to automate them." },
      { q: "Is a follow-up text allowed under the Spam Act?", a: "A follow-up limited to a quote the person requested, from an identified sender with an opt-out, is the careful approach. Promotions need consent." },
    ],
    kit: { slug: "tradie-quote-to-cash-kit", name: "Tradie Quote-to-Cash Automation Kit", fit: "Five importable n8n workflows from enquiry to quote, job, invoice and reminders, plus a Google Sheet. It does not send follow-ups on unaccepted quotes; this page's wording fills that gap. Not run on a live n8n by us, and it says so." },
    demo: { href: "/d/builder/", label: "See an example builder enquiry (made-up conversation)" },
    sources: [ACMA, SPAM_ACT, OAIC_APP],
    reviewed: "2026-11-28",
    published: "2026-11-28",
  },
  {
    trade: "plumber",
    problem: "invoice-chasing",
    tradeLabel: "Plumbers",
    problemLabel: "Invoice chasing",
    keyword: "chase unpaid invoice message tradie",
    title: "Chase Unpaid Invoices as a Plumber: Message Wording",
    description: "How plumbers can chase an unpaid invoice politely: 7, 14 and 30 day email wording, an SMS version, a worked example and Spam Act 2003 and ATO notes.",
    h1: "Chasing unpaid invoices as a plumber: polite messages at 7, 14 and 30 days",
    eyebrow: "Plumbers x invoice chasing",
    lede: "Plumbers do the work first and get paid later, so an unpaid invoice is your own cash sitting in someone else's account. Most late payers are not refusing; the invoice went to the wrong inbox, or it is waiting in an approval queue. This page gives you the exact words for three reminders and an example of what faster payment is worth.",
    why: [
      "A plumbing invoice goes to many kinds of payer: a homeowner who meant to transfer tonight, a property manager whose approval queue takes a fortnight, or a strata manager who pays on a meeting cycle. Each of them fails to pay for a different reason, so a good reminder is neutral, asks a question and makes paying easy.",
      "There is also a plumbing-specific leak: after-hours callouts done for a flat figure and never written up as a job, and invoices left until Sunday night. The best chaser is an invoice sent on the day the job finishes. The reminders below start from there.",
    ],
    scenariosHeading: "Five plumbing payers and how the reminder should differ",
    scenarios: [
      { t: "A homeowner who said they would transfer tonight", b: "Give it a few days, then a friendly reminder with the amount, the due date and your bank details. Most will pay. Keep the tone warm; this person may need you again." },
      { t: "A property manager with an approval queue", b: "The invoice often sits with an accounts team who never saw your first email. Ask who in accounts should receive it, and quote the work order number. Phone numbers beat inbox searches here." },
      { t: "A strata or body corporate", b: "These pay on a meeting cycle. Ask when the next payment run is, rather than pressing for today, and confirm the invoice is addressed to the right entity." },
      { t: "An after-hours callout nobody wrote up", b: "The most common leak is not late payment but no invoice. Set the rule that the invoice goes out the next morning, whatever the hour of the callout." },
      { t: "A dispute about the work", b: "If a customer says the job was not done properly, stop the reminders. Our Invoice Chaser kit has a pause list so a disputed invoice does not keep generating automatic emails." },
    ],
    messagesHeading: "The exact wording: three emails and one text",
    messagesIntro: "The three emails are the reminder templates from our Invoice Chaser for Xero kit, word for word, with the placeholders in double braces. The text is extra wording written for this page.",
    messages: [
      { label: "7 days overdue (email)", when: "Subject: Friendly reminder: invoice {{invoiceNumber}}", text: "Hi {{greetingName}},\n\nA quick note from {{businessName}}. Our records show that invoice {{invoiceNumber}} for {{amountDue}}, due on {{dueDate}}, is still open. It is now {{daysOverdue}} days past its due date.\n\nIf you have already paid, thank you, and please ignore this message. Payments can take a few days to reach us.\n\nPayment details:\n{{paymentDetails}}\n\nIf anything about the invoice looks wrong, just reply to this email and we will sort it out.\n\nKind regards,\n{{senderName}}\n{{businessName}}", source: "kit" },
      { label: "14 days overdue (email)", when: "Subject: Following up on invoice {{invoiceNumber}}", text: "Hi {{greetingName}},\n\nI am following up on invoice {{invoiceNumber}} for {{amountDue}}, which was due on {{dueDate}} and is now {{daysOverdue}} days overdue. We sent a reminder a week or so ago and have not yet seen payment.\n\nPayment details:\n{{paymentDetails}}\n\nIf the invoice is already paid, please reply with the payment date and we will match it on our side. If there is a question or a problem with the invoice, or the payment needs more time, please let us know so we can work something out together.\n\nKind regards,\n{{senderName}}\n{{businessName}}", source: "kit" },
      { label: "30 days overdue (email)", when: "Subject: Invoice {{invoiceNumber}} is 30 days overdue", text: "Hi {{greetingName}},\n\nInvoice {{invoiceNumber}} for {{amountDue}} was due on {{dueDate}} and is now {{daysOverdue}} days overdue. This is our last automatic reminder.\n\nWe would like to get this settled. If you can pay now, the details are below. If that is difficult, please reply and tell us what would work, such as a part payment or a payment plan, and we will talk it through.\n\nPayment details:\n{{paymentDetails}}\n\nIf this has already been paid or there is a dispute about the invoice, please reply and let us know, and we will look into it straight away.\n\nKind regards,\n{{senderName}}\n{{businessName}}", source: "kit" },
      { label: "Short text for a homeowner", when: "Optional, a day or two after the 7 day email", text: "Hi [first name], it's [business]. Invoice [number] for [amount] for the [hot water / drain / tap] job is showing as unpaid. Bank details are on the invoice, or reply here if anything needs sorting. Reply STOP to opt out.", source: "page" },
    ],
    messageNotes: [
      "The wording adds no interest, fees or threats. Only charge late fees if your written terms with the customer allow them.",
      "Put the invoice number, the amount and the due date in every message, so the person can act without hunting.",
      "If an invoice is $1,000 or more it also needs the buyer's identity or ABN to be a valid tax invoice. Check the ATO page linked below before you rely on your template.",
    ],
    exampleHeading: "Worked example: what faster payment is worth to a small plumbing business",
    exampleIntro: "These are example numbers I chose to show the method. They are not industry averages. The calculation is about cash sitting unpaid, not extra income.",
    example: { kind: "invoice-chasing", invoicesPerMonth: 20, latePct: 25, avgInvoice: 620, daysLateNow: 18, daysLateWith: 9 },
    stepsHeading: "How to set it up, in order",
    steps: [
      "Fix the invoice first. Send it on the day the job finishes, with a due date and how to pay on it. Check it meets the ATO tax invoice requirements if you are registered for GST.",
      "Record the due date for every invoice in one place. A late reminder cannot start until you can see which invoices are past due.",
      "Decide the three touch points: 7, 14 and 30 days overdue. Write who sends them and what you do if there is no reply.",
      "If you use Xero, the Invoice Chaser for Xero kit reads open invoices each weekday and sends each stage once, starting in dry run mode so you can read every email before anything is sent. If you do not use Xero, send the same wording by hand.",
      "Set up a pause list for disputes and payment plans before you switch it on.",
      "Review monthly: how many invoices paid after reminder one, two and three? That tells you which message is doing the work.",
    ],
    consentHeading: "Spam Act 2003 and reminders to a customer you have billed",
    consent: [
      "An invoice reminder to a customer who owes you money is a message about an existing transaction, not marketing. The Spam Act 2003 applies to commercial electronic messages, and the ACMA's guidance says a message must identify the sender and, if it is marketing, carry an unsubscribe option honoured within 5 working days.",
      "Keep reminders factual and keep promotions out of them. Do not add \"book your next service\" to a reminder, because that turns it into a message that promotes your business. Include your business name and contact details in every email and, for an SMS, a clear opt-out such as Reply STOP.",
      "Invoices themselves have their own rules. The ATO sets what a tax invoice must show, including the words tax invoice, your ABN, the date, a description and the GST amount, with extra buyer details at $1,000 or more. This is general information, not legal advice.",
    ],
    faq: [
      { q: "How soon should a plumber chase an unpaid invoice?", a: "Send the first reminder around 7 days after the due date, the second at 14 days and the last at 30 days, then talk to the customer by phone. These timings are a suggested cadence, not a measured standard." },
      { q: "Can I charge interest on a late plumbing invoice?", a: "Only if your written terms with the customer allow it. The kit's reminders add no interest, fees or threats. Get advice before any formal recovery step." },
      { q: "Do I need Xero to use these messages?", a: "No. The wording works by hand in any email. The kit automates the sending for Xero users." },
      { q: "What should I do when a customer disputes the work?", a: "Pause the reminders, ring the customer and work out what went wrong. Only resume once the dispute is settled." },
    ],
    kit: { slug: "invoice-chaser-xero", name: "Invoice Chaser for Xero", fit: "One n8n workflow that sends the three reminders above once each, with a pause list and a dry run mode. Needs Xero, n8n and an email account. Free n8n reminder templates exist, and the kit's own notes say so." },
    demo: { href: "/d/plumber/", label: "See an example plumber enquiry (made-up conversation)" },
    sources: [ACMA, SPAM_ACT, ATO_INV],
    reviewed: "2026-11-28",
    published: "2026-11-28",
  },
  {
    trade: "painter",
    problem: "review-requests",
    tradeLabel: "Painters",
    problemLabel: "Review requests",
    keyword: "review request text message template tradie",
    title: "Google Review Request Text for Painters: Templates",
    description: "Review request text and email wording for Australian painters, with a same-day trade template, a private feedback option, a worked example and Spam Act notes.",
    h1: "Google review request text for painters: templates, timing and what Google allows",
    eyebrow: "Painters x review requests",
    lede: "A painter's work is visible for years and discussed at barbecues, but most of it never reaches Google. The owner is happy, the scaffold is down, and nobody asks. This page gives you the text and email wording to ask every customer once, the timing that suits painting jobs, and the rules on what you may and may not do.",
    why: [
      "Painting jobs end cleanly. There is a clear last day, a walk around with the owner and a result they can see. That is the best moment to ask, because the customer is looking at the finished wall. For a plumber the job ends when the water stops; for a painter it ends on a day you can plan for.",
      "There is also a trap. It is tempting to ask only the customers who seemed happy. Google's own policy rules out soliciting content that does not represent a genuine experience, and offering anything in return. The method here asks everyone the same way.",
    ],
    scenariosHeading: "Five painting situations and how to ask in each",
    scenarios: [
      { t: "A full exterior repaint, finished today", b: "Ask on the final day after the walk-around, by text, when the result is in front of the customer. Keep it to one message with the review link and a private option." },
      { t: "An interior job for a landlord or agent", b: "The person who pays is not the person who lives there. Send the request to the person who dealt with you, and keep the wording about the work, not about the tenant." },
      { t: "A job with a touch-up callback", b: "Wait until after the touch-up. A request sent before a snag is fixed produces a worse review than the finished job deserves." },
      { t: "A customer who raised a concern at handover", b: "Do not skip them and do not push them. Send the same message as everyone else, and make sure the private feedback option is there. Then follow up personally using the service recovery wording." },
      { t: "A weather-delayed job", b: "Painting stops for rain. If the job ran long, a short thank-you for patience in the message goes down well, but keep the request itself the same as for every other customer." },
    ],
    messagesHeading: "The exact wording: text and email",
    messagesIntro: "The two text templates and the email are from our Google Review Request Engine, word for word, with placeholders in curly braces. Every customer gets the same two links, a Google review link and a private feedback form.",
    messages: [
      { label: "Same-day trade text", when: "Sent the day the job finishes", text: "Hi {first_name}, it was good to help with your {service} today. If you are happy to share your experience, here is our review page: {review_link} Or tell us privately: {feedback_link} Reply STOP to opt out. {business}", source: "kit" },
      { label: "Standard text", when: "Sent the day after, if you prefer a gap", text: "Hi {first_name}, thanks for choosing {business}. If you have a minute, we would value an honest review of your {service}: {review_link} Prefer to tell us privately? {feedback_link} Reply STOP to opt out.", source: "kit" },
      { label: "One-off reminder", when: "Once only, a few days later, to non-responders", text: "Hi {first_name}, a gentle one-off reminder from {business}. If you would like to share your experience, our review page is here: {review_link} Private feedback is welcome too: {feedback_link} Reply STOP to opt out.", source: "kit" },
      { label: "Email request", when: "Subject: How was your {service} with {business}?", text: "Hi {first_name},\n\nThank you for choosing {business} for your {service}. We would value an honest review of your experience.\n\nLeave a Google review: {review_link}\nPrefer to tell us privately? {feedback_link}\n\nBoth links are open to everyone, and there is no right or wrong answer. Reviews are voluntary and we do not offer anything in return for them.\n\nKind regards,\n{business}\nABN {abn}\n{contact_line}\n\nYou are receiving this because you recently used our service. Do not want these messages? Unsubscribe: {optout_link}", source: "kit" },
    ],
    messageNotes: [
      "Send the same two links to every customer. Do not remove the Google link from a message based on how you think the customer felt.",
      "Never offer a discount, a gift or a free touch-up in exchange for a review, or for changing or removing one.",
      "Send one request and one reminder, then stop. Texts under about 300 characters are easier to read on a phone.",
    ],
    exampleHeading: "Worked example: asking every customer instead of some",
    exampleIntro: "These are example numbers I chose to show the method. The share of people who leave a review varies a great deal, so treat the rate as a guess to replace with your own count.",
    example: { kind: "review-requests", jobsPerMonth: 12, askedNowPct: 25, askedAfterPct: 100, reviewPct: 30 },
    stepsHeading: "How to set it up, in order",
    steps: [
      "Get your Google review link. In your Business Profile, the share option gives a direct link to leave a review. The kit also includes a link builder from your Place ID.",
      "Ask for consent at the start of the job. Put a line on your quote or booking form asking whether they are happy to receive a text about the job, and a review request after, and keep the record of when they agreed.",
      "Choose the timing: the day the job finishes after any touch-ups, in daylight hours, not late at night.",
      "Use one set of wording for everyone. The Google Review Request Engine sends one request and one reminder from n8n by SMS through Twilio or by email, with a daily cap and a cooldown per customer.",
      "Set up the private feedback form and decide who reads it and how quickly you reply. A low private rating is a chance to fix a problem, not to hide one.",
      "Count monthly: jobs finished, requests sent, reviews received. Compare with the example.",
    ],
    consentHeading: "Spam Act 2003: are review requests allowed?",
    consent: [
      "A request for a review promotes your business, so the ACMA's rules for commercial electronic messages are the safe way to treat it. The ACMA says you need the recipient's consent, the message must identify the business that sent it and carry correct contact details, and it must include an unsubscribe option honoured within 5 working days.",
      "Express consent is best: a form, a tick box or a conversation, with a record of who agreed, when and how. The ACMA notes you cannot send a message to ask for consent. It also says inferred consent is not as reliable, and that it does not cover sending messages after someone has just bought something. So ask at the start of the job, not after it.",
      "Our Quote-to-Cash Kit's compliance notes say the same thing: review requests need their own consent and unsubscribe. This is general information, not legal advice.",
    ],
    faq: [
      { q: "Can a painter send a Google review request by text in Australia?", a: "Yes, with care. Treat it as a commercial message: get consent when you take the booking, name your business, include an opt-out such as Reply STOP, and honour it within 5 working days." },
      { q: "Can I offer a discount for a review?", a: "No. Google's policy does not allow offering incentives in exchange for posting a review or for changing or removing a negative one." },
      { q: "Should I only ask happy customers?", a: "No. Soliciting only happy customers does not represent a genuine range of experience. Send the same two links to everyone, a Google link and a private feedback option." },
      { q: "When is the best time to ask a painting customer?", a: "On the day the job finishes, after any touch-ups, once the customer has seen the result. This is a judgement based on how painting jobs end, not a measured figure." },
    ],
    kit: { slug: "google-review-engine", name: "Google Review Request Engine", fit: "Three n8n workflows, a Google Sheets tracker, SMS and email wording, a private feedback form and 52 automated checks. It promises no number of reviews." },
    demo: { href: "/d/painter/", label: "See an example painter enquiry (made-up conversation)" },
    sources: [ACMA, SPAM_ACT, GOOGLE_POLICY],
    reviewed: "2026-11-28",
    published: "2026-11-28",
  },
];

export const BACKLOG_NOTE = "Batch 1 of programmatic family 1. PLAN_90D caps new programmatic pages at 5 a week.";

export function getTradeProblem(trade: string, problem: string): TradeProblem | undefined {
  return TRADE_PROBLEMS.find((p) => p.trade === trade && p.problem === problem);
}

export function pagePath(p: Pick<TradeProblem, "trade" | "problem">): string {
  return `/automation/${p.trade}/${p.problem}`;
}

export type ExampleLine = { label: string; value: string };
export type ExampleResult = { lines: ExampleLine[]; headline: string; headlineLabel: string; note: string };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
const num = (n: number) => (Math.round(n * 100) / 100).toString();

/** Computes every worked-example line from its inputs, so the page can never show arithmetic that does not add up. */
export function computeExample(e: Example): ExampleResult {
  if (e.kind === "missed-calls") {
    const missed = (e.callsPerWeek * e.missedPct) / 100;
    const replies = (missed * e.replyPct) / 100;
    const jobs = (replies * e.bookPct) / 100;
    const weekly = jobs * e.jobValue;
    const yearly = weekly * e.weeks;
    return {
      lines: [
        { label: `${e.callsPerWeek} calls a week x ${e.missedPct}% missed`, value: `${num(missed)} missed calls a week` },
        { label: `${num(missed)} x ${e.replyPct}% reply to the text`, value: `${num(replies)} replies a week` },
        { label: `${num(replies)} x ${e.bookPct}% book a job`, value: `${num(jobs)} jobs a week` },
        { label: `${num(jobs)} x ${money(e.jobValue)} a job`, value: `${money(weekly)} a week` },
        { label: `${money(weekly)} x ${e.weeks} working weeks`, value: `${money(yearly)} a year` },
      ],
      headline: money(yearly),
      headlineLabel: "example yearly revenue from recovered jobs",
      note: "This is revenue, not profit, and it assumes the text actually changes what the caller does.",
    };
  }
  if (e.kind === "quote-follow-up") {
    const silent = (e.quotesPerMonth * e.silentPct) / 100;
    const revived = (silent * e.revivePct) / 100;
    const won = (revived * e.winPct) / 100;
    const value = won * e.avgQuote;
    const margin = (value * e.marginPct) / 100;
    return {
      lines: [
        { label: `${e.quotesPerMonth} quotes a month x ${e.silentPct}% go silent`, value: `${num(silent)} silent quotes` },
        { label: `${num(silent)} x ${e.revivePct}% answer a follow-up`, value: `${num(revived)} live conversation` },
        { label: `${num(revived)} x ${e.winPct}% turn into a signed job`, value: `${num(won)} jobs a month` },
        { label: `${num(won)} x ${money(e.avgQuote)} average quote`, value: `${money(value)} contract value a month` },
        { label: `${money(value)} x ${e.marginPct}% net margin`, value: `${money(margin)} a month before your own costs` },
      ],
      headline: money(value),
      headlineLabel: "example contract value a month",
      note: "Contract value is not profit. The margin line uses an example percentage, so replace it with your own.",
    };
  }
  if (e.kind === "invoice-chasing") {
    const late = (e.invoicesPerMonth * e.latePct) / 100;
    const owedNow = (late * e.avgInvoice * e.daysLateNow) / 30;
    const owedWith = (late * e.avgInvoice * e.daysLateWith) / 30;
    return {
      lines: [
        { label: `${e.invoicesPerMonth} invoices a month x ${e.latePct}% paid late`, value: `${num(late)} late invoices a month` },
        { label: `${num(late)} x ${money(e.avgInvoice)} x ${e.daysLateNow} days late / 30`, value: `${money(owedNow)} owed on average, today` },
        { label: `${num(late)} x ${money(e.avgInvoice)} x ${e.daysLateWith} days late / 30`, value: `${money(owedWith)} owed on average, with reminders` },
        { label: `${money(owedNow)} less ${money(owedWith)}`, value: `${money(owedNow - owedWith)} less cash waiting at any time` },
      ],
      headline: money(owedNow - owedWith),
      headlineLabel: "example cash back in your account on average",
      note: "This is cash arriving sooner, not extra income. It assumes reminders cut the average days late as shown, which you should test with your own invoices.",
    };
  }
  const nowAsked = (e.jobsPerMonth * e.askedNowPct) / 100;
  const afterAsked = (e.jobsPerMonth * e.askedAfterPct) / 100;
  const nowReviews = (nowAsked * e.reviewPct) / 100;
  const afterReviews = (afterAsked * e.reviewPct) / 100;
  return {
    lines: [
      { label: `${e.jobsPerMonth} jobs a month x ${e.askedNowPct}% asked by hand`, value: `${num(nowAsked)} customers asked` },
      { label: `${num(nowAsked)} x ${e.reviewPct}% leave a review`, value: `${num(nowReviews)} reviews a month` },
      { label: `${e.jobsPerMonth} jobs x ${e.askedAfterPct}% asked every time`, value: `${num(afterAsked)} customers asked` },
      { label: `${num(afterAsked)} x ${e.reviewPct}% leave a review`, value: `${num(afterReviews)} reviews a month` },
      { label: `${num(afterReviews)} less ${num(nowReviews)}, x 12 months`, value: `${num((afterReviews - nowReviews) * 12)} more reviews a year` },
    ],
    headline: num((afterReviews - nowReviews) * 12),
    headlineLabel: "example extra reviews a year",
    note: "The review rate is a guess. Count your own: requests sent against reviews received.",
  };
}
