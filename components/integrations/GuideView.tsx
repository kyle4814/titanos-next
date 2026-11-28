import Link from "next/link";
import "@/components/home-redesign/home-redesign.css";
import "@/components/integrations/integrations.css";
import JsonLd from "@/components/JsonLd";
import { article, breadcrumbs, faqPage } from "@/lib/jsonld";
import { AS_AT, COMPLIANCE_SOURCES, GUIDES, MONEY, REVIEWED, REVIEWED_LABEL, TASK_LABEL, type Guide } from "@/lib/integrations";

export function Crumbs({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <nav className="ig-crumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((t, i) => (
          <li key={t.path}>{i === trail.length - 1 ? <span aria-current="page">{t.name}</span> : <Link href={t.path}>{t.name}</Link>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function ByLine() {
  return (
    <p className="ig-meta">
      By <Link href="/about">Kyle Deligny</Link>, Titanos, Brisbane. Last reviewed {REVIEWED_LABEL}.
    </p>
  );
}

export function Disclaimer({ name }: { name?: string }) {
  return (
    <p className="ig-disclaimer">
      Based on {name ? `${name}'s` : "each vendor's"} documentation as at {AS_AT}. We have not tested these integrations ourselves. Vendors change plans, names and limits, so confirm each step in your own account before you rely on it.
    </p>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="ig-faq">
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export default function GuideView({ g }: { g: Guide }) {
  const path = `/integrations/${g.slug}`;
  const trail = [
    { name: "Home", path: "/" },
    { name: "Integrations", path: "/integrations" },
    { name: g.name, path },
  ];
  const siblings = GUIDES.filter((x) => x.slug !== g.slug).slice(0, 3);
  return (
    <main>
      <JsonLd data={article({ path, headline: g.h1, description: g.metaDescription, datePublished: REVIEWED, dateModified: REVIEWED })} />
      <JsonLd data={faqPage(g.faq)} />
      <JsonLd data={breadcrumbs(trail)} />
      <div className="ig-page">
        <div className="ig-wrap">
          <Crumbs trail={trail} />
          <h1>{g.h1}</h1>
          <ByLine />
          {g.intro.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
          <Disclaimer name={g.name} />
          <h2>Is {g.name} the right fit for this?</h2>
          <p>{g.fit}</p>

          <h2>At a glance: what {g.name} does for each job</h2>
          <div className="ig-table-wrap">
            <table className="ig-table">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Status in the documentation</th>
                </tr>
              </thead>
              <tbody>
                {g.tasks.map((t) => (
                  <tr key={t.key}>
                    <td><a href={`#${t.key}`}>{TASK_LABEL[t.key]}</a></td>
                    <td>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {g.tasks.map((t) => (
            <section key={t.key} id={t.key} className="pe-card ig-task">
              <span className="ig-pill">{t.status}</span>
              <h2>{t.title}</h2>
              <h3>What {g.name} does natively</h3>
              <p>{t.native}</p>
              <h3>What needs Zapier, Make or the API</h3>
              <p>{t.viaTools}</p>
              <h3>Exact steps</h3>
              <ol className="ig-steps">
                {t.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <div className="ig-src">
                Sources:
                <ul>
                  {t.sources.map((s) => (
                    <li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>
                  ))}
                </ul>
              </div>
              <p style={{ marginTop: 14 }}>
                Want the wording for this job? See the <Link href={MONEY[t.key].href}>{MONEY[t.key].label}</Link>.
              </p>
            </section>
          ))}

          <h2>Worked example with labelled example numbers</h2>
          <div className="pe-card ig-example">
            <h3 style={{ marginTop: 0 }}>{g.example.title}</h3>
            <p>{g.example.intro}</p>
            <dl>
              {g.example.rows.map((r) => (
                <div key={r.label} style={{ display: "contents" }}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="ig-result">{g.example.result}</p>
            <p>{g.example.caveat}</p>
          </div>

          <h2>What we could not confirm</h2>
          <ul className="ig-list">
            {g.gaps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <h2>Before you text customers automatically</h2>
          <p>
            Commercial text messages in Australia are covered by the Spam Act 2003, and customer phone numbers are personal information. Read the guidance first. This is general information, not legal advice.
          </p>
          <ul className="ig-list">
            {COMPLIANCE_SOURCES.map((s) => (
              <li key={s.url}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>
            ))}
          </ul>

          <h2>Frequently asked questions</h2>
          <Faq items={g.faq} />

          <h2>Where to go next</h2>
          <p>{g.moneyLead}</p>
          <div className="ig-cta">
            <Link className="pe-btn pe-btn--gold" href="/shop">Browse the shop</Link>
            <Link className="pe-btn pe-btn--dark" href="/tradies">Job Flow for tradies</Link>
            <Link className="pe-btn pe-btn--dark" href="/audit">Free AI audit</Link>
          </div>
          <p>
            Back to the <Link href="/integrations">integrations hub</Link>. Related guides: {siblings.map((s, i) => (
              <span key={s.slug}>{i > 0 ? ", " : ""}<Link href={`/integrations/${s.slug}`}>{s.name}</Link></span>
            ))}. {g.siblingNote}
          </p>
        </div>
      </div>
    </main>
  );
}
