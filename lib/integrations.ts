// Integration guides for five trade-software products. Everything here is based on each vendor's own
// documentation, API reference and marketplace pages as at November 2026. Titanos has NOT tested these
// integrations: no copy may say or imply otherwise (scripts/test_integrations.mjs checks the disclaimer).
// Where a vendor page could not be read or did not say, the guide says "not confirmed" rather than guess.

export const AS_AT = "November 2026";
export const REVIEWED = "2026-11-28";
export const REVIEWED_LABEL = "28 November 2026";

export type Source = { label: string; url: string };
export type TaskKey = "missed-call" | "quote-follow-up" | "reviews" | "invoices";
export type Status = "Built in" | "Partly built in" | "Needs Zapier, Make or the API" | "Not found in the documentation";

export type Task = {
  key: TaskKey;
  title: string;
  status: Status;
  native: string;
  viaTools: string;
  steps: string[];
  sources: Source[];
};

export type ExampleRow = { label: string; value: string };
export type Example = { title: string; intro: string; rows: ExampleRow[]; result: string; caveat: string };

export type Guide = {
  slug: "servicem8" | "tradify" | "simpro" | "fergus" | "jobber";
  name: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  targetTerms: string[];
  intro: string[];
  fit: string;
  tasks: Task[];
  example: Example;
  gaps: string[];
  faq: { q: string; a: string }[];
  siblingNote: string;
  moneyLead: string;
};

export const TASK_LABEL: Record<TaskKey, string> = {
  "missed-call": "Missed-call text-back",
  "quote-follow-up": "Quote follow-up",
  reviews: "Review requests",
  invoices: "Invoice reminders",
};

export const MONEY: Record<TaskKey, { href: string; label: string }> = {
  "missed-call": { href: "/tradies", label: "Job Flow for tradies" },
  "quote-follow-up": { href: "/products/quote-follow-up-playbook", label: "Quote Follow-Up Playbook for Tradies" },
  reviews: { href: "/products/course-ai-for-tradies", label: "AI for Tradies course" },
  invoices: { href: "/products/invoice-chasing-playbook", label: "Invoice Chasing Playbook" },
};

export const COMPLIANCE_SOURCES: Source[] = [
  { label: "ACMA: avoid sending spam (Spam Act 2003)", url: "https://www.acma.gov.au/avoid-sending-spam" },
  { label: "OAIC: privacy for businesses", url: "https://www.oaic.gov.au/privacy" },
];

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");

// ---------- worked-example arithmetic (all inputs are labelled examples, never measured data) ----------
function servicem8Example(): Example {
  const quotes = 40, avg = 2800, before = 0.3, after = 0.35, texts = 3, cents = 0.1;
  const extra = quotes * (after - before);
  return {
    title: "Example: an electrician chasing quotes with ServiceM8's Quote Follow Up",
    intro: "These are EXAMPLE numbers to show the arithmetic. They are not our data and not a promise of what you will see.",
    rows: [
      { label: "Quotes sent per month (example)", value: String(quotes) },
      { label: "Average quote value (example)", value: money(avg) },
      { label: "Win rate with no follow-up (example)", value: `${before * 100}%` },
      { label: "Win rate with a three-step follow-up (assumed)", value: `${after * 100}%` },
      { label: "Texts sent at most, three per quote (example)", value: String(quotes * texts) },
      { label: "Text cost if each credit were 10 cents (assumed)", value: money(quotes * texts * cents) },
    ],
    result: `${extra} extra jobs a month x ${money(avg)} = ${money(extra * avg)} of extra quoted work, against about ${money(quotes * texts * cents)} of texts.`,
    caveat: "The 5 point lift is an assumption you should replace with your own number after a month of real data. Check your plan for what a text credit actually costs.",
  };
}
function tradifyExample(): Example {
  const inv = 30, avg = 650, lateShare = 0.2, delay = 21, saved = 7;
  const late = inv * lateShare;
  return {
    title: "Example: a plumber switching on Tradify's automatic payment reminders",
    intro: "EXAMPLE numbers only, to show how to size the benefit for your own business.",
    rows: [
      { label: "Invoices sent from Tradify per month (example)", value: String(inv) },
      { label: "Average invoice (example)", value: money(avg) },
      { label: "Share paid late (example)", value: `${lateShare * 100}%` },
      { label: "Average days late (example)", value: String(delay) },
      { label: "Days saved by reminders (assumed)", value: String(saved) },
    ],
    result: `${late} late invoices x ${money(avg)} = ${money(late * avg)} waiting each month. If reminders pull payment in by ${saved} days, that ${money(late * avg)} lands ${saved} days sooner every month, a one-off cash-flow gain rather than extra revenue.`,
    caveat: "The days-saved figure is an assumption. Tradify's page does not state the reminder schedule, so read the schedule in your own account before relying on it.",
  };
}
function simproExample(): Example {
  const quotes = 12, avg = 9500, before = 0.25, after = 1 / 3;
  const wins0 = quotes * before, wins1 = Math.round(quotes * after);
  return {
    title: "Example: a commercial electrical firm following up quotes from simPRO",
    intro: "EXAMPLE numbers only. Larger quotes mean fewer of them, so one saved quote matters.",
    rows: [
      { label: "Quotes issued per month (example)", value: String(quotes) },
      { label: "Average quote value (example)", value: money(avg) },
      { label: "Quotes won today (example, 25%)", value: String(wins0) },
      { label: "Quotes won with a prompt follow-up (assumed, 4 of 12)", value: String(wins1) },
    ],
    result: `${wins1 - wins0} extra win a month x ${money(avg)} = ${money((wins1 - wins0) * avg)} of extra quoted work.`,
    caveat: "At this size you are comparing one extra win to the cost of a notification or a paid SMS feature. Your own win rate and quote values replace every number above.",
  };
}
function fergusExample(): Example {
  const jobs = 25, rate = 0.1, now = 1;
  const reviews = jobs * rate;
  return {
    title: "Example: a plumbing crew asking for a review after every Fergus job",
    intro: "EXAMPLE numbers only. Review volume depends on your customers and how easy the link is.",
    rows: [
      { label: "Jobs completed per month (example)", value: String(jobs) },
      { label: "Reviews you get today without asking (example)", value: String(now) },
      { label: "Share of customers who leave a review when asked (assumed)", value: `${rate * 100}%` },
    ],
    result: `${jobs} jobs x ${rate * 100}% = ${reviews} reviews a month, about ${reviews - now} more than today, or ${Math.round((reviews - now) * 12)} more a year.`,
    caveat: "Ten per cent is an assumption, not a benchmark. Track your own response rate for a month and replace it.",
  };
}
function jobberExample(): Example {
  const missed = 24, real = 0.5, book = 0.25, avg = 380;
  const enq = missed * real, jobs = enq * book;
  return {
    title: "Example: a landscaper answering missed calls through Jobber requests",
    intro: "EXAMPLE numbers only. Jobber's own pages did not describe a built-in missed-call feature, so this is the Zapier or Make route.",
    rows: [
      { label: "Missed calls per month (example)", value: String(missed) },
      { label: "Share that are real new enquiries (example)", value: `${real * 100}%` },
      { label: "Share of those who book after a text-back (assumed)", value: `${book * 100}%` },
      { label: "Average job (example)", value: money(avg) },
    ],
    result: `${missed} x ${real * 100}% = ${enq} enquiries, x ${book * 100}% = ${jobs} jobs, x ${money(avg)} = ${money(jobs * avg)} a month.`,
    caveat: "Both percentages are assumptions. Count your own missed calls for two weeks before deciding whether this is worth building.",
  };
}

