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

/** Same as one Faq entry, for answers that carry links or computed text. */
export function FaqRow({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className={s.fItem}>
      <summary className={s.fQ}>{question}</summary>
      <p className={s.fA}>{children}</p>
    </details>
  );
}
