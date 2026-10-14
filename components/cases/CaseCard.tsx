import s from "./cases.module.css";

export type CaseCardProps = {
  href: string;
  cover: string;
  coverAlt: string;
  sector: string;
  title: string;
  teaser: string;
  big?: [string, string];
  feature?: boolean;
  kicker?: string;
};

/** One bento card: cover, the headline number big, then the words. The whole card is the link. */
export default function CaseCard({ href, cover, coverAlt, sector, title, teaser, big, feature, kicker }: CaseCardProps) {
  return (
    <a href={href} className={`${s.card} ${s.reveal} ${feature ? s.feature : ""}`}>
      <div className={s.coverWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt={coverAlt} loading={feature ? "eager" : "lazy"} width={780} height={1688} className={s.cover} />
      </div>
      <div className={s.cardBody}>
        {big && (
          <>
            <div className={s.bigNum}>{big[0]}</div>
            <div className={s.bigLabel}>{big[1]}</div>
          </>
        )}
        <div className={s.sector}>
          {kicker ? `${kicker} · ` : ""}
          {sector}
        </div>
        <h2 className={s.cardTitle}>{title}</h2>
        <p className={s.cardText}>{teaser}</p>
        <div className={s.more}>
          Read the case study <span aria-hidden="true">→</span>
        </div>
      </div>
    </a>
  );
}