const SPAM: Source = COMPLIANCE_SOURCES[0];

export const GUIDES: Guide[] = [
  {
    slug: "servicem8",
    name: "ServiceM8",
    h1: "ServiceM8 Automation for Tradies: Texts, Quotes, Reviews",
    metaTitle: "ServiceM8 Automation: Quotes, Reviews, Invoices",
    metaDescription: "What ServiceM8 automates itself and what needs Zapier, Make or the API: missed-call texts, quote follow-up, feedback and invoice reminders, with steps.",
    targetTerms: ["servicem8 automation", "servicem8 zapier", "servicem8 missed call text back", "servicem8 quote follow up"],
    intro: [
      "ServiceM8 is unusual among trade software because most of what a small business wants chased is already a built-in automation: quote follow-ups, payment follow-ups and feedback requests all live in its Automation add-on. The gap is the front of the funnel. ServiceM8's own help index shows no missed-call feature, so that one needs a phone tool and an integration.",
      "This guide separates the two. For each of the four jobs you get what ServiceM8 does natively, what needs Zapier, Make or the API, and the steps to set it up, each with a link to ServiceM8's own page. Everything is based on ServiceM8's documentation as at November 2026. We have not tested these integrations ourselves, so treat the Zapier and API routes as a build plan to verify in a trial, not as a recipe that is known to work.",
    ],
    fit: "ServiceM8 suits you here if you already pay for the Automation add-on, because three of the four jobs need no extra tool. The most useful thing to do first is the Quote Follow Up automation, since it is built in, takes minutes, and acts on money you have already quoted.",
    tasks: [
      {
        key: "missed-call",
        title: "Missed-call text-back in ServiceM8",
        status: "Needs Zapier, Make or the API",
        native: "We found no missed-call feature in the ServiceM8 help-centre index we read. The nearest native piece is the SMS you can send from inside a job once it exists, which is not triggered by a call.",
        viaTools: "Use a phone or VoIP service that can fire an action on a missed call and send the text itself. Zapier lists ServiceM8 pairings with several phone apps, and ServiceM8's Zapier app has actions named Create Client and Create Job, so a Zap can log the caller as a client or job once the phone tool reports the call. Make also has a ServiceM8 app that is supported by Make. Alternatively, ServiceM8's Messaging API sends email and SMS, but only from a Public Application using OAuth 2.0, with a daily sending quota and a maximum send rate, and some scopes such as publish_sms may incur account charges.",
        steps: [
          "In your phone or VoIP provider, find its missed-call or call-ended trigger. Read its documentation to confirm the trigger exists and what it passes on (caller number, time).",
          "Set the provider to send the text-back itself, so the customer hears from you within a minute, for example: \"Sorry we missed you, we are on a job. Reply with your suburb and what you need and we will call you back today.\"",
          "In Zapier, create a Zap with the phone provider as the trigger and ServiceM8 as the action. Choose Create Client first, then, if you want a job card, add Create Job.",
          "Map the caller number into the client's mobile field and put \"Missed call\" and the time in the job description so your office person sees where it came from.",
          "Test with your own phone before you turn it on, and check ServiceM8 afterwards for duplicate clients if the same person rings twice.",
        ],
        sources: [
          { label: "ServiceM8 on Zapier: triggers and actions", url: "https://zapier.com/apps/servicem8/integrations" },
          { label: "Make: ServiceM8 app", url: "https://www.make.com/en/integrations/servicem8" },
          { label: "ServiceM8 Messaging API overview", url: "https://developer.servicem8.com/docs/messaging-overview" },
          { label: "ServiceM8 API authentication", url: "https://developer.servicem8.com/docs/authentication" },
          SPAM,
        ],
      },
      {
        key: "quote-follow-up",
        title: "Quote follow-up in ServiceM8",
        status: "Built in",
        native: "The Quote Follow Up automation emails and/or texts clients after you send a quote. You choose up to 5 follow-ups, pick email, SMS or both for each, and set a delay for each, such as an SMS 3 hours later and an email 3 days later. It can also mark jobs with unaccepted quotes as Unsuccessful after a timeframe you set. It needs the Automation add-on, which ServiceM8 says is available on all plans, and each SMS uses a text credit from your plan.",
        viaTools: "Nothing external is needed. Zapier's ServiceM8 app lists a Job Queued and a New Job trigger, which could feed a separate CRM, but the built-in automation already cancels itself when the customer replies, accepts online, or you move the job to Work Order, Completed or Unsuccessful.",
        steps: [
          "Open Settings > ServiceM8 Add-ons and make sure Automation is activated.",
          "Go to Settings > Automation and click Edit next to Quote Follow Up.",
          "Choose how many follow-ups to send (the maximum is 5).",
          "For each one, pick email, SMS or both, and set its delay after the quote is sent.",
          "Write the template for each message. ServiceM8's Smart Assistant can generate or improve a draft; read it before saving.",
          "Optionally turn on the status update that marks unaccepted quotes Unsuccessful, and set the timeframe.",
          "Send a real quote to a contact on the job. The scheduled messages appear in the job's Diary, where a team member can also cancel them.",
        ],
        sources: [
          { label: "ServiceM8: Quote Follow Up Automation", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/quote-follow-up-automation" },
          { label: "ServiceM8: Automation overview", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/automation-overview" },
        ],
      },
      {
        key: "reviews",
        title: "Review requests in ServiceM8",
        status: "Partly built in",
        native: "ServiceM8 has a Customer Feedback add-on. Its help page says it collects feedback through a smart link you place in email signatures, your website or other materials; the customer gives a star rating and can write a short review. The Automation add-on also lists a Customer Feedback automation that requests feedback after a job invoice is paid, by text, email or both, and it needs the Customer Feedback add-on. The pages we read do not mention a Google review link.",
        viaTools: "If your goal is Google reviews specifically, the documented route is outside ServiceM8: ServiceM8's Zapier app has a Job Completed trigger, so a Zap can wait, then send your own text through an SMS app with your Google review link in it. We have not confirmed whether ServiceM8's own feedback message can carry a Google link, so check that before you build the Zap.",
        steps: [
          "Turn on the Customer Feedback add-on in your add-ons settings, then open the Customer Feedback automation from Settings > Automation.",
          "Choose text, email or both and read the message that will go out.",
          "To aim at Google instead, create a Zap: trigger ServiceM8 Job Completed, add a Delay step (for example one day), then an action in your SMS or email tool.",
          "Put your Google review link and the customer's first name in the message, and keep it one short sentence with one ask.",
          "Test on a job of your own and confirm only completed, paid jobs get the message.",
        ],
        sources: [
          { label: "ServiceM8: what the Customer Feedback add-on is for", url: "https://support.servicem8.com/help-center/servicem8-add-ons/customer-feedback/what-is-the-customer-feedback-add-on-for" },
          { label: "ServiceM8: Automation overview", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/automation-overview" },
          { label: "ServiceM8 on Zapier", url: "https://zapier.com/apps/servicem8/integrations" },
        ],
      },
      {
        key: "invoices",
        title: "Invoice reminders in ServiceM8",
        status: "Built in",
        native: "The Payment Follow Up automation requests payment from clients with overdue accounts by text, email or both. It is timed from when the job status changed to Completed and is sent only if the invoice is unpaid. Live Invoice Statements is a second option: it sends a client a statement of outstanding invoices weekly, every two weeks or monthly, enabled per client.",
        viaTools: "Not needed for the basic job. If you want reminders to reach another system, ServiceM8's webhooks can notify your own endpoint when a Job Payment object changes, but the payload lists only the changed field names and you must call the resource URL for values. Public OAuth apps must complete a subscription challenge.",
        steps: [
          "Confirm Automation is on under Settings > ServiceM8 Add-ons.",
          "In Settings > Automation, open Payment Follow Up and use its wizard.",
          "Set the delay from Completed to match your payment terms, so a client on 14-day terms is not chased on day 3.",
          "Choose channels and write the message: friendly first, firmer later, with your bank or payment link.",
          "For regular account customers, enable Live Invoice Statements per client and pick weekly, fortnightly or monthly.",
        ],
        sources: [
          { label: "ServiceM8: Automation overview", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/automation-overview" },
          { label: "ServiceM8 API: webhooks overview", url: "https://developer.servicem8.com/docs/webhooks-overview" },
        ],
      },
    ],
    example: servicem8Example(),
    gaps: [
      "We did not find an official ServiceM8 page describing a missed-call text-back feature.",
      "We could not confirm that ServiceM8's own feedback message can include a Google review link.",
      "ServiceM8's page states that webhooks are listed as a benefit of OAuth public applications and says API-key requests skip the subscription challenge, but does not say plainly whether an API key can receive webhooks. Ask ServiceM8 before you build on it.",
    ],
    faq: [
      { q: "Does ServiceM8 have missed-call text-back built in?", a: "We found no such feature in ServiceM8's help-centre index. The documented routes use a phone provider plus Zapier, Make or the ServiceM8 API, which we have not tested." },
      { q: "Do I need Zapier to chase quotes in ServiceM8?", a: "No. The Quote Follow Up automation is built in, supports up to 5 follow-ups by email, SMS or both, and needs the Automation add-on." },
      { q: "Does ServiceM8 send Google review requests automatically?", a: "ServiceM8 documents a Customer Feedback add-on and automation, but the pages we read do not mention a Google review link. A Zap on the Job Completed trigger is the documented route for sending your own message." },
    ],
    siblingNote: "Compare ServiceM8's built-in approach with the others below.",
    moneyLead: "ServiceM8 handles the chasing; what to say is the hard part.",
  },
  {
    slug: "tradify",
    name: "Tradify",
    h1: "Tradify Zapier and Automation Guide: What Is Built In",
    metaTitle: "Tradify Zapier and Automation: What Works Today",
    metaDescription: "Tradify automation explained from its own help pages: quote reminders, invoice reminders, texts, and what we could not find on Zapier, Make or an API.",
    targetTerms: ["tradify zapier", "tradify automation", "tradify quote reminders", "tradify invoice reminders"],
    intro: [
      "People search for \"tradify zapier\" expecting a connector. In the sources we checked there is none: we found no Tradify listing on Zapier or Make, and Tradify's integrations page lists Xero, QuickBooks and Stripe only. That is a finding, not a failure of the software, because Tradify builds the two chasing jobs most owners want straight into the product.",
      "So this guide is shorter on tools and longer on settings. It covers what Tradify does natively for quotes and invoices, the honest gap for missed calls and reviews, and one documented workaround that goes through your accounting package. It is based on Tradify's documentation as at November 2026, and we have not tested these integrations ourselves. Where a Tradify page was blocked to us or silent, we say so.",
    ],
    fit: "Tradify suits you here if your priority is quote and invoice chasing and you are happy to use its built-in reminders. If you need missed-call text-back or review automation wired into Tradify itself, you will be running those beside it, not inside it.",
    tasks: [
      {
        key: "missed-call",
        title: "Missed-call text-back with Tradify",
        status: "Not found in the documentation",
        native: "We found no missed-call feature in Tradify's help pages or features pages we could read, and no public API, Zapier app or Make app that would let an outside tool create a job in Tradify automatically.",
        viaTools: "The realistic route is to run text-back in your phone or VoIP service, which does not need Tradify at all, and enter genuine enquiries into Tradify by hand. If Tradify later publishes an API or connector, that is the day to automate the second half. Confirm with Tradify support before assuming either exists.",
        steps: [
          "Set up missed-call text-back in your phone provider or a standalone text-back tool, using its own documentation.",
          "Write the message to ask one question: \"Sorry we missed you. What do you need and what suburb are you in?\"",
          "Have the office person or you add real enquiries to Tradify as a new customer or job each morning.",
          "Ask Tradify support in writing whether a webhook, API or Zapier connection is available for your plan, and record the date of their answer.",
          "Check the Spam Act rules in the ACMA guidance below before you send any text that is more than a reply to the caller.",
        ],
        sources: [
          { label: "Tradify: integrations (Xero, QuickBooks, Stripe)", url: "https://www.tradifyhq.com/features/integrations" },
          SPAM,
        ],
      },
      {
        key: "quote-follow-up",
        title: "Quote follow-up in Tradify",
        status: "Built in",
        native: "Tradify has quote reminders you switch on in Settings > Quotes, with an option to send text reminders as well as email. Tradify's help material describes reminders going out 7 and 14 days after the quote is sent and 3 days before it expires, stopping when the quote is accepted, declined or expires. Text messages are optional, are switched on under Settings > Subscription & Billing, are available in Australia, New Zealand and the United Kingdom, and carry a per-message charge on top of your subscription.",
        viaTools: "Not needed. Because we found no Tradify connector, an external chaser is not a documented option today.",
        steps: [
          "Open Tradify's help article \"Turn on Quote Reminders\" and follow it for your account.",
          "In Settings > Quotes, switch on email reminders, then choose Send Text Reminders if you want texts.",
          "To use texts, enable them under Settings > Subscription & Billing and read the per-message price for your country.",
          "Check the reminder wording and your business name before you send a live quote.",
          "Send a quote to yourself, confirm the reminder is scheduled, and then accept it to confirm the reminders stop.",
        ],
        sources: [
          { label: "Tradify: Turn on Quote Reminders", url: "https://help.tradifyhq.com/hc/en-us/articles/360049096213-Turn-on-Quote-Reminders" },
          { label: "Tradify: Understanding text messages", url: "https://help.tradifyhq.com/hc/en-us/articles/26130939769497-Understanding-Text-Messages-in-Tradify" },
        ],
      },
      {
        key: "reviews",
        title: "Review requests with Tradify",
        status: "Not found in the documentation",
        native: "We found no review-request feature in the Tradify pages we could read.",
        viaTools: "One route is built on a documented fact: Tradify connects to Xero and QuickBooks, and both have apps on Zapier and Make. A Zap can watch your accounting package for a paid invoice and then send your review request. We have not confirmed the exact trigger names in those apps, so open the app in the Zapier editor and read its trigger list first.",
        steps: [
          "Confirm that your Tradify invoices sync to Xero or QuickBooks, using Tradify's integrations page.",
          "In Zapier or Make, create a scenario that triggers on a paid invoice in your accounting app. Check the trigger name in that app before building.",
          "Add a short delay, then an action in your SMS or email tool.",
          "Message the customer with one sentence and your Google review link.",
          "If you do not use the accounting route, put a saved reply on your phone and send it by hand when you mark a job paid. A manual habit is better than a broken automation.",
        ],
        sources: [
          { label: "Tradify: integrations", url: "https://www.tradifyhq.com/features/integrations" },
          { label: "Zapier app directory", url: "https://zapier.com/apps" },
          { label: "Make integrations", url: "https://www.make.com/en/integrations" },
        ],
      },
      {
        key: "invoices",
        title: "Invoice reminders in Tradify",
        status: "Built in",
        native: "Tradify's invoice reminder page says it will send emails or text messages that automatically follow up on unpaid invoices, and that you switch this on and it chases payment on any unpaid invoices sent from Tradify. The page does not state how often reminders go out or how to change the schedule, so read the schedule in your account.",
        viaTools: "Not needed.",
        steps: [
          "Open the reminder settings in your Tradify account and switch automatic payment reminders on.",
          "Read the schedule shown, since Tradify's public page does not give it.",
          "Decide whether texts are worth enabling for invoices; they carry a per-message charge.",
          "Check that your payment details and terms are on the invoice template, because the reminder only chases invoices sent from Tradify.",
        ],
        sources: [
          { label: "Tradify: invoice reminder software", url: "https://www.tradifyhq.com/nz/features/invoice-reminder-software-app" },
          { label: "Tradify: Understanding text messages", url: "https://help.tradifyhq.com/hc/en-us/articles/26130939769497-Understanding-Text-Messages-in-Tradify" },
        ],
      },
    ],
    example: tradifyExample(),
    gaps: [
      "We found no Tradify app on Zapier or Make and no public Tradify API in the sources we read. That is an observation about what we found, not proof that none exists.",
      "Tradify's help centre blocked our automated reader on two articles. The quote reminder timings (7 and 14 days, and 3 days before expiry) came from a summary of those articles, so confirm them in your own account.",
      "Tradify's invoice reminder page does not give a schedule.",
    ],
    faq: [
      { q: "Does Tradify work with Zapier?", a: "We found no Tradify app on Zapier in the sources we checked, and Tradify's integrations page lists Xero, QuickBooks and Stripe. Ask Tradify support before planning around Zapier." },
      { q: "Can Tradify send quote reminders automatically?", a: "Yes. Tradify documents quote reminders by email with an optional text reminder, switched on in Settings > Quotes." },
      { q: "Does Tradify chase unpaid invoices?", a: "Tradify says it can send emails or texts that follow up on unpaid invoices sent from Tradify. The public page does not give the schedule." },
    ],
    siblingNote: "Tradify is the built-in-first option; the others rely more on connectors.",
    moneyLead: "Tradify chases for you; the playbook helps you word it.",
  },
  {
    slug: "simpro",
    name: "simPRO",
    h1: "simPRO Missed Call Text-Back and Automation Guide",
    metaTitle: "simPRO Missed Call and Automation Guide",
    metaDescription: "How a trades business automates missed-call texts, quote follow-up, reviews and invoice reminders with simPRO: native Notifications, Zapier and the API.",
    targetTerms: ["simpro missed call", "simpro automation", "simpro zapier", "simpro quote follow up"],
    intro: [
      "simPRO sits at the bigger end of small trades software, and its automation story reflects that. Native communication is handled by Notifications that can send email, SMS or both on a schedule or when a workflow condition is met, and the Zapier app has a deep list of triggers and actions for customers, jobs, quotes and leads. What it does not have, in the pages we read, is a missed-call feature.",
      "This guide sorts the four jobs into what Notifications can do, what needs Zapier, Make or the API, and what is missing. It is based on simPRO's documentation as at November 2026. We have not tested these integrations ourselves, and simPRO's developer area asks you to register, so check access and rate limits with simPRO before you commit to a build.",
    ],
    fit: "simPRO suits you here if you run quotes and jobs through it already and need larger-ticket follow-up. Because quotes are fewer and bigger, the saved-quote arithmetic is strong, and Notifications can do the chasing without any outside tool if you pay for its SMS feature.",
    tasks: [
      {
        key: "missed-call",
        title: "Missed-call text-back with simPRO",
        status: "Needs Zapier, Make or the API",
        native: "We found no missed-call feature in simPRO's documentation.",
        viaTools: "Use a phone provider with a missed-call trigger that also sends the text, then log the caller in simPRO. Zapier's simPRO app has a Create Lead action, plus Find Individual Customer and Find or Create Individual Customer, so a Zap can look the caller up and create a lead only if they are new. The simPRO developer centre also documents a Web Hooks section for pushing events out, and the REST API for writing back.",
        steps: [
          "Configure missed-call text-back in your phone provider and confirm its trigger in its own documentation.",
          "In Zapier, trigger from the phone provider and add the simPRO action Find or Create Individual Customer so a repeat caller does not create a duplicate.",
          "Add Create Lead and map the number, the time and a note reading \"Missed call, text-back sent\".",
          "Check the lead appears in simPRO against the right pipeline, then run a test call.",
          "If you need something Zapier does not offer, read the simPRO developer centre and ask simPRO about API access first, as it may not be self-service.",
        ],
        sources: [
          { label: "simPRO on Zapier: triggers and actions", url: "https://zapier.com/apps/simpro/integrations" },
          { label: "simPRO developer centre", url: "https://developer.simprogroup.com/apidoc/" },
          SPAM,
        ],
      },
      {
        key: "quote-follow-up",
        title: "Quote follow-up in simPRO",
        status: "Partly built in",
        native: "simPRO's help guide says Notifications can send email and/or SMS regularly or when workflow requirements are met, and gives the example of reminding a salesperson to follow up on a lead. SMS requires registering and paying for the SMS feature in simPRO Premium. simPRO has also written about quote follow-up alerts based on a quote's due date.",
        viaTools: "Zapier's simPRO app has triggers named New Quote and Quote Updated and queries named Find Quote and Find Job. A Zap can start on New Quote, wait several days, find the quote again and only message the customer if it has not moved on. We have not confirmed what status fields the quote returns, so check that in the Zap editor.",
        steps: [
          "Read simPRO's How to Set Up Notifications article and check customer, employee and contractor contact details are correct.",
          "Create a notification triggered on the quote, with the condition and recipient the article describes, and choose email, SMS or both.",
          "If you want SMS, set up simPRO Premium SMS first; it is a paid feature.",
          "For a Zapier alternative, trigger on New Quote, add a Delay, use Find Quote, and use a Filter step so the message only goes if the quote is still open.",
          "Send the first batch to your own address and read every message before enabling it for customers.",
        ],
        sources: [
          { label: "simPRO help: How to set up notifications", url: "https://helpguide.simprogroup.com/Content/Service-and-Enterprise/Notifications.htm" },
          { label: "simPRO: automate communications with supercharged notifications", url: "https://www.simprogroup.com/blog/automate-communications-with-supercharged-notifications" },
          { label: "simPRO on Zapier", url: "https://zapier.com/apps/simpro/integrations" },
        ],
      },
      {
        key: "reviews",
        title: "Review requests with simPRO",
        status: "Needs Zapier, Make or the API",
        native: "We found no review-request feature in simPRO's documentation.",
        viaTools: "Zapier's simPRO app lists Job Updated as a trigger. A Zap can start on Job Updated, filter for the status you use for finished work, wait, then send your own review request through an email or SMS tool. Job Updated fires on any change, so the filter is essential, and you should store a flag so the same job is never asked twice.",
        steps: [
          "In Zapier, create a Zap with simPRO as the trigger and choose Job Updated.",
          "Add a Filter step that only continues when the job status is the one you use for completed work.",
          "Add a Delay of one to two days.",
          "Send a short text or email with your Google review link from your own SMS or email tool.",
          "Protect against repeats: write the job ID to a sheet or tag and add a step that stops the Zap if that ID is already there.",
        ],
        sources: [
          { label: "simPRO on Zapier", url: "https://zapier.com/apps/simpro/integrations" },
        ],
      },
      {
        key: "invoices",
        title: "Invoice reminders in simPRO",
        status: "Partly built in",
        native: "simPRO's help guide gives, as one of its examples for Notifications, sending customers a courtesy reminder before invoices are due, by email, SMS or both. SMS requires the paid Premium SMS feature.",
        viaTools: "Zapier's simPRO app, as listed on its page when we read it, shows no invoice trigger, so a Zap-based invoice reminder is not a documented option there. The developer centre lists customer invoices and customer payments among its API sections, which is the route if you need more, subject to simPRO's API access terms.",
        steps: [
          "Open simPRO's notifications help article and follow the Create a notification section.",
          "Select the trigger, condition type, delivery method and recipient the article lists, with a date-based schedule ahead of the due date.",
          "Write a courtesy message that includes the invoice number and payment details.",
          "Disable or adjust the notification for customers on special arrangements, using the filters the article describes.",
        ],
        sources: [
          { label: "simPRO help: How to set up notifications", url: "https://helpguide.simprogroup.com/Content/Service-and-Enterprise/Notifications.htm" },
          { label: "simPRO developer centre", url: "https://developer.simprogroup.com/apidoc/" },
        ],
      },
    ],
    example: simproExample(),
    gaps: [
      "simPRO's developer centre returned an access error to our reader, so the API and webhook details here come from simPRO's own help pages and Zapier's listing, not the API reference itself.",
      "We did not confirm which invoice events simPRO webhooks expose. Read the Web Hooks section before planning around them.",
      "Third-party sources say API access needs registration and manual approval and enforces a rate limit. We have not confirmed that with simPRO.",
    ],
    faq: [
      { q: "Does simPRO have a missed-call feature?", a: "We found none in simPRO's documentation. The documented route is a phone provider plus Zapier, Make or the simPRO API, which we have not tested." },
      { q: "Can simPRO send quote follow-up texts?", a: "simPRO Notifications can send email and SMS on a schedule or workflow condition. SMS needs the paid Premium SMS feature." },
      { q: "Is there a simPRO Zapier integration?", a: "Yes. Zapier lists a simPRO app with triggers such as New Job, Job Updated, New Quote and Quote Updated, and actions such as Create Lead and Create Service Quote." },
    ],
    siblingNote: "simPRO leans on Notifications; ServiceM8 and Jobber lean on built-in automations.",
    moneyLead: "A bigger quote deserves a better follow-up message.",
  },
  {
    slug: "fergus",
    name: "Fergus",
    h1: "Fergus Automation Guide: Zapier, Reviews and Quote Chasing",
    metaTitle: "Fergus Automation: Zapier, Reviews and Quotes",
    metaDescription: "What Fergus job software offers through Zapier and its open API for missed-call texts, quote follow-up, review requests and invoice reminders, with steps.",
    targetTerms: ["fergus zapier", "fergus job management automation", "fergus review requests", "fergus quote follow up"],
    intro: [
      "Fergus takes a connector-first approach. Its help centre has an official Zapier integration article saying Fergus works through its newer open API and can be either a trigger or an action in a Zap, and Zapier's Fergus app lists six triggers and six actions. In the pages we read, Fergus does not document built-in automatic follow-ups, so most of this guide is Zap design.",
      "Everything here is based on Fergus's documentation as at November 2026. We have not tested these integrations ourselves. Fergus's own article is brief, giving examples rather than a full list, so the exact trigger and action names below come from Zapier's Fergus listing and may change. Read the Zap editor's list before you build.",
    ],
    fit: "Fergus suits you here if you are comfortable building a few Zaps, or paying someone to, and you want the follow-ups to live outside the job software so you can change the wording freely. It gives you the cleanest review-request route of the five, through the Job Completion trigger.",
    tasks: [
      {
        key: "missed-call",
        title: "Missed-call text-back with Fergus",
        status: "Needs Zapier, Make or the API",
        native: "We found no missed-call feature in Fergus's documentation.",
        viaTools: "Run text-back in your phone provider and use a Zap to log the caller in Fergus. Zapier's Fergus app has actions named Create Customer and Create Job, and queries named Find Customer and Find Job.",
        steps: [
          "Set up missed-call text-back in your phone provider using its documentation.",
          "In Zapier, trigger on the provider's missed-call event.",
          "Add Find Customer in Fergus by phone number so you do not create duplicates, then Create Customer only if nothing is found.",
          "Add Create Job with a title such as \"Missed call, call back\" and the time of the call.",
          "Connect your Fergus account in Zapier, entering your 2FA code if you have it switched on, as the Fergus help article says.",
        ],
        sources: [
          { label: "Fergus help: Zapier integration", url: "https://help.fergus.com/en/articles/11644092-zapier-integration" },
          { label: "Fergus on Zapier", url: "https://zapier.com/apps/fergus-1/integrations" },
          SPAM,
        ],
      },
      {
        key: "quote-follow-up",
        title: "Quote follow-up in Fergus",
        status: "Needs Zapier, Make or the API",
        native: "We found no built-in quote follow-up automation in the Fergus pages we read.",
        viaTools: "Zapier's Fergus app has New Quote and Modified Quote triggers, a Get Quotes for Job query and a Find All Quotes query. A Zap can start on New Quote, wait, then check the quote again before sending. We have not confirmed which fields those queries return, so check whether the quote's status is available.",
        steps: [
          "In Zapier, create a Zap with Fergus New Quote as the trigger.",
          "Add a Delay step for the first follow-up, for example two days.",
          "Add the Fergus query Get Quotes for Job and read the returned fields in the Zap editor to see if a status or accepted flag is included.",
          "If a status is available, add a Filter step so the message only continues for open quotes. If it is not, do not send automatically; send yourself a reminder instead.",
          "Send the follow-up from your SMS or email tool, then repeat with a second Delay for a later nudge.",
        ],
        sources: [
          { label: "Fergus on Zapier: triggers, actions and queries", url: "https://zapier.com/apps/fergus-1/integrations" },
          { label: "Fergus help: Zapier integration", url: "https://help.fergus.com/en/articles/11644092-zapier-integration" },
        ],
      },
      {
        key: "reviews",
        title: "Review requests with Fergus",
        status: "Needs Zapier, Make or the API",
        native: "We found no built-in review-request feature in the Fergus pages we read.",
        viaTools: "This is Fergus's strongest route. Zapier's Fergus app has a Job Completion trigger. Pair it with a Delay and your own message.",
        steps: [
          "In Zapier, trigger on Fergus Job Completion.",
          "Add a Delay of one day, so the request lands after the customer has seen the work.",
          "Use Get Customer by ID to fetch the customer's mobile and first name.",
          "Send one text or email with your Google review link from your own SMS or email tool.",
          "Run it on a test job first and confirm that a job reopened and re-completed does not message the customer twice.",
        ],
        sources: [
          { label: "Fergus on Zapier", url: "https://zapier.com/apps/fergus-1/integrations" },
        ],
      },
      {
        key: "invoices",
        title: "Invoice reminders with Fergus",
        status: "Not found in the documentation",
        native: "We found no invoice-reminder feature in the Fergus pages we read.",
        viaTools: "Zapier's Fergus app, as listed when we read it, has no invoice trigger or action, so a Zap-based invoice reminder is not a documented option there. We could not read Fergus's own API reference. If Fergus exposes invoices through its open API, that is the route; ask Fergus support. Otherwise chase from whichever accounting package actually issues the invoice, using that package's own reminder feature.",
        steps: [
          "Ask Fergus support whether invoices are available through the open API or Zapier, and keep their reply.",
          "If your invoices are issued from an accounting package, switch on that package's reminder feature and read its schedule.",
          "Keep a simple list of overdue jobs and a saved message to send by hand until an automated route is confirmed.",
        ],
        sources: [
          { label: "Fergus help: Zapier integration", url: "https://help.fergus.com/en/articles/11644092-zapier-integration" },
        ],
      },
    ],
    example: fergusExample(),
    gaps: [
      "Fergus's help article gives examples only, not a full trigger and action list; the names here come from Zapier's Fergus listing.",
      "We could not read Fergus's own developer documentation, so we make no claim about its webhooks, endpoints or rate limits.",
      "We did not confirm which fields the Fergus quote queries return in Zapier.",
    ],
    faq: [
      { q: "Does Fergus work with Zapier?", a: "Yes. Fergus has an official help article for its Zapier integration, which says Fergus can be a trigger or an action. Zapier lists six triggers and six actions." },
      { q: "Can Fergus send review requests automatically?", a: "We found no built-in feature. The documented route is a Zap on the Job Completion trigger, which we have not tested." },
      { q: "Does Fergus chase unpaid invoices?", a: "We found no invoice reminder in Fergus's pages and no invoice trigger in Zapier's Fergus listing. Ask Fergus support about the open API." },
    ],
    siblingNote: "Fergus is the connector-first option, the opposite of Tradify.",
    moneyLead: "Zaps send the message; you still need to write it well.",
  },
  {
    slug: "jobber",
    name: "Jobber",
    h1: "Jobber Zapier Guide: Reviews, Quotes and Invoice Follow-Up",
    metaTitle: "Jobber Zapier and Automation: Reviews and Quotes",
    metaDescription: "Jobber's built-in follow-ups for quotes, invoices and Google reviews, plus where Zapier or Make fills the gap for missed-call texts, with steps and examples.",
    targetTerms: ["jobber zapier", "jobber automation", "jobber missed call text", "jobber review requests"],
    intro: [
      "Jobber is the one of the five that advertises the full set of chasing jobs on its own features page: automated follow-ups for pending quotes and unpaid invoices, and Google review requests after every job. What its page does not describe is a missed-call feature, and that is where Zapier or Make comes in.",
      "This guide is based on Jobber's documentation and marketplace pages as at November 2026. We have not tested these integrations ourselves. Jobber's features page does not state timing options or plan requirements for its automations, so we give what the pages say and send you to Jobber's pricing page for the rest.",
    ],
    fit: "Jobber suits you here if you want the least setup: three of the four jobs are built in and the fourth has a documented connector. Make also lists a Jobber app that it describes as supported and maintained by the vendor.",
    tasks: [
      {
        key: "missed-call",
        title: "Missed-call text-back with Jobber",
        status: "Needs Zapier, Make or the API",
        native: "Jobber's automations page does not describe a missed-call or missed-text automation. It mentions appointment reminders and on-my-way texts, which are different.",
        viaTools: "Use your phone provider for the text-back and a Zap or Make scenario to log the enquiry. Zapier's Jobber app has actions named Create Client, Create Request and Add Note to Request, and a Find Client action. Make lists a Jobber app that is supported and maintained by Jobber, and its page describes adding new leads into Jobber and sending SMS or email notifications.",
        steps: [
          "Set up missed-call text-back in your phone provider and read its documentation for the trigger.",
          "In Zapier, add a Zap with that trigger, then the Jobber action Find or Create Client so a repeat caller is not duplicated.",
          "Add Create Request with the phone number and \"Missed call\" in the details, so it lands in your Requests list.",
          "Test with your own phone and check the request appears once.",
          "Read the Jobber help centre on requests and decide who checks the list each morning.",
        ],
        sources: [
          { label: "Jobber on Zapier: triggers and actions", url: "https://zapier.com/apps/jobber/integrations" },
          { label: "Make: Jobber app", url: "https://www.make.com/en/integrations/jobber" },
          SPAM,
        ],
      },
      {
        key: "quote-follow-up",
        title: "Quote follow-up in Jobber",
        status: "Built in",
        native: "Jobber's pages describe automated follow-ups for pending quotes by email or text that remind the client to review and approve. Jobber's wording on timing varies by page, with one saying you can choose when to send reminders, from an hour after a client views a quote to several days later. The page we read does not list plan requirements.",
        viaTools: "Not needed. If you want a sequence in another system, Zapier's Jobber app has New Quote Created, Quote Sent and Quote Approved triggers.",
        steps: [
          "Open Jobber's automations settings and find the quote follow-up option.",
          "Choose email, text or both and set the timing to match how fast your customers decide.",
          "Edit the wording so it sounds like you, with one clear next step.",
          "Check Jobber's pricing page to confirm the automation is included on your plan.",
          "Send a quote to your own address and confirm the follow-up stops once you approve it.",
        ],
        sources: [
          { label: "Jobber: automations", url: "https://www.getjobber.com/features/automations/" },
          { label: "Jobber on Zapier", url: "https://zapier.com/apps/jobber/integrations" },
        ],
      },
      {
        key: "reviews",
        title: "Review requests in Jobber",
        status: "Built in",
        native: "Jobber's automations page says it can automatically send Google review requests after every job. The page does not list timing options.",
        viaTools: "To use a separate review tool, Zapier's Jobber app has a Job Closed trigger, and Jobber's own Academy article on Zapier lists job completions among its triggers. Zapier also lists templates that send review requests to third-party review tools when a Jobber invoice or quote changes.",
        steps: [
          "Open Jobber's automations settings and switch on review requests.",
          "Follow Jobber's own prompts to add your Google review link.",
          "Check what the message says and whether it goes by email or text.",
          "If you use another review tool, create a Zap on Job Closed with a Delay and that tool's action instead, and turn off Jobber's version so customers are not asked twice.",
        ],
        sources: [
          { label: "Jobber: automations", url: "https://www.getjobber.com/features/automations/" },
          { label: "Jobber Academy: Jobber and Zapier integrations", url: "https://www.getjobber.com/academy/best-jobber-zapier-integrations/" },
        ],
      },
      {
        key: "invoices",
        title: "Invoice reminders in Jobber",
        status: "Built in",
        native: "Jobber's pages describe automated follow-ups for unpaid invoices, sent as email or text, reminding clients to pay. The page does not specify the schedule.",
        viaTools: "Not needed for a basic reminder. Zapier's Jobber app lists New Invoice Created and Invoice Updated triggers if you want an alert in Slack or a spreadsheet.",
        steps: [
          "Open the automations settings and switch on the invoice follow-up.",
          "Read the schedule and the message Jobber will send.",
          "Match your payment terms, and keep the tone friendly in the first reminder.",
          "Spot-check one real overdue invoice a week for the first month.",
        ],
        sources: [
          { label: "Jobber: automations", url: "https://www.getjobber.com/features/automations/" },
          { label: "Jobber on Zapier", url: "https://zapier.com/apps/jobber/integrations" },
        ],
      },
    ],
    example: jobberExample(),
    gaps: [
      "Jobber's developer documentation blocked our automated reader, so we make no claim about its API or webhooks beyond what Make and Zapier list.",
      "Jobber's automations page does not state timing options or plan requirements, and one source's timing conflicts with a Zapier template's fixed delay. Confirm both in your account.",
      "We found no built-in missed-call feature, which is an observation about the pages we read.",
    ],
    faq: [
      { q: "Does Jobber send Google review requests automatically?", a: "Jobber's automations page says it can automatically send Google review requests after every job. It does not list timing options." },
      { q: "Is there a Jobber Zapier integration?", a: "Yes. Zapier lists a Jobber app with eleven triggers, such as New Quote Created, Quote Approved, New Invoice Created and Job Closed, and eight actions." },
      { q: "Can Jobber do missed-call text-back?", a: "We found no built-in missed-call feature. The documented route is a phone provider plus a Zapier or Make scenario that creates a Jobber request." },
    ],
    siblingNote: "Jobber is the closest to all-in-one of the five.",
    moneyLead: "Jobber sends the messages, but the wording is what gets replies.",
  },
];

export function getGuide(slug: string): Guide {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) throw new Error(`unknown integration guide: ${slug}`);
  return g;
}

export const HUB = {
  metaTitle: "Trade Software Automation: ServiceM8, Tradify, simPRO",
  metaDescription: "Compare how ServiceM8, Tradify, simPRO, Fergus and Jobber handle missed-call texts, quote follow-up, reviews and invoice reminders, from vendor documentation.",
  h1: "Trade Software Automation Guides: ServiceM8, Tradify, simPRO, Fergus and Jobber",
  faq: [
    { q: "Which trade software has the most built-in follow-up automation?", a: `From the vendor pages we read as at ${AS_AT}, Jobber and ServiceM8 document built-in quote, invoice and review follow-ups. Tradify documents quote and invoice reminders. simPRO uses Notifications. Fergus relies on Zapier.` },
    { q: "Have you tested these integrations?", a: "No. Every guide is based on the vendor's own documentation, API reference and marketplace pages, and says so. Treat any Zapier, Make or API route as a plan to trial before you rely on it." },
    { q: "Can I text customers automatically in Australia?", a: "Commercial messages are covered by the Spam Act 2003. Read the ACMA guidance on consent and identification before you automate anything beyond replying to someone who has just contacted you. This is general information, not legal advice." },
  ],
};
