import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import { faqPage, breadcrumbs } from "@/lib/jsonld";
import JsonLd from "@/components/JsonLd";
import Calculator from "./Calculator";
import { calculate, EXAMPLE } from "./calc";
import "@/components/home-redesign/home-redesign.css";
import "./calculator.css";

const PATH = "/tools/missed-call-calculator";
const TITLE = "Missed Call Calculator for Tradies | TITANOS";
const DESC = "Free missed call calculator for Australian tradies. Enter calls, share missed, job value and close rate to see what missed calls cost you a month and a year.";

export const metadata: Metadata = withSeo(PATH, {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}${PATH}` },
  openGraph: { title: TITLE, description: DESC, type: "website", url: `${SITE}${PATH}` },
});

const FAQ = [
  { q: "How much do tradies lose from missed calls?", a: "There is no honest single figure, because it depends on how many calls you get, how many you miss, what a job is worth and how often an answered call becomes work. The calculator multiplies your own four numbers. We do not quote an industry average because we have not found a sourced one." },
  { q: "Where do I find my share of missed calls?", a: "Open your phone's call history for a normal week and count the incoming calls with no answer or that went to voicemail, then divide by all incoming calls. If you use a business line or a job management app, its call log gives the same count." },
  { q: "Is the result what I would earn if I answered every call?", a: "No. It is revenue at risk, a ceiling. Some missed callers ring a second tradie anyway, some call back, and some were never real jobs. Treat it as the size of the problem, then reduce it by your own recovery guess in the second figure." },
  { q: "What is a close rate and what should I enter?", a: "Close rate is the share of enquiries you answer that turn into a paid job. Use your own quote-to-job history. If you do not track it, count the last 20 enquiries and how many became work." },
  { q: "Does this tool store or send my numbers?", a: "No. It runs in your browser. Nothing is sent to a server or saved." },
  { q: "Is texting a missed caller allowed in Australia?", a: "The Spam Act 2003 covers commercial electronic messages and the ACMA publishes the rules on consent. Read the ACMA guidance and get advice for your situation before you switch on any automatic reply." },
];

export default function Page() {
  const ex = calculate(EXAMPLE);
  const aud = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
  const webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Missed call calculator for tradies",
    url: `${SITE}${PATH}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en-AU",
    description: DESC,
    offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
    publisher: { "@id": `${SITE}/#organization` },
  };
  return (
    <main className="mc">
      <JsonLd data={webApp} />
      <JsonLd data={faqPage(FAQ)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Missed call calculator", path: PATH }])} />
      <div className="mc-wrap">
        <nav className="mc-crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link> / <span aria-current="page">Missed call calculator</span></nav>
        <header className="mc-hero">
          <p className="mc-eyebrow">Free tool for Australian trades</p>
          <h1>Missed call calculator: how much do tradies lose from missed calls?</h1>
          <p className="mc-lede">You are up a ladder or under a sink, the phone rings out, and the caller rings the next name on Google. This calculator turns four numbers from your own business into a monthly and yearly figure, with every assumption on the screen and editable. It runs in your browser and saves nothing.</p>
        </header>

        <Calculator />

        <section className="mc-sec">
          <h2>How to use the calculator</h2>
          <ol>
            <li>Count your calls in a normal week and enter the total. Phone call history or your job app log is the source.</li>
            <li>Enter the share that went unanswered. Count the missed ones, divide by the total.</li>
            <li>Enter your average won job in dollars and the share of answered enquiries you turn into work.</li>
            <li>Read the monthly and yearly figure, then change any input to see how sensitive the result is.</li>
          </ol>
          <p>The numbers loaded when the page opens are an example only. They are not an industry statistic and nobody measured them.</p>
        </section>

        <section className="mc-sec">
          <h2>Worked example, with the arithmetic shown</h2>
          <p>Using the example inputs ({EXAMPLE.callsPerWeek} calls a week, {EXAMPLE.missedPct}% missed, {aud(EXAMPLE.jobValue)} a job, {EXAMPLE.closePct}% close rate, {EXAMPLE.weeksPerYear} working weeks):</p>
          <ul>
            <li>{EXAMPLE.callsPerWeek} calls x {EXAMPLE.missedPct}% = {ex.missedPerWeek} missed calls a week.</li>
            <li>{ex.missedPerWeek} x {EXAMPLE.closePct}% = {ex.lostJobsPerWeek.toFixed(1)} jobs a week you would have won.</li>
            <li>{ex.lostJobsPerWeek.toFixed(1)} x {aud(EXAMPLE.jobValue)} = {aud(ex.weekly)} a week, or {aud(ex.yearly)} over {EXAMPLE.weeksPerYear} weeks.</li>
            <li>{aud(ex.yearly)} / 12 = {aud(ex.monthly)} a month.</li>
          </ul>
          <p>This is an illustration of the method, not a claim about what any trade loses. Your own inputs decide the result.</p>
        </section>

        <section className="mc-sec">
          <h2>What the number does not tell you</h2>
          <ul>
            <li>It is revenue, not profit. Materials, labour and travel come off the top.</li>
            <li>It is a ceiling. Some missed callers were never going to book, and some ring back.</li>
            <li>Close rate on a cold missed call may differ from your rate on answered calls. If you think it is lower, lower the input.</li>
            <li>Calls from existing customers about a booked job are not lost enquiries. Leave them out of the count if you can.</li>
          </ul>
        </section>

        <section className="mc-sec">
          <h2>Ways to cut the number</h2>
          <p>None of these is a guarantee. Each one changes a different input, so test one and re-run the calculator with your new missed share.</p>
          <ul>
            <li><strong>Reply fast by text.</strong> A short message within a minute or two of a missed call tells the caller you got their call and when you will ring back. Check the ACMA rules on consent first: <a href="https://www.acma.gov.au/avoid-sending-spam" rel="noopener noreferrer">ACMA, avoid sending spam</a>.</li>
            <li><strong>Fix the voicemail greeting.</strong> Say what you do, ask for name, suburb and job, and give a time you will call back.</li>
            <li><strong>Batch your callbacks.</strong> Block two fixed windows a day so a missed call gets a ring back the same day.</li>
            <li><strong>Hand off the phone.</strong> A partner, office helper or answering service lowers the missed share directly.</li>
          </ul>
          <p>If you want the texting option set up for you, see the <Link href="/shop">TITANOS shop</Link> for the missed-call text-back kit and what each item includes. Want the follow-up and review messages written in your voice? <Link href="/offers/job-flow">Job Flow</Link> covers that. To see how a tradie flow looks end to end, open the <a href="/d/plumber/">plumber demo</a>. Tradie-specific scams and email security: <Link href="/tradies">TITANOS for tradies</Link>.</p>
        </section>

        <section className="mc-sec">
          <h2>Questions tradies ask</h2>
          {FAQ.map((f) => (
            <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
          ))}
        </section>

        <aside className="mc-cta" aria-label="Next step">
          <h2>Want the missed calls handled for you?</h2>
          <p>Browse the missed-call text-back kit in the shop, or ask for a quote. A no is welcome.</p>
          <div>
            <Link href="/shop" className="pe-btn pe-btn--gold pe-btn--lg">See the shop</Link>
            <a href="/d/plumber/" className="pe-btn pe-btn--dark pe-btn--lg">Open the plumber demo</a>
          </div>
          <p className="mc-small">Built by Kyle Deligny, Brisbane. ABN 34 318 502 254. Public information and your own numbers only.</p>
        </aside>
      </div>
    </main>
  );
}
