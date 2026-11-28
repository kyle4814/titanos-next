import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { article, breadcrumbs, faqPage, type Json } from "@/lib/jsonld";
import { SITE } from "@/lib/seo";
import { DMARC_SETUP_REVIEWED, DMARC_SETUP_REVIEWED_LONG, ROLLOUT, RFC_SOURCES, type Faq, type FieldRow, type Source } from "@/lib/dmarcSetup";
import s from "./setup.module.css";

export const AUTHOR_URL = `${SITE}/about`;

/** Article with the author linked to /about (lib/jsonld.ts article() has a name-only author). */
export function articleLd(a: { path: string; headline: string; description: string }): Json {
  const base = article({ ...a, datePublished: "2026-11-28", dateModified: DMARC_SETUP_REVIEWED });
  return { ...base, author: { "@type": "Person", name: "Kyle Deligny", url: AUTHOR_URL }, inLanguage: "en-AU" };
}

/** HowTo is emitted only on provider pages, where the page really is an ordered set of steps. */
export function howToLd(a: { path: string; name: string; description: string; steps: { name: string; text: string }[] }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: a.name,
    description: a.description,
    inLanguage: "en-AU",
    url: `${SITE}${a.path}`,
    step: a.steps.map((st, i) => ({ "@type": "HowToStep", position: i + 1, name: st.name, text: st.text })),
  };
}

export function Schema({ items }: { items: (Json | null)[] }) {
  return <>{items.map((d, i) => (d ? <JsonLd key={i} data={d} /> : null))}</>;
}

export function Crumbs({ trail }: { trail: { name: string; path?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={s.crumbs}>
        {trail.map((t) => (
          <li key={t.name}>{t.path ? <Link href={t.path}>{t.name}</Link> : <span aria-current="page">{t.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function crumbLd(trail: { name: string; path: string }[]) {
  return breadcrumbs(trail);
}

export function Byline() {
  return (
    <p className={s.byline}>
      By <Link href="/about">Kyle Deligny</Link>, Brisbane. Last reviewed <time dateTime={DMARC_SETUP_REVIEWED}>{DMARC_SETUP_REVIEWED_LONG}</time>. General information, not legal advice.
    </p>
  );
}

export function Code({ children }: { children: string }) {
  return <code className={s.code}>{children}</code>;
}

export function FieldTable({ rows }: { rows: FieldRow[] }) {
  return (
    <div className={s.tablewrap}>
      <table className={s.table}>
        <thead>
          <tr><th>Record</th><th>Type</th><th>Name or host</th><th>Value</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.record}><td>{r.record}</td><td>{r.type}</td><td>{r.name}</td><td>{r.value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Rollout({ name }: { name?: string }) {
  return (
    <section className={s.sec} aria-labelledby="rollout">
      <h2 id="rollout">A safe rollout: p=none, then quarantine, then reject</h2>
      <p className={s.p}>
        The reason for staging is simple. DMARC tells every receiving mail system what to do with mail that claims to be from your domain but fails SPF and DKIM. If one of your own systems (the invoicing tool, the booking software, the newsletter service) is not set up yet, going straight to reject throws away your own legitimate mail. Starting at p=none changes nothing for your mail and gives you the reports to find those systems first.
        {name ? ` The timeline below works the same way at ${name} as anywhere else; only where you type the record changes.` : ""}
      </p>
      <div className={s.tablewrap}>
        <table className={s.table}>
          <thead>
            <tr><th>Stage</th><th>When</th><th>Record</th><th>What to do</th><th>Move on when</th></tr>
          </thead>
          <tbody>
            {ROLLOUT.map((r) => (
              <tr key={r.stage}><td>{r.stage}</td><td>{r.when}</td><td><code>{r.record}</code></td><td>{r.doThis}</td><td>{r.moveOnWhen}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.note}>
        The weeks are our recommended rhythm for a small business with a handful of senders, not a standard. Microsoft&apos;s and Google&apos;s documentation both say to start at p=none, move to quarantine, then reject, and to go slowly. Microsoft suggests widening quarantine with pct in steps of 10, 25, 50, 75 and 100. Replace dmarc-reports@example.com.au with a mailbox you will really read.
      </p>
    </section>
  );
}

export function Verify({ note, name }: { note?: string; name?: string }) {
  return (
    <section className={s.sec} aria-labelledby="verify">
      <h2 id="verify">Check it worked with the free spoofing check</h2>
      <p className={s.p}>
        Run your domain through the free <Link href="/tools/email-spoofing-check">email spoofing check</Link>. It reads public DNS only: it does not log in to anything, send anything or touch your mail. After each step you should see the matching result change.
      </p>
      <ol className={s.list}>
        <li>After SPF: one SPF record is found, and it lists your mail platform.</li>
        <li>After DKIM: the selector you published is found and is a valid key.</li>
        <li>After DMARC: a record is found at _dmarc, the policy reads none, and a reporting address is present.</li>
        <li>At every later change: the policy reads quarantine or reject, and the percentage is what you set.</li>
      </ol>
      {note ? <p className={s.p}>{note}</p> : null}
      <p className={s.p}>
        You can also read the records yourself. In a Windows command prompt, <code>nslookup -type=TXT _dmarc.yourbusiness.com.au</code> shows the DMARC record, and Microsoft&apos;s documentation uses the same command to check for syntax errors or more than one _dmarc record.
        {name ? ` If the answer is empty, the likeliest causes at ${name} are a typo in the name, a record saved in a screen your nameservers do not use, or not enough waiting time.` : ""}
      </p>
    </section>
  );
}

export function Cta({ compact }: { compact?: boolean }) {
  return (
    <section className={`${s.sec}`} aria-labelledby="next-step">
      <div className={s.cta}>
        <h2 id="next-step">Want it done and checked for you?</h2>
        <p className={s.p}>
          The Email Spoofing Shield guide in the <Link href="/shop">TITANOS shop</Link> covers SPF, DKIM and DMARC for Microsoft 365, Google Workspace and cPanel hosting, with record templates, a sender inventory worksheet and a staged DMARC plan{compact ? "." : ", for the days you would rather follow a document than a web page."} If you would rather talk it through with a person, book a free <Link href="/audit">audit call with Kyle</Link>.
        </p>
        <div className={s.ctarow}>
          <Link href="/shop" className="pe-btn pe-btn--gold">See Email Spoofing Shield in the shop</Link>
          <Link href="/audit" className="pe-btn pe-btn--dark">Book the free audit</Link>
        </div>
      </div>
    </section>
  );
}

export function Sources({ list, withRfc = true }: { list: Source[]; withRfc?: boolean }) {
  const all = withRfc ? [...list, ...RFC_SOURCES] : list;
  return (
    <section className={s.sec} aria-labelledby="sources">
      <h2 id="sources">Official sources used</h2>
      <ul className={s.sources}>
        {all.map((x) => (
          <li key={x.url}><a href={x.url} rel="noopener noreferrer" target="_blank">{x.label}</a></li>
        ))}
      </ul>
    </section>
  );
}

export function FaqList({ items }: { items: Faq[] }) {
  return (
    <section className={s.sec} aria-labelledby="faq">
      <h2 id="faq">Questions people ask</h2>
      <dl className={s.faq}>
        {items.map((f) => (
          <div key={f.q}><dt>{f.q}</dt><dd>{f.a}</dd></div>
        ))}
      </dl>
    </section>
  );
}

export { faqPage, s };
