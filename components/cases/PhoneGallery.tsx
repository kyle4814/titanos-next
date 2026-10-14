import type { CaseShot } from "@/lib/caseStudies";
import s from "./cases.module.css";

/** Phone-frame screenshot gallery: swipe row on phones, grid on desktop. The caption carries the alt text, so the image itself is decorative. */
export default function PhoneGallery({ shots }: { shots: CaseShot[] }) {
  return (
    <ul className={s.gallery} aria-label="Screens from the working app" tabIndex={0}>
      {shots.map((sh) => (
        <li key={sh.src} className={s.shot}>
          <figure style={{ margin: 0 }} className={s.reveal}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sh.src} alt="" loading="lazy" width={780} height={1688} className={s.phone} />
            <figcaption className={s.caption}>{sh.alt}</figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
