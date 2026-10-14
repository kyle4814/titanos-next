import type { CaseStudy } from "@/lib/caseStudies";
import s from "./cases.module.css";

/** Speed records: the first fact of each case, taken straight from lib/caseStudies.ts. */
export default function SpeedStrip({ cases }: { cases: CaseStudy[] }) {
  return (
    <ul className={`${s.strip} ${s.wide}`} aria-label="Speed records from the case studies">
      {cases.map((c) => (
        <li key={c.slug} className={`${s.stripItem} ${s.reveal}`}>
          <span className={s.stripNum}>{c.facts[0][0]}</span>
          <span className={s.stripSector}>{c.sector}</span>
          <span className={s.stripNote}>{c.facts[0][1]}</span>
        </li>
      ))}
    </ul>
  );
}
