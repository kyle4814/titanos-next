import type { Guide } from "@/lib/guides";

export const tradieAutomation: Guide = {
  slug: "tradie-automation-australia",
  seoTitle: "AI Automation for Tradies in Australia: A Guide",
  h1: "AI Automation for Tradies in Australia: What to Automate First",
  description:
    "Missed calls, dead quotes, late invoices and review requests: what Australian tradies can safely automate first, with worked examples and the legal limits.",
  cluster: "Tradie automation",
  targetTerms: ["ai for tradies australia", "missed call text back tradies australia", "quote follow up tradies", "tradie automation"],
  date: "2026-11-28",
  updated: "2026-11-28",
  answer:
    "Automate four things first, in this order: missed calls, quote follow-up, invoice chasing and review requests. They are the admin gaps that cost a small trade business the most, and software handles them well. Size the gain with your own numbers, and keep the Spam Act 2003 rules in mind for every text.",
  intro: [
    {
      t: "p",
      x: "Most tradies do not lose work because they are bad at the job. They lose it because the phone rang while they were under a house, the quote went out on Tuesday and nobody chased it on Friday, or the invoice sat in a drafts folder for three weeks. Those are admin gaps, and admin gaps are the part of a trade business that software handles well.",
    },
    {
      t: "p",
      x: "This guide covers what is worth automating in a one to twenty person trade business in Australia, in the order that usually pays back first: **missed calls, quote follow-up, invoice chasing and review requests**. It also covers what not to automate, what the law says about texting customers, and how to size the gain with your own numbers instead of a vendor's.",
    },
    {
      t: "note",
      title: "How to read this guide",
      x: "Worked examples are labelled as examples and use made-up round numbers so you can swap in yours. Nothing here is a promised result. Where a rule comes from a regulator, the source is linked at the bottom of the page.",
    },
  ],
  sections: [
    {
      id: "what-to-automate-first",
      h2: "What a tradie should automate first",
      blocks: [
        { t: "p", x: "Start where money is leaking, not where the technology is exciting. For a typical trade business four leaks account for most of the recoverable revenue, and they sit in this order because each one needs less setup than the next." },
        {
          t: "table",
          caption: "The four leaks, in the order to fix them",
          head: ["Leak", "What happens", "What automation does", "Setup effort"],
          rows: [
            ["Missed calls", "A customer rings, gets voicemail, rings the next tradie on the list.", "Sends an immediate text so the customer stays with you, and logs the enquiry.", "Low: an afternoon"],
            ["Dead quotes", "The quote goes out, nobody replies, nobody follows up.", "Schedules a polite follow-up at day 2, day 7 and day 21 and stops when they reply.", "Low to medium"],
            ["Late invoices", "The job finishes, the invoice goes out days later, then waits.", "Sends the invoice on completion and nudges before and after the due date.", "Medium"],
            ["Thin reviews", "Happy customers never leave a review because nobody asks.", "Asks once, at the right moment, with a direct link.", "Low"],
          ],
        },
        { t: "p", x: "Notice what is not on the list: replacing yourself, replacing staff, or building a clever custom system. The point of the first month is to fix leaks that already cost you money and that you can see in your own phone log and job software." },
        { t: "p", x: "A useful first step is a number, not a tool. Count the missed calls on your phone for one week, count the quotes sitting at the \"sent\" status for more than two weeks, and add up the invoices more than seven days overdue. Those three figures tell you which leak to fix first and, later, whether the fix worked." },
      ],
    },
    {
      id: "missed-calls",
      h2: "Missed calls and the text-back reply",
      blocks: [
        { t: "p", x: "A tradie on a roof or under a sink cannot answer the phone. The customer does not wait: someone who needs a leaking tap fixed today will ring the next number within minutes. The cheapest fix is a **missed-call text-back**: when a call goes unanswered, the customer gets an automatic text from your number or your business line within about a minute." },
        { t: "h3", x: "What a good text-back says" },
        { t: "p", x: "It should sound like you, say who you are, say you are on a job, and ask for one thing. Asking for one thing matters: a message that asks three questions gets no reply." },
        {
          t: "example",
          title: "Example wording (plumber)",
          x: [
            "\"Hi, it's Sam from Reliable Plumbing. Sorry I missed your call, I'm on a job. What's the address and what's the problem? I'll ring you back as soon as I'm off the tools, or you can book a time here: [booking link].\"",
            "Why it works: it names the business, explains the silence, asks for the two facts you need to price the job and offers a self-serve option.",
          ],
        },
        { t: "h3", x: "Variants worth having" },
        {
          t: "ul",
          x: [
            "**After hours:** says when you will ring back (\"first thing tomorrow\") and what to do in an emergency, for example \"if it's a gas leak or electrical fire, ring 000\".",
            "**Busy season:** is honest about lead times (\"booking from the 14th\") so the customer can decide quickly.",
            "**Existing customer:** if the number matches your job software, the text can use their name and ask about the current job instead of treating them as a stranger.",
          ],
        },
        { t: "h3", x: "The legal side: the Spam Act" },
        { t: "p", x: "In Australia, a commercial text message falls under the Spam Act 2003, which the ACMA enforces. The three rules are consent, identification and an unsubscribe route. A reply that answers a call the customer just made to your business, about their own enquiry, sits close to the safest end of that spectrum, but it is not exempt from thinking." },
        {
          t: "ul",
          x: [
            "Keep it a direct response to their enquiry, not a sales pitch.",
            "Say who you are in the message.",
            "Include an easy way to stop further texts, such as \"reply STOP\", and honour it.",
            "Do not add the number to a marketing list without separate consent.",
          ],
        },
        { t: "p", x: "The [ACMA guidance on avoiding spam](https://www.acma.gov.au/avoid-sending-spam) explains consent and the sender identification rules in plain language. If you are unsure whether a particular automated message needs consent, ask your adviser before switching it on." },
        { t: "h3", x: "Sizing the gain with your own numbers" },
        {
          t: "example",
          title: "Worked example (made-up numbers, replace with yours)",
          x: [
            "Say you miss 12 calls a week. Past experience suggests about a third of callers are real new enquiries, so 4 a week. If the text-back keeps even one of those 4 each week, and your average job is worth 450 dollars, that is roughly 450 dollars a week, or about 23,000 dollars over a year.",
            "The honest range is wide. Some weeks it saves nothing, and callers who wanted an emergency job may have gone elsewhere regardless. Track real outcomes for a month before you quote any number to anyone.",
          ],
        },
        { t: "p", x: "The same maths works in reverse for deciding if a paid tool is worth it: take the monthly fee, divide by your average job value, and you have the number of extra jobs a month the tool must win to break even." },
      ],
    },
    {
      id: "quote-follow-up",
      h2: "Quote follow-up that does not feel pushy",
      blocks: [
        { t: "p", x: "Quoting is where trades quietly lose the most money. Most quotes get no answer, not a no. People are busy, comparing, or waiting on a partner or a bank. Silence is not rejection, but without a follow-up it behaves exactly like rejection." },
        { t: "p", x: "We wrote about sizing this pile in [the dead-quote problem](/blog/dead-quotes-hidden-revenue): pull every quote older than a fortnight that is still at \"quoted\", remove the ones you know are dead, and add up what remains. For many businesses that number is a surprise." },
        { t: "h3", x: "A three-touch cadence" },
        {
          t: "ol",
          x: [
            "**Day 2:** a short check that the quote arrived and a question: \"Any questions on the scope or the price?\"",
            "**Day 7:** one useful addition, such as an earliest start date, a reminder that the price holds until a stated day, or a photo of similar finished work.",
            "**Day 21:** a polite close-out: \"I'll take this off my list for now. If the job comes back, the quote stands for another two weeks.\" Many replies arrive on this one because it removes pressure.",
          ],
        },
        { t: "p", x: "Stop the sequence the moment the customer replies, accepts or declines. A follow-up that arrives after a yes is the fastest way to look careless." },
        { t: "h3", x: "Where automation helps and where it does not" },
        {
          t: "ul",
          x: [
            "Helps: scheduling the touches, pulling the customer name and job description into the message, and stopping on reply.",
            "Helps: showing you the list each Monday so you can ring the three biggest quotes yourself.",
            "Does not help: writing the quote itself without you checking scope and price. A drafted quote from job notes saves typing time, but you remain the person who stands behind the number.",
          ],
        },
        { t: "p", x: "Your job software already holds most of the data. Our post on [what ServiceM8, Tradify and simPRO exports actually contain](/blog/trade-software-quote-exports) explains which fields can be trusted when you analyse quote history, and which cannot." },
        {
          t: "note",
          title: "Honest limit",
          x: "Follow-up improves the conversion of quotes that were already competitive. It will not rescue a price that is far above the market or a scope the customer never understood.",
        },
      ],
    },
    {
      id: "invoices-and-cash-flow",
      h2: "Invoices and getting paid faster",
      blocks: [
        { t: "p", x: "Cash flow is the second place a small trade business bleeds. Three habits fix most of it, and all three can run automatically." },
        {
          t: "ol",
          x: [
            "**Invoice on completion.** The invoice leaves while the customer is still looking at the finished work. Delay is the single most common reason invoices are paid late.",
            "**Reminders around the due date.** A friendly message two days before, one on the day and one a week after. Keep the tone neutral. The first one after the due date should assume an oversight, not bad faith.",
            "**One-tap payment.** If paying means finding a BSB and account number in a PDF, some customers will wait. A payment link removes the friction.",
          ],
        },
        { t: "p", x: "Be careful with one thing: the bank details on your invoices. A common scam intercepts a genuine invoice email and swaps the account number, and the customer pays the fraudster. Automation that sends invoices must also protect them. Read [the invoice scam hitting Australian trade businesses](/blog/invoice-scam-tradies) and the guide on [email security for small business](/guides/email-security-small-business-australia) before you scale up invoice emails." },
        { t: "h3", x: "Chasing without damaging the relationship" },
        { t: "p", x: "A reminder sequence should escalate in firmness, not in volume. Three to four touches over about a month is enough. After that, a phone call from you beats a fifth email, and a formal letter of demand is a decision for you and, if the amount is large, your adviser." },
        { t: "p", x: "The [invoice chasing playbook](/products/invoice-chasing-playbook) in our shop sets out reminder wording for each stage and when to stop automating and pick up the phone." },
      ],
    },
    {
      id: "reviews",
      h2: "Reviews: asking once, at the right moment",
      blocks: [
        { t: "p", x: "Local search for trades leans heavily on reviews. A business with forty recent reviews and a clear name usually beats a better tradie with six. Customers are willing to review, but they rarely do unprompted, and the moment passes quickly." },
        { t: "p", x: "The simple automation is a message sent a day or two after job completion, with a direct link to your Google review form and one sentence in your own voice." },
        {
          t: "example",
          title: "Example wording",
          x: ["\"Thanks again for having us out, Jo. If you're happy with the work, a quick Google review helps a small business like ours more than you'd think: [link]. If anything wasn't right, reply here and I'll sort it.\""],
        },
        { t: "p", x: "Two rules protect you. First, Google's review policies prohibit offering incentives in exchange for reviews and ask businesses not to selectively solicit only happy customers, a practice known as review gating. Send the same request to every customer. Second, never post or buy reviews on a customer's behalf. Both can get reviews removed or a profile suspended." },
        { t: "p", x: "Replying to reviews also matters, particularly the negative ones. A calm, specific reply to a bad review is read by far more prospective customers than the reviewer. A drafted reply that you edit and approve is a sensible use of AI, and a reply that nobody read before posting is not." },
      ],
    },
    {
      id: "ai-where-it-fits",
      h2: "Where AI fits and where plain rules are enough",
      blocks: [
        { t: "p", x: "Much of the tradie workflow above does not need AI at all. A missed-call text, a three-touch follow-up and a payment reminder are fixed rules. They are cheaper, more predictable and easier to audit than anything involving a language model. Use a rule when a rule will do." },
        { t: "p", x: "AI earns its place where the input is messy language:" },
        {
          t: "ul",
          x: [
            "Turning rough job notes, photos or a voice memo into a draft quote or scope of works, which you then check.",
            "Reading an enquiry email or text and pulling out the address, the problem and the urgency.",
            "Drafting replies to reviews and customer questions in your tone, for your approval.",
            "Summarising a week of calls and messages into a short list of things that need a human.",
            "Answering the phone when you cannot. This one carries real privacy and consent questions, so it has [its own guide on AI receptionists](/guides/ai-receptionist-australia-trades).",
          ],
        },
        { t: "p", x: "The rule of thumb we use: let software do the repeating and the remembering, and keep a human on anything that commits money, makes a promise to a customer or goes near safety. If your customers are on the hook for something you did not read before it went out, the automation is too loose." },
      ],
    },
    {
      id: "what-not-to-automate",
      h2: "What not to automate",
      blocks: [
        {
          t: "ul",
          x: [
            "**Safety and emergencies.** Gas, electrical, structural and flooding calls need a human or a clear instruction to ring 000. Never let a bot decide urgency alone.",
            "**Final prices.** Software can assemble a draft. You approve the number.",
            "**Complaints.** An upset customer who gets a canned reply gets angrier. Route complaints to you the same day.",
            "**Compliance sign-offs.** Licensing, certificates of compliance and warranties are your responsibility and your signature.",
            "**Anything you could not explain to the customer.** If you would be embarrassed to show them exactly what the system sent, change it.",
          ],
        },
      ],
    },
    {
      id: "privacy-and-data",
      h2: "Privacy and customer data",
      blocks: [
        { t: "p", x: "Every tool above touches names, phone numbers, addresses and job photos. Many sole traders sit under the Privacy Act's small business exemption, but not all do, and customers, insurers and larger clients increasingly ask how you handle their information anyway. Our guide to the [Privacy Act for small business](/guides/privacy-act-small-business-australia) explains who is covered and what a sensible minimum looks like." },
        { t: "p", x: "Three practical habits apply now, whatever your size. Know where customer data lives. Turn on multi-factor authentication for email, accounting and job software. Ask any vendor, in writing, where data is stored and whether it is used to train their models." },
      ],
    },
    {
      id: "thirty-day-plan",
      h2: "A 30-day plan you can run alone",
      blocks: [
        {
          t: "ol",
          x: [
            "**Week 1, measure.** Count missed calls, aged quotes and overdue invoices. Write the three numbers down with the date.",
            "**Week 2, missed calls.** Switch on a text-back with the wording above. Check the Spam Act points. Test it by ringing yourself.",
            "**Week 3, quotes.** Write the three follow-up messages in your own words. Send them by hand to the ten biggest open quotes first, to learn what replies you get, then automate.",
            "**Week 4, review and decide.** Count again. How many enquiries were saved, how many quotes moved, how much cash arrived earlier? Keep what worked and drop what did not.",
          ],
        },
        { t: "p", x: "If you would rather have the measuring done for you, our [free AI audit](/audit) looks at your workflow and tells you plainly what is worth automating and what is not, including when the answer is \"not much\"." },
      ],
    },
    {
      id: "choosing-tools",
      h2: "Choosing tools without getting locked in",
      blocks: [
        { t: "p", x: "Most trade businesses already pay for job management software such as ServiceM8, Tradify, simPRO, Fergus or Jobber, and many of those include basic reminders and quote follow-ups. Check what yours already does before buying anything new. The cheapest automation is a setting you already pay for and have not switched on." },
        { t: "p", x: "When you do add a tool, five questions keep you out of trouble:" },
        {
          t: "ul",
          x: [
            "Can I export my customer and job data in a normal file format if I leave?",
            "Where is the data stored and who can see it?",
            "What does it cost at twice my current volume?",
            "Does it send anything to customers without my approval, and can I turn that off?",
            "Is there a person I can ring when it breaks on a busy Monday?",
          ],
        },
        { t: "p", x: "Our post on [what AI automation should cost a small trade business](/blog/ai-automation-cost-small-business) gives price ranges and the questions to ask, so you can compare a build, a subscription and doing nothing on equal terms." },
      ],
    },
  ],
  faq: [
    {
      q: "Is it legal to text a customer back automatically after a missed call in Australia?",
      a: "A reply to a call the customer just made, about their own enquiry, is generally low risk, but the Spam Act 2003 still expects you to identify yourself and give a way to opt out, and to avoid turning the reply into marketing. Read the [ACMA guidance](https://www.acma.gov.au/avoid-sending-spam) and ask your adviser if your wording drifts into promotion.",
    },
    {
      q: "How many follow-ups should I send on a quote?",
      a: "Three is a good default: about day 2, day 7 and day 21. Stop as soon as the customer replies. More than three touches by message starts to feel like pressure, and a phone call from you is a better fourth step.",
    },
    {
      q: "Will AI replace my admin person or my own admin time?",
      a: "It removes the repeating and remembering work, such as reminders, drafting and sorting. It does not remove the judgement work: pricing, safety and relationships. Most trade businesses use the saved time to take more calls and chase more quotes, not to cut people.",
    },
    {
      q: "What does tradie automation cost?",
      a: "It ranges from nothing, using settings already in your job software, to a monthly subscription for a tool, to a one-off build for a custom workflow. Work out the break-even in extra jobs per month before you buy: monthly cost divided by your average job value. Our [cost post](/blog/ai-automation-cost-small-business) covers typical ranges.",
    },
    {
      q: "Do I need a privacy policy if I use these tools?",
      a: "Many sole traders fall under the small business exemption, but the exemption has exceptions and customers increasingly expect to see a policy. A short, honest one-page policy costs an afternoon. See the [Privacy Act guide](/guides/privacy-act-small-business-australia) for who is covered.",
    },
    {
      q: "Should I ask every customer for a Google review?",
      a: "Yes, ask every customer the same way. Google's policies prohibit incentives for reviews and discourage review gating, which means asking only the customers you expect to be happy. Make the request simple and send it a day or two after the job.",
    },
  ],
  sources: [
    { label: "ACMA: Avoid sending spam (Spam Act 2003)", url: "https://www.acma.gov.au/avoid-sending-spam", note: "Consent, sender identification and unsubscribe rules for commercial messages" },
    { label: "Google Business Profile and Maps: prohibited and restricted content", url: "https://support.google.com/contributing/answer/7400114", note: "Rules on incentivised reviews and fake engagement" },
    { label: "Scamwatch: business email compromise and false billing", url: "https://www.scamwatch.gov.au", note: "Reports and warnings on invoice and bank-detail scams" },
    { label: "Business.gov.au: running a small business", url: "https://business.gov.au", note: "Government guidance on invoicing, record keeping and obligations" },
  ],
  related: {
    posts: ["dead-quotes-hidden-revenue", "trade-software-quote-exports", "invoice-scam-tradies", "ai-automation-cost-small-business"],
    tools: [
      { label: "Free AI audit", href: "/audit", blurb: "A plain assessment of what in your workflow is worth automating." },
      { label: "Free security scan", href: "/scan", blurb: "Checks whether someone could send fake email as your business." },
      { label: "Tradies page", href: "/tradies", blurb: "How Titanos works with trade businesses." },
      { label: "Free tender digest", href: "/offers/free-tender-digest", blurb: "A free weekly email of new government tenders in your category and state." },
    ],
    products: [
      { label: "Quote Follow-Up Playbook", href: "/products/quote-follow-up-playbook", blurb: "Wording and timing for chasing quotes without pressure." },
      { label: "Invoice Chasing Playbook", href: "/products/invoice-chasing-playbook", blurb: "Reminder sequences for each stage of an overdue invoice." },
      { label: "Course: AI for Tradies", href: "/products/course-ai-for-tradies", blurb: "A short course on using AI tools safely in a trade business." },
      { label: "Shop", href: "/shop", blurb: "Every guide, template and tool in one place." },
    ],
  },
  nextStep: {
    label: "Get the free AI audit",
    href: "/audit",
    text: "Not sure which of these leaks is costing you most? The free audit goes through your actual workflow, tells you what is worth automating and what is not, and costs nothing if the answer is that you do not need us.",
  },
};
