import s from "./cases.module.css";

/** Bold band of headline facts. The first fact is the biggest number and gets the most room. */
export default function FactBand({ facts }: { facts: [string, string][] }) {
  return (
    <div className={`${s.band} ${s.wide}`}>
      {facts.map(([n, l], i) => (
        <div key={l} className={`${s.fact} ${i === 0 ? s.factFirst : ""} ${s.reveal}`}>
          <div className={s.factNum}>{n}</div>
          <div className={s.factLabel}>{l}</div>
        </div>
      ))}
    </div>
  );
}
