import s from "./w2e.module.css";

/** Native <details> FAQ: same questions and answers, zero client JS. */
export default function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className={s.faq}>
      {items.map((f) => (
        <details key={f.q} className={s.fItem}>
          <summary className={s.fQ}>{f.q}</summary>
          <p className={s.fA}>{f.a}</p>
        </details>
      ))}
    </div>
  );
}
