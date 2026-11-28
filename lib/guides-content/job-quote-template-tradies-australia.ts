import type { Guide } from "@/lib/guides";

export const quoteTemplates: Guide = {
  slug: "job-quote-template-tradies-australia",
  seoTitle: "Job Quote Template for Tradies in Australia",
  h1: "Job Quote Template for Australian Tradies: What to Include and How to Word It",
  description:
    "A plain job quote template for Australian tradies: what to put in, how to handle GST, variations and validity, plus wording for scope, exclusions and follow-up.",
  answer:
    'A good tradie quote states the scope, inclusions and exclusions, price with GST shown, payment terms, validity period and how variations are handled. This guide gives a plain template to copy and explains each part. It is general information, not legal or tax advice, and rules differ by state and trade.',
  cluster: "Quotes",
  targetTerms: ["job quote template australia", "quote template for tradies", "builder quote template", "what to include in a quote australia", "quote vs estimate australia"],
  date: "2026-11-29",
  updated: "2026-11-29",
  intro: [
    {
      t: "p",
      x: "A quote is the first document a customer judges you by. Before they see your work, they see whether your quote is clear, complete and easy to say yes to. A vague quote invites arguments later, over what was included, what the price covered and what a variation costs. A clear quote does the opposite: it shows you have thought about the job and it protects both sides.",
    },
    {
      t: "p",
      x: "This guide gives you a plain template you can copy into a document or your job software, explains each part in everyday language and flags the Australian points to check: GST, written contract rules for building work, and licence details. It is general information, not legal or tax advice, and rules differ by state and by trade. Where a figure comes from a public source we name it. The sample prices and names in the examples are made up.",
    },
    {
      t: "note",
      title: "Short answer",
      x: "A good quote names you and the customer, describes the work and what is left out, gives a clear price with GST shown properly, sets an expiry date, says how variations and payment work and makes accepting it a single easy step. Check your state regulator's rules for written contracts on larger building work.",
    },
  ],
  sections: [
    {
      id: "quote-or-estimate",
      h2: "Quote or estimate: know which one you are giving",
      blocks: [
        {
          t: "p",
          x: "People use the words loosely, but they can mean different things. A quote generally means a fixed price for defined work. An estimate generally means a best guess that may change. Customers often assume an estimate is a quote and are upset when the final bill is higher. State clearly which one you are giving, and what could change the price.",
        },
        {
          t: "table",
          caption: "Quote versus estimate in practice",
          head: ["", "Quote", "Estimate"],
          rows: [
            ["What it says", "A fixed price for the described work", "A best guess based on what you can see"],
            ["Best for", "Clear, defined jobs", "Jobs with unknowns behind a wall, under a floor or in a roof"],
            ["Risk", "You wear the cost of anything missed", "Customer may feel misled if it rises"],
            ["Wording", "\"Fixed price of ... for the work described\"", "\"Estimated price of ... which may change if ... \""],
          ],
        },
        {
          t: "p",
          x: "If a job has real unknowns, say so in writing, give a range or price the visible part and state a rate for the hidden part. Customers accept a rise they were told about much more readily than one they were not.",
        },
      ],
    },
    {
      id: "template",
      h2: "The template, section by section",
      blocks: [
        {
          t: "p",
          x: "Below is the structure. Copy it into your own letterhead or into your job software's quote template and fill in the brackets. Every section is explained afterwards.",
        },
        {
          t: "example",
          title: "Quote template (copy and adapt)",
          x: [
            "1. Your business: trading name, ABN, licence number and type, phone, email and address.",
            "2. Customer: name, site address, contact details.",
            "3. Quote number, date issued and valid until date.",
            "4. Job summary: one or two plain sentences.",
            "5. Scope of work: itemised list of what you will do.",
            "6. Inclusions and exclusions: materials supplied, what is not included.",
            "7. Price: itemised or lump sum, showing GST.",
            "8. Timing: start window and expected duration.",
            "9. Payment terms: deposit, progress payments, final payment and due dates.",
            "10. Variations: how changes are priced and agreed.",
            "11. Access and customer responsibilities.",
            "12. Warranty or workmanship statement, where it applies.",
            "13. Acceptance: how to say yes, with a signature or reply line.",
          ],
        },
        { t: "h3", x: "1 to 3: who, who for and when" },
        {
          t: "p",
          x: "Use your trading name, your ABN and, where your trade needs one, your licence number. Licence rules and numbering formats vary by state and trade, so check what your regulator expects to appear on quotes and contracts. A quote number lets both sides refer to the same document later, and the valid until date matters, which we cover below.",
        },
        { t: "h3", x: "4 and 5: describe the work so a stranger could follow it" },
        {
          t: "p",
          x: "The scope is the heart of the quote. Write it as a list of things you will do, in the order you will do them, in words the customer would use. Imagine the customer handing the quote to a neighbour. Would the neighbour understand what was agreed?",
        },
        {
          t: "example",
          title: "Scope wording (made-up job)",
          x: [
            "Supply and install one 250 litre electric hot water unit to replace the existing unit in the garage.",
            "Disconnect and remove the old unit and take it away.",
            "Connect to existing water and power, test and commission.",
            "Leave the work area clean.",
          ],
        },
        { t: "h3", x: "6: say what is not included" },
        {
          t: "p",
          x: "Most disputes are about things nobody wrote down. List the obvious exclusions in plain words: making good walls after cutting, painting, permit fees if the customer pays them, work to bring existing wiring or pipes up to current rules where it is found to be faulty. Write what you will do if you find a hidden problem: stop, tell the customer and price it separately.",
        },
        { t: "h3", x: "7: price and GST" },
        {
          t: "p",
          x: "Show the total price clearly, and show whether it includes GST. The ATO says a business must register for GST when its GST turnover is 75,000 dollars or more, so if you are registered you charge it and show it. If you are not registered you do not charge GST and your quote should not imply that you do. Prices shown to consumers are generally expected to be the full price including GST. See the ATO pages on [registering for GST](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst) and [tax invoices](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices), and ask your accountant if unsure.",
        },
        {
          t: "p",
          x: "Itemising helps some jobs and hurts others. On a small job a lump sum is easier to read. On a larger job an itemised price lets the customer see what they are buying and lets you price variations against it. If you itemise, make sure the items add up to the total, because a mismatch makes a customer doubt everything else.",
        },
        { t: "h3", x: "8 and 9: timing and payment" },
        {
          t: "p",
          x: "Give a start window and an expected duration, with a note on what could delay it, such as weather or delivery of materials. State your payment terms exactly: any deposit, what triggers a progress payment, when the final payment is due and what happens if it is late. On residential building work, rules about deposits and progress payments are set by state and territory law, so check your regulator before you copy terms from another trade or another state.",
        },
        { t: "h3", x: "10: variations" },
        {
          t: "p",
          x: "A variation is a change to the agreed work, such as an extra power point or a different tile. Say in the quote how variations will work: that you will describe the change and its price in writing, and that the work only goes ahead once the customer agrees. This single sentence prevents most of the bill shock complaints.",
        },
        {
          t: "example",
          title: "Variation wording",
          x: [
            "Any change to the work described in this quote will be priced and confirmed in writing before it is done. Work outside the described scope will not go ahead without your written agreement.",
          ],
        },
        { t: "h3", x: "11 to 13: access, warranty and acceptance" },
        {
          t: "p",
          x: "Say what the customer needs to provide, such as clear access, power and water, and a decision on fittings by a certain date. If you give a warranty on workmanship, state it. Do not promise more than the law and your insurer allow. Finally, make acceptance simple: a signature line, or a reply saying yes to this quote with the quote number. A quote the customer cannot easily accept is a quote that goes cold.",
        },
      ],
    },
    {
      id: "validity",
      h2: "Validity and expiry",
      blocks: [
        {
          t: "p",
          x: "Material costs and your availability change, so a quote should expire. Put a valid until date on it. Choose a period that fits your trade: a short one for jobs with volatile material prices and a longer one for labour-only work. If you have not heard back near the expiry date, that is a good moment for a polite check-in rather than a surprise price rise.",
        },
        {
          t: "p",
          x: "Do not use the expiry date as a pressure tactic. A date you invent to hurry the customer reads as exactly that and costs you trust. Our calmer approach to chasing is in [quote follow-up text message examples for tradies](/blog/quote-follow-up-text-message-examples-tradies) and the [quote follow-up playbook](/products/quote-follow-up-playbook).",
        },
      ],
    },
    {
      id: "contract-rules",
      h2: "Written contracts and licensing: check your state",
      blocks: [
        {
          t: "p",
          x: "For smaller jobs a good quote with an accepted reply is often all you need. For larger residential building work, most states and territories require a written contract with prescribed content once the price passes a set amount, and a quote on its own may not meet that. The dollar threshold, required terms, cooling off rules and rules on deposits differ by state. Because these figures change and differ, we will not quote them here.",
        },
        {
          t: "ul",
          x: [
            "Find your regulator: for example NSW Fair Trading, the QBCC in Queensland, the VBA in Victoria and equivalents elsewhere.",
            "Read what they say about contracts, deposits and progress payments for your type of work.",
            "Check what must appear on a quote or contract, such as your licence number.",
            "If the job is large or complicated, have a lawyer review your standard contract once, then reuse it.",
          ],
        },
        {
          t: "p",
          x: "The [NSW Fair Trading website](https://www.fairtrading.nsw.gov.au/) is one example of the kind of regulator page to look for. Your own state's page will differ.",
        },
      ],
    },
    {
      id: "mistakes",
      h2: "Common mistakes",
      blocks: [
        {
          t: "ul",
          x: [
            "A one-line scope such as supply and install bathroom. Everyone assumes something different.",
            "No exclusions, so the customer assumes painting and making good are included.",
            "GST unclear, so the customer finds a ten percent surprise at the end.",
            "No valid until date, so a quote from six months ago comes back at the old price.",
            "No variation rule, so extras become arguments.",
            "A quote that sits in an inbox with no way to accept. Make it one tap.",
            "A quote sent days after the visit. Speed signals reliability.",
          ],
        },
      ],
    },
    {
      id: "software",
      h2: "Templates in job software, and keeping them tidy",
      blocks: [
        {
          t: "p",
          x: "Once you have a version you are happy with, put it into your job software so every quote starts from the same base. ServiceM8 and Tradify both let you work from quotes inside the job, and both have follow-up reminders, which we compare in [Tradify vs ServiceM8 for automation](/guides/tradify-vs-servicem8-automation) and the [ServiceM8 automation guide](/guides/servicem8-automation-tradies). Check the template options in your own account, since we have not tested them.",
        },
        {
          t: "p",
          x: "Keep one master template per type of job, review it twice a year and write down each change. If you analyse your quote history later, consistent templates make that much easier, and our post on [what trade software exports contain](/blog/trade-software-quote-exports) explains what you can and cannot trust in the data.",
        },
        {
          t: "example",
          title: "A tidy habit (made-up numbers)",
          x: [
            "Suppose you send 25 quotes a month and 8 are accepted. Your acceptance rate is 8 divided by 25, or 32 percent.",
            "Change one thing, such as adding a clear exclusions section and a one-tap acceptance reply. Track the rate for two months.",
            "If it moves, keep the change. If not, try another. Your own numbers decide, not ours.",
          ],
        },
        {
          t: "p",
          x: "A quote contains your customer's name, address and phone number, so handle it as personal information. See our [Privacy Act checker](/tools/privacy-act-checker) and the [Privacy Act guide](/guides/privacy-act-small-business-australia). Also keep payment details consistent across quotes and invoices. Fake invoice scams copy tradie paperwork, as we explain in [invoice scams aimed at tradies](/blog/invoice-scam-tradies).",
        },
      ],
    },
  ],
  faq: [
    {
      q: "What should a tradie's quote include in Australia?",
      a: "Your trading name, ABN and licence details, the customer and site, a clear scope of work, inclusions and exclusions, the price with GST shown, timing, payment terms, how variations work, a valid until date and an easy way to accept.",
    },
    {
      q: "What is the difference between a quote and an estimate?",
      a: "A quote generally means a fixed price for defined work, and an estimate generally means a best guess that may change. State clearly which you are giving and what could change the price.",
    },
    {
      q: "Do I have to charge GST on a quote?",
      a: "Only if you are registered or required to register. The ATO says registration is required when your GST turnover reaches 75,000 dollars. Ask your accountant, and show GST clearly if you charge it.",
    },
    {
      q: "Is a quote enough, or do I need a written contract?",
      a: "For smaller jobs a clear accepted quote often suffices. For larger residential building work most states require a written contract above a set dollar amount, with prescribed terms. Check your state regulator.",
    },
    {
      q: "How long should a quote be valid for?",
      a: "Long enough to be fair and short enough to cover material price changes and your availability. Put a valid until date on every quote and choose a period that suits your trade.",
    },
    {
      q: "How do I handle changes after the customer accepts?",
      a: "Write a variation rule into the quote: changes are priced and agreed in writing before the work is done. Then follow it every time.",
    },
  ],
  sources: [
    { label: "ATO: registering for GST", url: "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst" },
    { label: "ATO: tax invoices", url: "https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices" },
    { label: "NSW Fair Trading", url: "https://www.fairtrading.nsw.gov.au/" },
    { label: "ServiceM8: Automation overview", url: "https://support.servicem8.com/help-center/servicem8-add-ons/automation/automation-overview" },
    { label: "Tradify: Turn on Quote Reminders", url: "https://help.tradifyhq.com/hc/en-us/articles/360049096213-Turn-on-Quote-Reminders" },
  ],
  related: {
    posts: ["quote-follow-up-text-message-examples-tradies", "dead-quotes-hidden-revenue", "trade-software-quote-exports", "invoice-scam-tradies"],
    tools: [],
    products: [{ label: "The TITANOS shop", href: "/shop", blurb: "Guides, templates and checklists in AUD, no GST." }],
  },
  nextStep: {
    label: "Quote follow-up playbook",
    href: "/products/quote-follow-up-playbook",
    text: "Copy the template into your job software this week, then use the playbook so every quote you send gets a polite follow-up.",
  },
};
