import { CONTACT_HREF } from "@/lib/config";
import {
  ADM_HEADLINE, ADM_INTRO, ADM_FACTS, ADM_SOURCES, ADM_CONCERNS, ADM_SPRINT_STEPS, ADM_BONUSES,
  ADM_OPTIONS, ADM_WORKED_EXAMPLE, ADM_CLOSE_LEAD, ADM_CLOSE_NOTE, ADM_CTA_LABEL,
} from "@/lib/admOffer";

// Server component for /adm-sprint. Static: no form, no state, no fetch, no tracking, no popup.
// The only link out is a plain anchor to the contact page.
export default function AdmOffer() {
  const sec = { display: "flex", flexDirection: "column", gap: 12, margin: "0 0 40px" } as const;
  const list = { margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 } as const;
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "96px 20px 64px" }} data-adm-offer="">
      <header style={sec}>
        <h1 style={{ margin: 0 }}>{ADM_HEADLINE}</h1>
        <p style={{ margin: 0 }}>{ADM_INTRO}</p>
      </header>

      <section style={sec} aria-labelledby="adm-facts" data-adm-facts="">
        <h2 id="adm-facts" style={{ margin: 0 }}>What we found</h2>
        <ul style={list}>
          {ADM_FACTS.map((f) => (
            <li key={f.big}><strong>{f.big}</strong> {f.text} <small>Source: {ADM_SOURCES.find((s) => s.id === f.source)?.label}.</small></li>
          ))}
        </ul>
      </section>

      <section style={sec} aria-labelledby="adm-concerns" data-adm-concerns="">
        <h2 id="adm-concerns" style={{ margin: 0 }}>Before you read further</h2>
        <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {ADM_CONCERNS.map((c) => (
            <div key={c.id} data-concern={c.id}><dt><strong>{c.q}</strong></dt><dd style={{ margin: 0 }}>{c.a}</dd></div>
          ))}
        </dl>
      </section>

      <section style={sec} aria-labelledby="adm-sprint">
        <h2 id="adm-sprint" style={{ margin: 0 }}>How the sprint works</h2>
        <ol style={list}>{ADM_SPRINT_STEPS.map((s) => <li key={s.n}><strong>{s.title}.</strong> {s.text}</li>)}</ol>
        <h3 style={{ margin: 0 }}>Included</h3>
        <ul style={list}>{ADM_BONUSES.map((b) => <li key={b}>{b}</li>)}</ul>
      </section>

      <section style={sec} aria-labelledby="adm-options" data-adm-options="">
        <h2 id="adm-options" style={{ margin: 0 }}>Two ways to work together</h2>
        {ADM_OPTIONS.map((o) => (
          <article key={o.id} data-option={o.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h3 style={{ margin: 0 }}>{o.name}: {o.price}</h3>
            <ul style={list}>{o.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </article>
        ))}
        <p style={{ margin: 0 }}><small>{ADM_WORKED_EXAMPLE}</small></p>
      </section>

      <section style={sec} aria-labelledby="adm-sources" data-adm-sources="">
        <h2 id="adm-sources" style={{ margin: 0 }}>Where these figures come from</h2>
        <ul style={list}>{ADM_SOURCES.map((s) => <li key={s.id}>{s.label}.</li>)}</ul>
      </section>

      <section style={sec} aria-labelledby="adm-close" data-adm-close="">
        <h2 id="adm-close" style={{ margin: 0 }}>Would it be okay?</h2>
        <p style={{ margin: 0 }}>{ADM_CLOSE_LEAD}</p>
        <p style={{ margin: 0 }}>{ADM_CLOSE_NOTE}</p>
        <p style={{ margin: 0 }}><a href={CONTACT_HREF}>{ADM_CTA_LABEL}</a></p>
      </section>
    </main>
  );
}
