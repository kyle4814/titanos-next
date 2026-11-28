import type { Guide } from "@/lib/guides";

export const appointmentReminders: Guide = {
  slug: "automated-appointment-reminders-australia",
  seoTitle: "Automated Appointment Reminders for Tradies",
  h1: "Automated Appointment Reminders for Australian Tradies and Service Businesses",
  description:
    "How to set up automated appointment reminders by SMS and email for a trade or service business: timing, wording, Spam Act consent and a worked example.",
  answer:
    'A short reminder message the day before an appointment is one of the cheapest ways to cut no-shows for trades, cleaners and mobile services. This guide covers what to send and when, how to set it up with tools you may already pay for, how the Spam Act 2003 applies, and how to measure results.',
  cluster: "Appointments",
  targetTerms: ["automated appointment reminders", "sms appointment reminders australia", "appointment reminder text for tradies", "reduce no shows service business", "spam act appointment reminders"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "A tradie drives across town for a 9am quote and nobody answers the door. A mobile groomer arrives and the dog is at the vet. A cleaner turns up to a house that is locked. Each of these is a no-show or a mix-up, and each costs travel time, fuel and the slot you could have given someone else. A short reminder message the day before is one of the cheapest ways to cut them down.",
    },
    {
      t: "p",
      x: "This guide is for owner-operators and small teams who book customers into time slots: trades, cleaners, mobile services, clinics and similar businesses. It covers what to send and when, how to wire it up with tools you may already pay for, how the Spam Act 2003 and privacy rules apply, and how to measure whether it works. We have no verified Australian no-show rate for trades to quote, so the numbers in the examples are made up and labelled as such. Use your own.",
    },
    {
      t: "note",
      title: "Short answer",
      x: "Send two plain messages: a confirmation when the booking is made and a reminder the day before, with a simple way to confirm, change or cancel. Keep them factual with no offers, record when the customer agreed to receive messages and measure no-shows before and after.",
    },
  ],
  sections: [
    {
      id: "what-reminders-do",
      h2: "What reminders do, and what they do not",
      blocks: [
        {
          t: "p",
          x: "A reminder does three things. It prompts the customer to remember the time. It gives them an easy way to say they cannot make it, which frees the slot for someone else. And it shows that you run a tidy business, which sets the tone for the visit. It does not fix a booking made carelessly. If the address was taken down wrong or the customer never agreed to the time, a reminder only repeats the mistake sooner.",
        },
        {
          t: "p",
          x: "The most valuable part is often the reply, not the reminder. A customer who texts cancel the night before gives you time to fill the gap or reroute the day. A customer who simply does not appear costs you the whole slot.",
        },
        {
          t: "table",
          caption: "Where reminders help most",
          head: ["Business type", "Typical problem", "What the reminder should do"],
          rows: [
            ["Plumber, electrician, appliance repair", "Nobody home, or access not arranged", "Confirm the window, ask about access, ask for pets to be secured"],
            ["Cleaner, lawn care, pest control", "Locked gate, wrong day", "Confirm the day, remind about access and anything to move"],
            ["Quote or site visit", "Customer forgot the time", "Confirm the time and who will attend"],
            ["Mobile services, groomers, mechanics", "Late or no-show, wrong address", "Confirm address and time, give a reply option to reschedule"],
            ["Clinics and health services", "Missed appointments", "Plain reminder with no clinical detail in the message"],
          ],
        },
      ],
    },
    {
      id: "timing",
      h2: "When to send them",
      blocks: [
        {
          t: "p",
          x: "There is no magic number, and we will not pretend there is. These patterns are sensible starting points that you can test against your own no-show count.",
        },
        {
          t: "ol",
          x: [
            "Confirmation, straight away. When the booking is made, send a message with the date, time window, address and your business name. This catches errors early and is the record that shows what was agreed.",
            "Reminder, the day before. Late afternoon suits most customers, because it is early enough to change plans and close enough to remember. Avoid very early or late hours.",
            "Day-of message, optional. For trades with a travel window, a text when you are on the way is a good finish, since it answers the question customers actually have, which is when you will turn up.",
            "For long-lead bookings, such as a job booked three weeks out, add a one-week check-in. People forget what they booked a month ago.",
          ],
        },
        {
          t: "p",
          x: "Send in the customer's local time, not yours. If you service more than one time zone or cross a daylight saving boundary, check how your tool handles it, because a reminder sent an hour off is worse than none.",
        },
      ],
    },
    {
      id: "wording",
      h2: "What to say",
      blocks: [
        {
          t: "p",
          x: "A good reminder gives the business name, the day and time window, the address or the reason for the visit and one clear way to reply. It is short enough to read on a lock screen. Keep it factual. The moment you add an offer or a pitch, the message looks like marketing and the rules change, as we explain below.",
        },
        {
          t: "example",
          title: "Confirmation (made-up wording)",
          x: [
            "\"Hi Dana, this is Coastal Air Conditioning confirming your service visit on Thursday 12 March between 9am and 11am at 14 Example Street. Reply C to confirm or call us on 07 5550 0000 to change it.\"",
          ],
        },
        {
          t: "example",
          title: "Reminder the day before",
          x: [
            "\"Reminder from Coastal Air Conditioning: your service visit is tomorrow between 9am and 11am. Please make sure we can reach the unit. Reply C to confirm or R to reschedule.\"",
          ],
        },
        {
          t: "example",
          title: "On the way",
          x: [
            "\"Dana, our technician Luke is about 20 minutes away. See you soon.\"",
          ],
        },
        {
          t: "p",
          x: "The phone number above is a placeholder and the names are made up. Use your own details.",
        },
        { t: "h3", x: "Things to leave out" },
        {
          t: "ul",
          x: [
            "Sensitive detail. A reminder is read on a lock screen and may be seen by others. For a clinic, say you have an appointment, not what it is for.",
            "Offers, upsells and review requests. Send those separately and only to people who have agreed to marketing. See our [Google reviews guide](/guides/google-reviews-tradies-australia).",
            "Pressure or threats about cancellation fees. If you have a cancellation policy, state it once when the booking is made, in the confirmation, and keep the tone calm.",
            "Full payment details. Card numbers, bank details and pay now links in a reminder are exactly what scam messages look like. See our post on [invoice scams aimed at tradies](/blog/invoice-scam-tradies).",
          ],
        },
      ],
    },
    {
      id: "rules",
      h2: "The Spam Act and consent",
      blocks: [
        {
          t: "p",
          x: "The Spam Act 2003 covers commercial electronic messages, which includes SMS and email. The ACMA says that if you plan to send marketing messages you must first have consent from the person, that your message must identify you as the sender and that it must make it easy to unsubscribe. There are two kinds of consent: express consent, where the person knows and accepts that they will receive messages from you, and inferred consent, which depends on circumstances and is less reliable. The ACMA also says it is up to you to prove you have consent, and that you should keep a record of who gave it, when and how.",
        },
        {
          t: "p",
          x: "A plain reminder about an appointment the customer asked you to make is a different thing from a promotion. That is why we keep reminders factual. But the line can blur, because a reminder with a discount in it is marketing. If you are unsure which side a message falls on, read the ACMA guidance and ask a lawyer, since we cannot give you legal advice. See also our post on the [Spam Act and missed-call text-back](/blog/missed-call-text-back-spam-act-australia).",
        },
        {
          t: "p",
          x: "The easy, safe habit costs nothing:",
        },
        {
          t: "ul",
          x: [
            "Add a line to your booking form or phone script: we will text or email you to confirm and remind you of your booking. Tick or say yes to agree.",
            "Record the date and the way they agreed.",
            "Name your business in every message.",
            "Add a way to opt out of anything beyond the booking, such as reply STOP, and honour it quickly.",
          ],
        },
        {
          t: "note",
          title: "Do not use reminders to send marketing",
          x: "A common mistake is to tack a seasonal special onto a reminder. That turns a service message into marketing, and it may breach the Act if you have not got consent for marketing. Keep the two apart.",
        },
      ],
    },
    {
      id: "privacy",
      h2: "Privacy: what you hold and who sees it",
      blocks: [
        {
          t: "p",
          x: "A reminder system holds names, mobile numbers, addresses and the reason for the visit. If the Privacy Act 1988 applies to your business, the Australian Privacy Principles apply to that information. Many sole traders and small businesses with annual turnover under 3 million dollars are outside the Act, but there are exceptions, and a business that provides a health service is covered whatever its turnover. Our [Privacy Act checker](/tools/privacy-act-checker) gives a quick read, and the [Privacy Act guide](/guides/privacy-act-small-business-australia) explains the detail.",
        },
        {
          t: "p",
          x: "Practical points. Know which tool sends the messages and where it stores numbers. Check whether that vendor stores data overseas. Collect only what you need to send the reminder. Delete old appointment data when you no longer need it. And tell customers what you do in your privacy policy. The [privacy policy template pack](/products/privacy-policy-template-pack) in our shop has wording for this.",
        },
      ],
    },
    {
      id: "tools",
      h2: "Choosing a tool",
      blocks: [
        {
          t: "p",
          x: "You have three routes, from cheapest to most flexible.",
        },
        {
          t: "table",
          caption: "Ways to send reminders",
          head: ["Route", "Cost shape", "Good for", "Watch for"],
          rows: [
            ["By hand from your phone", "Free apart from your time", "A handful of bookings a week", "You will forget on busy days"],
            ["Your job or booking software", "Often included, texts may cost per message", "Most trade and service businesses", "Check the schedule and wording you can change"],
            ["A separate reminder or messaging tool, linked by Zapier or Make", "Subscription plus per-message fees", "Cases your software does not cover", "More moving parts, more privacy exposure"],
          ],
        },
        {
          t: "p",
          x: "Start with the software you already pay for. ServiceM8, for example, lets you send a text from inside a job and has an Automation add-on for follow-ups after quotes and invoices, though we did not find a documented appointment reminder in the pages we read, so check yours. Tradify documents quote reminders and invoice reminders, and its text messages carry a per-message charge. See our guides to [ServiceM8 automation](/guides/servicem8-automation-tradies) and [Tradify vs ServiceM8](/guides/tradify-vs-servicem8-automation) for what each documents. Always ask the vendor in writing whether your plan sends job-day reminders, because the feature list changes.",
        },
        {
          t: "p",
          x: "If you need a reply to do something, such as reply C to confirm, test it. Send yourself the message, reply and watch what happens to the booking. A reply option that goes nowhere is worse than none.",
        },
        {
          t: "p",
          x: "What about calls to the number in your reminder? If nobody picks up, you are back to the missed-call problem. See the [missed call calculator](/tools/missed-call-calculator) and our [tradie automation guide](/guides/tradie-automation-australia).",
        },
      ],
    },
    {
      id: "measuring",
      h2: "Measuring whether it works",
      blocks: [
        {
          t: "p",
          x: "Do not trust a vendor's headline number about reduced no-shows. Count your own. Before you switch reminders on, spend four weeks writing down how many bookings you had and how many were no-shows or last-minute cancellations. Then switch on reminders and count for four weeks again.",
        },
        {
          t: "example",
          title: "Worked example (made-up numbers)",
          x: [
            "Suppose you book 50 visits a month. Before reminders, 4 are no-shows or same-day cancellations. That is 8 percent.",
            "Suppose each wasted visit costs 60 dollars in fuel and lost time, and you could not refill the slot. That is 4 times 60, or 240 dollars a month.",
            "After reminders, suppose it falls to 2. That is 2 times 60, or 120 dollars saved, minus the cost of 100 texts at a few cents each.",
            "These figures are invented. The only number that matters is yours, from your own diary. If the saving is small, keep the reminders anyway for the cancellations they flush out early.",
          ],
        },
        {
          t: "p",
          x: "Also track how many customers reply to cancel or reschedule. Those replies are the value, because each one is a slot you can reuse. Watch for complaints, too. If customers tell you the messages are too frequent, cut one.",
        },
      ],
    },
    {
      id: "checklist",
      h2: "A set-up checklist",
      blocks: [
        {
          t: "ol",
          x: [
            "Decide what you will send: confirmation, day-before reminder and, if you want it, an on-the-way message.",
            "Write each message in plain words with your business name, time window and one way to reply.",
            "Add consent wording to your booking form or phone script and record when it was given.",
            "Pick the tool. Start with what you already pay for.",
            "Test on yourself, including the reply option and time zone.",
            "Count no-shows for four weeks before and after.",
            "Review your privacy policy so it names the tools you use.",
          ],
        },
      ],
    },
  ],
  faq: [
    {
      q: "Do I need consent to send appointment reminder texts in Australia?",
      a: "The Spam Act 2003 requires consent for commercial electronic messages that are marketing. A plain reminder about a booking the customer made is not the same as a promotion, but the safe habit is to collect agreement when booking, name your business and offer a way to opt out. Take legal advice if unsure.",
    },
    {
      q: "What time should I send a reminder?",
      a: "A common starting point is late afternoon the day before, plus a confirmation when the booking is made. There is no proven best time for every business, so test against your own no-show count.",
    },
    {
      q: "Can I put a special offer in a reminder?",
      a: "Avoid it. A reminder with an offer looks like marketing, which needs consent, clear sender identification and an unsubscribe option. Send promotions separately to people who agreed to receive them.",
    },
    {
      q: "Is a reminder system covered by the Privacy Act?",
      a: "Names, mobile numbers and addresses are personal information. Whether the Act applies depends on your turnover and exceptions, and health service providers are covered whatever their turnover. Use the Privacy Act checker to see where you sit.",
    },
    {
      q: "What should a reminder never include?",
      a: "Sensitive details of why the person is booked, full payment details and pressure about fees. Keep it short and factual, and put your cancellation terms in the confirmation instead.",
    },
    {
      q: "How do I know if reminders are working?",
      a: "Count no-shows and same-day cancellations for four weeks before and four weeks after you switch them on, using your own diary. Do not rely on a vendor's headline figure.",
    },
  ],
  sources: [
    { label: "ACMA: avoid sending spam (Spam Act 2003)", url: "https://www.acma.gov.au/avoid-sending-spam" },
    { label: "Spam Act 2003 (Federal Register of Legislation)", url: "https://www.legislation.gov.au/C2004A01214/latest/text" },
    { label: "OAIC: privacy for businesses", url: "https://www.oaic.gov.au/privacy" },
    { label: "ServiceM8: Automation overview", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/automation-overview" },
    { label: "Tradify: Understanding text messages", url: "https://help.tradifyhq.com/hc/en-us/articles/26130939769497-Understanding-Text-Messages-in-Tradify" },
  ],
  related: {
    posts: ["missed-call-text-back-spam-act-australia", "invoice-scam-tradies", "ai-automation-cost-small-business", "dead-quotes-hidden-revenue"],
    tools: [],
    products: [{ label: "The TITANOS shop", href: "/shop", blurb: "Guides, templates and checklists in AUD, no GST." }],
  },
  nextStep: {
    label: "Privacy Act checker",
    href: "/tools/privacy-act-checker",
    text: "Count your no-shows for four weeks, then switch on a confirmation and a day-before reminder and count again.",
  },
};
