import type { Guide } from "@/lib/guides";

export const servicem8Automation: Guide = {
  slug: "servicem8-automation-tradies",
  seoTitle: "ServiceM8 Automation for Tradies: What to Turn On",
  h1: "ServiceM8 Automation for Tradies: What Is Built In and What Needs Extra Tools",
  description:
    "What ServiceM8 automates on its own (quote follow-up, payment reminders, feedback) and what needs Zapier, Make or the API, with settings paths and sources.",
  answer:
    "ServiceM8's Automation add-on follows up unaccepted quotes, nudges unpaid invoices and asks for feedback after a job. A text to a caller you missed is not something we found in ServiceM8's help centre, so it needs a phone tool and a connector. We have not tested these set-ups in a live account.",
  cluster: "Job software",
  targetTerms: ["servicem8 automation", "servicem8 quote follow up", "servicem8 zapier", "servicem8 missed call text back", "servicem8 payment reminders"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "Most tradies who pay for ServiceM8 use it as a diary and an invoicing tool. Fewer have switched on the parts that chase money for them. ServiceM8 has an Automation add-on that follows up unaccepted quotes, nudges unpaid invoices and asks for feedback after a job. Those three are built in. The fourth job most owners want, a text to a caller you missed, is not something we could find in ServiceM8's help centre, so it needs a phone tool and a connector.",
    },
    {
      t: "p",
      x: "This guide goes through each job in turn: what ServiceM8 does by itself, what needs Zapier, Make or the ServiceM8 API, the settings to open and the sources we used. It is based on ServiceM8's own documentation as at November 2026. We have not tested these set-ups in a live ServiceM8 account, so treat anything marked as needing an outside tool as a plan to prove in a trial before you rely on it.",
    },
    {
      t: "note",
      title: "Short answer",
      x: "Switch on Quote Follow Up first. It is built in, takes a few minutes and works on quotes you have already sent. Then Payment Follow Up, then feedback. Missed-call text-back is the one that needs a separate tool.",
    },
  ],
  sections: [
    {
      id: "what-is-built-in",
      h2: "What ServiceM8 automates by itself",
      blocks: [
        {
          t: "p",
          x: "ServiceM8 groups its chasing features under the Automation add-on, which ServiceM8 says is available on all plans. You activate it in Settings under ServiceM8 Add-ons, then configure each automation from Settings and Automation. Text messages sent by these automations use text credits from your plan, so a busy month of follow-ups has a small running cost on top of the subscription.",
        },
        {
          t: "table",
          caption: "ServiceM8 chasing jobs at a glance (from ServiceM8's help centre, November 2026)",
          head: ["Job", "Built in?", "Where to find it", "Needs an outside tool?"],
          rows: [
            ["Quote follow-up", "Yes, up to 5 follow-ups by email, text or both", "Settings, Automation, Quote Follow Up", "No"],
            ["Payment follow-up", "Yes, for overdue invoices", "Settings, Automation, Payment Follow Up", "No"],
            ["Customer feedback request", "Yes, needs the Customer Feedback add-on", "Settings, Automation, Customer Feedback", "Only if you want a Google review link"],
            ["Missed-call text-back", "We found no such feature", "Not applicable", "Yes, a phone tool plus Zapier, Make or the API"],
          ],
        },
        {
          t: "p",
          x: "The practical reading of that table is that three of the four jobs cost you nothing beyond the add-on and the text credits. The money question is mostly about which one to set up first, not whether to buy new software. Our wider guide to [tradie automation in Australia](/guides/tradie-automation-australia) explains how these jobs fit together and which one tends to pay back fastest.",
        },
      ],
    },
    {
      id: "quote-follow-up",
      h2: "Quote follow-up in ServiceM8",
      blocks: [
        {
          t: "p",
          x: "A quote that is sent and never answered is one of the most common leaks in a trade business. The customer is not saying no. They are busy, they forgot or they are waiting for you to nudge them. If you want the longer argument for chasing quotes, read our post on [dead quotes and hidden revenue](/blog/dead-quotes-hidden-revenue).",
        },
        {
          t: "p",
          x: "ServiceM8's Quote Follow Up automation emails, texts or does both after you send a quote. You can set up to five follow-ups, choose the channel for each and set a delay for each one. ServiceM8's own example is a text three hours after the quote and an email three days after. It can also mark jobs with unaccepted quotes as Unsuccessful after a timeframe you choose, which keeps your quote list honest.",
        },
        {
          t: "p",
          x: "The follow-ups cancel themselves in the cases you would want: when the customer replies, accepts the quote online or when you move the job to Work Order, Completed or Unsuccessful. Scheduled messages show in the job's Diary, and a team member can cancel one by hand.",
        },
        { t: "h3", x: "Set-up steps" },
        {
          t: "ol",
          x: [
            "Open Settings and ServiceM8 Add-ons, and make sure Automation is activated.",
            "Go to Settings and Automation, then choose Edit next to Quote Follow Up.",
            "Choose how many follow-ups you want. The maximum is five.",
            "For each one pick email, text or both, and set the delay after the quote was sent.",
            "Write each message. ServiceM8 has a Smart Assistant that can draft or improve wording. Read the result before you save it, because it goes out under your business name.",
            "Optionally turn on the status update that marks unaccepted quotes Unsuccessful, and set the timeframe.",
            "Send a real quote to a contact on a test job and check that the scheduled messages appear in the Diary.",
          ],
        },
        { t: "h3", x: "What to write" },
        {
          t: "p",
          x: "Keep each message short, specific and easy to answer. The first should be a friendly check that the quote arrived. The second can offer to answer questions or adjust the scope. A last one can say you will hold the price or the booking slot until a date you actually intend to honour. Do not invent a deadline you will not keep. Our post with [quote follow-up text message examples for tradies](/blog/quote-follow-up-text-message-examples-tradies) has wording you can adapt.",
        },
        {
          t: "example",
          title: "Example sequence (wording only, adjust to your voice)",
          x: [
            "Follow-up 1, text, a few hours later: \"Hi Sam, it's Priya from Lakeside Electrical. Just checking the quote for the switchboard upgrade came through okay. Any questions, reply here.\"",
            "Follow-up 2, email, a few days later: a short email that restates the scope in one line, says what is included, and offers a phone call if the customer wants to change anything.",
            "Follow-up 3, text, about a week later: \"Hi Sam, we can still fit you in the week of the 14th if you'd like to go ahead. No pressure either way, just let me know.\"",
          ],
        },
        {
          t: "p",
          x: "Names in that example are made up. The point is the shape: one question per message, no pressure and a clear way to reply.",
        },
      ],
    },
    {
      id: "payment-follow-up",
      h2: "Payment reminders and invoice statements",
      blocks: [
        {
          t: "p",
          x: "The Payment Follow Up automation asks clients with overdue invoices to pay, by text, email or both. ServiceM8 times it from when the job status changed to Completed, and it only goes out if the invoice is still unpaid. A second feature, Live Invoice Statements, sends a client a statement of their outstanding invoices weekly, fortnightly or monthly. You switch it on per client, which suits account customers such as builders and property managers.",
        },
        { t: "h3", x: "Match the timing to your terms" },
        {
          t: "p",
          x: "The most common mistake is a reminder that fires before the customer is actually late. If your terms are 14 days and the automation starts chasing on day 3, you will annoy good payers. Set the delay from Completed so the first message lands a day or two after the due date, not before it.",
        },
        {
          t: "ol",
          x: [
            "Confirm Automation is on under Settings and ServiceM8 Add-ons.",
            "In Settings and Automation, open Payment Follow Up and work through its wizard.",
            "Set the delay to match your payment terms.",
            "Choose channels. Write a friendly first message and a firmer later one, with your bank details or payment link.",
            "For regular account customers, enable Live Invoice Statements on the client and pick weekly, fortnightly or monthly.",
          ],
        },
        {
          t: "note",
          title: "Watch for payment scams while you are at it",
          x: "Automated emails with bank details are exactly what scammers copy. Keep your payment details consistent, and read our post on [invoice scams aimed at tradies](/blog/invoice-scam-tradies) so you can tell a customer how to check a genuine invoice from you.",
        },
        {
          t: "p",
          x: "If you need payment status to reach another system, ServiceM8 publishes webhooks that can notify your own endpoint when a Job Payment record changes. The notification lists only the field names that changed, so your code has to call the resource URL to read the values. That is a developer task, not a setting.",
        },
      ],
    },
    {
      id: "feedback-and-reviews",
      h2: "Feedback requests and Google reviews",
      blocks: [
        {
          t: "p",
          x: "ServiceM8's Customer Feedback add-on collects a star rating and a short written review through a smart link that you can place in email signatures, on your website or in other material. The Automation add-on also lists a Customer Feedback automation, which asks for feedback after a job invoice is paid, by text, email or both. It needs the Customer Feedback add-on switched on as well.",
        },
        {
          t: "p",
          x: "Here is the gap. The ServiceM8 pages we read do not mention a Google review link, and we could not confirm whether ServiceM8's own feedback message can carry one. If your goal is public Google reviews specifically, the documented route is outside ServiceM8: its Zapier app lists a Job Completed trigger, so an automation can wait a day and then send your own message with your Google review link in it. Check that the trigger exists in your Zapier account before you build.",
        },
        {
          t: "p",
          x: "Whichever route you pick, ask every customer the same way. Google's policies bar selectively asking only happy customers and bar offering discounts or gifts for reviews. Our guide on [getting more Google reviews as a tradie](/guides/google-reviews-tradies-australia) covers the rules and the wording.",
        },
      ],
    },
    {
      id: "missed-calls",
      h2: "Missed-call text-back: the job ServiceM8 does not do",
      blocks: [
        {
          t: "p",
          x: "We found no missed-call feature in the ServiceM8 help-centre index we read. The nearest built-in piece is the text you can send from inside a job once the job exists, and that is not triggered by a call. A missed call has not become a job yet, so nothing in ServiceM8 fires.",
        },
        {
          t: "p",
          x: "The usual route is to let your phone or VoIP provider send the text itself, since it knows the call was missed. ServiceM8's Zapier app lists actions named Create Client and Create Job, so a Zap can then log the caller in ServiceM8 once the phone tool reports the missed call. Make also has a ServiceM8 app. ServiceM8's Messaging API can send email and text too, but only from a Public Application using OAuth 2.0, with a daily sending quota and a maximum send rate, and some scopes may carry a charge.",
        },
        {
          t: "ol",
          x: [
            "Find the missed-call or call-ended trigger in your phone or VoIP provider and read what it passes on, usually the caller number and the time.",
            "Let the provider send the text-back, so the customer hears from you within a minute. A good message asks one question, such as what they need and which suburb they are in.",
            "In Zapier, build a Zap with the phone provider as the trigger and ServiceM8 as the action. Choose Create Client, then add Create Job if you want a job card.",
            "Map the caller number to the client's mobile field and put the words Missed call and the time in the job description.",
            "Test with your own phone and check ServiceM8 afterwards for duplicate clients if the same person rings twice.",
          ],
        },
        {
          t: "p",
          x: "Rules matter here. A reply to a person who just rang you is a different thing from a marketing text. The Spam Act 2003 sets rules for commercial electronic messages, and the ACMA explains consent and unsubscribe requirements on its [avoid sending spam page](https://www.acma.gov.au/avoid-sending-spam). Our post on [missed-call text-back and the Spam Act](/blog/missed-call-text-back-spam-act-australia) walks through the practical version. If you want to put a number on what missed calls cost you, the [missed call calculator](/tools/missed-call-calculator) takes your own figures.",
        },
      ],
    },
    {
      id: "worked-example",
      h2: "A worked example with made-up numbers",
      blocks: [
        {
          t: "p",
          x: "Numbers help you decide whether an automation is worth the ten minutes. The ones below are invented to show the arithmetic. They are not our data and not a promise of what you will see. Replace every figure with your own.",
        },
        {
          t: "example",
          title: "Example: an electrician switching on Quote Follow Up",
          x: [
            "Suppose the business sends 40 quotes a month and the average accepted job is worth 2,800 dollars.",
            "Suppose 30 percent of quotes are accepted today and 35 percent after follow-ups. That is 40 times 5 percent, which is 2 extra jobs a month.",
            "Two extra jobs at 2,800 dollars is 5,600 dollars of extra revenue a month, before materials and labour.",
            "Suppose each quote sends 3 texts at about 10 cents each. That is 40 times 3 times 10 cents, 12 dollars a month in text credits.",
          ],
        },
        {
          t: "p",
          x: "The 5 percent lift is an assumption, and it is the number to test. Count your accepted quotes for a month before you switch it on and a month after. If the lift is closer to nothing, you have lost twelve dollars and learned something. If it is real, you have found money in a drawer.",
        },
      ],
    },
    {
      id: "gaps-and-checks",
      h2: "What we could not confirm, and what to check yourself",
      blocks: [
        {
          t: "p",
          x: "A guide that claims to know everything about a product that changes every few months is not worth much. These are the points where our reading of the documentation ran out.",
        },
        {
          t: "ul",
          x: [
            "We did not find an official ServiceM8 page describing a missed-call text-back feature.",
            "We could not confirm that ServiceM8's own feedback message can include a Google review link.",
            "ServiceM8 lists webhooks as a benefit of OAuth public applications and says API-key requests skip the subscription challenge, but it does not say plainly whether an API key can receive webhooks. Ask ServiceM8 before you build on that.",
            "Text credit prices and plan limits change. Read the current figures in your own account.",
          ],
        },
        {
          t: "p",
          x: "Before you rely on any of this, run each automation on a test job that has your own phone number as the customer. Confirm the timing, the wording and that the messages stop when they should. Keep a note of the date you tested, because a software update can change behaviour quietly.",
        },
        {
          t: "p",
          x: "If you are weighing ServiceM8 against another package, see our comparison of [Tradify and ServiceM8 for automation](/guides/tradify-vs-servicem8-automation). Our [integrations page](/integrations) lists how the main trade software packages connect to outside tools, and our guide to [automated appointment reminders](/guides/automated-appointment-reminders-australia) covers the day-before messages that cut no-shows.",
        },
      ],
    },
    {
      id: "privacy",
      h2: "Privacy and records",
      blocks: [
        {
          t: "p",
          x: "Every automation above touches customer names, phone numbers and addresses. If you route those through Zapier, Make or a phone provider, you are sending personal information to another company, sometimes overseas. Whether the Privacy Act 1988 applies to you depends on your turnover and a list of exceptions. Our [Privacy Act small business checker](/tools/privacy-act-checker) gives a quick answer, and the [Privacy Act guide](/guides/privacy-act-small-business-australia) explains the detail.",
        },
        {
          t: "p",
          x: "Two habits cost nothing. First, keep a record of when and how each customer agreed to receive texts, such as a tick on your booking form. Under the Spam Act the burden of proving consent sits with the sender. Second, tell customers in your privacy policy which tools handle their details. The [OAIC privacy guidance for businesses](https://www.oaic.gov.au/privacy) is the starting point.",
        },
      ],
    },
  ],
  faq: [
    {
      q: "Does ServiceM8 have missed-call text-back built in?",
      a: "We found no such feature in ServiceM8's help-centre index. The documented routes use a phone provider plus Zapier, Make or the ServiceM8 API, which we have not tested.",
    },
    {
      q: "Do I need Zapier to chase quotes in ServiceM8?",
      a: "No. The Quote Follow Up automation is built in, supports up to five follow-ups by email, text or both, and needs the Automation add-on.",
    },
    {
      q: "Does ServiceM8 send Google review requests automatically?",
      a: "ServiceM8 documents a Customer Feedback add-on and automation, but the pages we read do not mention a Google review link. A Zap on the Job Completed trigger is the documented route for sending your own message with a link.",
    },
    {
      q: "Will ServiceM8 chase unpaid invoices for me?",
      a: "Yes. The Payment Follow Up automation sends reminders by text, email or both for overdue invoices, timed from when the job was marked Completed. Set the delay to match your payment terms.",
    },
    {
      q: "Do the automated texts cost extra?",
      a: "ServiceM8 says text messages use text credits from your plan. Check your current plan and credit price in your own account, since both change.",
    },
    {
      q: "Is it legal to send automated texts to customers?",
      a: "Rules depend on the type of message. Marketing messages need consent, a clear sender and an unsubscribe option under the Spam Act 2003. See the ACMA guidance and take advice if you are unsure.",
    },
  ],
  sources: [
    { label: "ServiceM8: Automation overview", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/automation-overview" },
    { label: "ServiceM8: Quote Follow Up Automation", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/quote-follow-up-automation" },
    { label: "ServiceM8: what the Customer Feedback add-on is for", url: "https://support.servicem8.com/help-center/servicem8-add-ons/customer-feedback/what-is-the-customer-feedback-add-on-for" },
    { label: "ServiceM8 on Zapier: triggers and actions", url: "https://zapier.com/apps/servicem8/integrations" },
    { label: "Make: ServiceM8 app", url: "https://www.make.com/en/integrations/servicem8" },
    { label: "ServiceM8 Messaging API overview", url: "https://developer.servicem8.com/docs/messaging-overview" },
    { label: "ServiceM8 API: webhooks overview", url: "https://developer.servicem8.com/docs/webhooks-overview" },
    { label: "ACMA: avoid sending spam (Spam Act 2003)", url: "https://www.acma.gov.au/avoid-sending-spam" },
    { label: "OAIC: privacy for businesses", url: "https://www.oaic.gov.au/privacy" },
  ],
  related: {
    posts: ["dead-quotes-hidden-revenue", "quote-follow-up-text-message-examples-tradies", "missed-call-text-back-spam-act-australia", "trade-software-quote-exports"],
    tools: [],
    products: [{ label: "The TITANOS shop", href: "/shop", blurb: "Guides, templates and checklists in AUD, no GST." }],
  },
  nextStep: {
    label: "Quote follow-up playbook",
    href: "/products/quote-follow-up-playbook",
    text: "Switch on Quote Follow Up in ServiceM8 this week, then use the playbook for the wording of each message.",
  },
};
