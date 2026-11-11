import PhiWordmark from "./PhiWordmark";
import HeroMesh from "@/components/home/HeroMesh";
import hs from "@/components/home/Home.module.css";
import SpaceImage from "@/components/SpaceImage";
import { HERO_IMAGE_ID, HERO_PORTRAIT_MEDIA } from "@/lib/space-images";
import { HERO_STRIP, dec, int, v } from "@/lib/ledger";

/** MOBILE LIKE-FOR-LIKE (Kyle 2026-10-13): phones get the same composition as desktop, stacked: the same NASA poster (art-directed
 *  portrait crop, jet across the top third behind the headline), wordmark, strapline, headline, ledger line, paragraph, CTA. The still
 *  poster IS the hero on every screen. Rules in design-system.css (max-width: 800px).
 *
 *  DESKTOP = THE BLACK HOLE (Kyle 2026-10-13): the WebGL Julia fractal + point-knot layer (HeroStage) is gone; it faded the NASA poster
 *  out on desktop. The server-rendered poster (real NASA/JPL imagery, AVIF/WebP, under 200 KB) + copy are the hero and the LCP. One CTA. HERO LOCK (Kyle): the h1 is the engineer-years line; its figure comes from lib/ledger.json (estate_ey) and the strip under it states the basis (MODELLED, COCOMO). */
export default function Hero() {
  return (
    <section className="ds-hero" aria-labelledby="ds-hero-h">
      <SpaceImage id={HERO_IMAGE_ID} className="ds-hero__poster" sizes="100vw" priority alt="" portrait={HERO_PORTRAIT_MEDIA} />
      <HeroMesh />
      <a className="ds-hero__credit" href="/credits#nasa-black-hole-jet">Image: NASA/JPL-Caltech, artist's concept</a>
      <div className="ds-hero__copy">
        <div className="ds-hero__col">
          <div className="ds-hero__enter"><PhiWordmark height={26} /></div>
          <p className="ds-hero__eyebrow ds-hero__enter">The birth of a global intelligence system · our own system, measured on itself</p>
          <h1 id="ds-hero-h" className={`ds-hero__enter ${hs.h1} ${hs.h1}`}>{dec("estate_ey")} engineer-years of output in {Math.round(v("elapsed_months"))} months.</h1>
          <p className="ds-hero__strip ds-hero__enter">{HERO_STRIP}</p>
          <p className={`ds-hero__sub ds-hero__enter ${hs.sub}`}>
            In one day the cost of a matched job fell from US${v("cost_job_before").toFixed(2)} to US${v("cost_job_after").toFixed(2)} (25 jobs, same tasks), and the main engine carries {int("tests_main")} test cases. We did not buy a bigger machine. We changed the system.
          </p>
          <div className="ds-hero__enter">
            <a className="ds-cta" href="/proof">See the receipts →</a>
          </div>
        </div>
      </div>
    </section>
  );
}
