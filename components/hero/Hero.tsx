import dynamic from "next/dynamic";
import PhiWordmark from "./PhiWordmark";
import SpaceImage from "@/components/SpaceImage";
import { HERO_IMAGE_ID } from "@/lib/space-images";
import { HERO_STRIP, int, v } from "@/lib/ledger";

// ssr:false needs a client boundary; HeroStage is itself "use client", loaded as its own chunk after hydration.
const HeroStage = dynamic(() => import("./HeroStage"));

/** WEBSITE 1000X hero: starfield to braid to knot. Server-rendered poster (real NASA/JPL imagery, AVIF/WebP, under 200 KB) + copy are the LCP; the WebGL layer
 *  mounts after idle. One CTA. HERO LOCK (Kyle): the h1 is the 44 engineer-years line, exactly; the strip under it carries the current figure from the ledger. */
export default function Hero() {
  return (
    <section className="ds-hero" aria-labelledby="ds-hero-h">
      <SpaceImage id={HERO_IMAGE_ID} className="ds-hero__poster" sizes="100vw" priority alt="" />
      <HeroStage />
      <a className="ds-hero__credit" href="/credits#nasa-black-hole-jet">Image: NASA/JPL-Caltech, artist's concept</a>
      <div className="ds-hero__copy">
        <div className="ds-hero__col">
          <div className="ds-hero__enter"><PhiWordmark height={26} /></div>
          <p className="ds-hero__eyebrow ds-hero__enter">The birth of a global intelligence system · our own system, measured on itself</p>
          <h1 id="ds-hero-h" className="ds-hero__enter">44 engineer-years of output in 4 months.</h1>
          <p className="ds-hero__strip ds-hero__enter">{HERO_STRIP}</p>
          <p className="ds-hero__sub ds-hero__enter">
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
