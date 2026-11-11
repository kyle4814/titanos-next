// Shared presentational pieces of the declaration. Every string comes from lib/declaration.ts (the one content source).
import Link from "next/link";
import { ACHIEVEMENTS, CAPABILITY, CASE_LIST, CASES_NOTE, COURSES, courseAction, FIGURES, METHOD, METHOD_NOTE, SUBSCRIPTIONS, SUBSCRIPTIONS_NOTE, APPENDIX_CASES, APPENDIX_INTRO, STILL_UNKNOWN, PDF_PATH, PDF_NAME } from "@/lib/declaration";
import SubscribeForm from "./SubscribeForm";
import s from "./declaration.module.css";

export function Achievements({ limit }: { limit?: number }) {
  return <ul className={s.list}>{ACHIEVEMENTS.slice(0, limit).map((a) => <li key={a}>{a}</li>)}</ul>;
}

export function Capability() {
  return <>{CAPABILITY.map((g) => (
    <div key={g.title}><h3 className={s.h3}>{g.title}</h3><ul className={s.list}>{g.points.map((p) => <li key={p}>{p}</li>)}</ul></div>
  ))}</>;
}

export function Prices() {
  return (<>
    <ul className={s.list}>{SUBSCRIPTIONS.map((r) => <li key={r.name}><Link className={s.link} href={r.href}>{r.name}</Link>: {r.price}</li>)}</ul>
    <p className={s.small}>{SUBSCRIPTIONS_NOTE}</p>
  </>);
}

export function CaseList({ compact = false }: { compact?: boolean }) {
  return (<>
    <div className={s.grid} data-case-list>
      {CASE_LIST.map((c) => (
        <div key={c.slug} className={s.card} data-case-slug={c.slug}>
          <p className={s.small} style={{ margin: "0 0 4px" }}>{c.sector} · {c.label}</p>
          <p className={s.cardTitle}>{c.title}</p>
          <ul className={s.facts}>{(compact ? c.facts.slice(0, 2) : c.facts).map(([v, t]) => <li key={v + t}><b>{v}</b> {t}</li>)}</ul>
          <Link className={s.link} href={c.href}>Read the case study</Link>
        </div>
      ))}
    </div>
    {!compact && <p className={s.small}>{CASES_NOTE}</p>}
  </>);
}

export function Method() {
  return (<>
    <ol className={s.list}>{METHOD.map((m) => <li key={m.title}><b>{m.title}.</b> {m.text}</li>)}</ol>
    <p className={s.p}>{METHOD_NOTE}</p>
  </>);
}

export function CourseCards() {
  return (
    <div className={s.grid} data-course-cards>
      {COURSES.map((c) => {
        const act = courseAction(c);
        return (
          <div key={c.id} className={s.card} data-course={c.id}>
            <p className={s.cardTitle}>{c.title}</p>
            <p className={s.small}>{c.blurb}</p>
            {act.kind === "link" ? (
              <a className={s.btn} href={act.url} rel="noopener noreferrer">Sign up</a>
            ) : (
              <details className={s.details} data-waitlist>
                <summary>Join the waitlist</summary>
                <SubscribeForm tag={act.tag} source={act.source} label="Join the waitlist" />
              </details>
            )}
            <p className={s.small} style={{ margin: "8px 0 0" }}><Link className={s.link} href={`/case-studies/${c.caseSlug}`}>See how it was built</Link></p>
          </div>
        );
      })}
    </div>
  );
}

export function PdfButton({ secondary = false }: { secondary?: boolean }) {
  return <a className={`${s.btn} ${secondary ? s.btn2 : ""}`} href={PDF_PATH} download={PDF_NAME}>Download the PDF</a>;
}

export function Appendix() {
  return (<>
    <p className={s.small}>{APPENDIX_INTRO}</p>
    <div style={{ overflowX: "auto" }}>
      <table className={s.table}>
        <thead><tr><th scope="col">Figure</th><th scope="col">Status</th><th scope="col">Source</th><th scope="col">Date</th></tr></thead>
        <tbody>{FIGURES.map((f) => <tr key={f.id}><td>{f.value}</td><td>{f.status}</td><td>{f.source}. {f.method}</td><td>{f.asOf}</td></tr>)}</tbody>
      </table>
    </div>
    <p className={s.small}>{APPENDIX_CASES}</p>
    <p className={s.small}>{STILL_UNKNOWN}</p>
  </>);
}
