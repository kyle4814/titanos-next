import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import ProofWall from "@/components/charts/ProofWall";
import { FlexNumber, OpenLoop } from "@/components/FlexBlock";
import { FLEX, type Flex } from "@/lib/flex";
import Tiles, { type TileItem } from "@/components/proof/Tiles";
import Provenance from "@/components/Provenance";
import { ProofCharts } from "@/components/home/moved/ProofCharts";
import "./proof-page.css";

const REPLAY: Flex = {
  big: "250 of 250 tests, 57 saved versions",
  label: "the trading app, replayed commit by commit",
  kind: "RECORDED",
  analogy: "Like watching a builder's time-lapse where the inspector signs off every single frame, not just the finished house.",
  source: "/proof/trading-app-build-replay.log. Tests grew from 20 at 05:41 to 250 at 09:37 on 7 October 2026, Brisbane time.",
};

const RECEIPTS: TileItem[] = [
  { n: "250 of 250", l: "trading app tests passed", tag: "RECORDED", pct: 100 },
  { n: "83 of 83", l: "SpoofGuard tests passed", tag: "RECORDED", pct: 100 },
  { n: "57", l: "saved versions replayed, one by one", tag: "RECORDED" },
  { n: "3.5 hours", l: "idea to a working, tested app", tag: "RECORDED" },
];

const META_TITLE = "Proof: logs, timestamps and a replayable build | TITANOS";
const META_DESC =
  "Don't take our word for it. Public code, timestamped test logs, and a commit-by-commit replay of a 3.5-hour build.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/proof" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/proof" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/proof", baseMetadata);

export default function Proof() {
  return (
    <div className="pe-proofpage">
      <PageHero
        badge="Proof"
        title="Check it yourself."
        sub="Every claim on this site rests on a base you can check: public code, timestamped test logs, and a build you can replay commit by commit. The bigger numbers elsewhere are maths on top of this, and each says so."
      />
      <Provenance route="/proof" />
      <ProofWall />
      <section className="pe-proof__sec" style={{ paddingBottom: 0 }}>
        <div className="pe-page pe-page--narrow">
          <Tiles label="Recorded build figures" items={RECEIPTS} />
          <FlexNumber f={REPLAY} />
          <p className="pe-proof__p">
            Method: we checked out each saved version in order and ran its tests, and the command is shown below so you can repeat it.
            Nothing was touched except our own code, no one is replaced by any of it, and it costs you nothing to look.
          </p>
          <FlexNumber f={FLEX.tests} />
        </div>
      </section>
      <OpenLoop>That is the headline. What did the replay find that we did not expect?</OpenLoop>
      <section className="pe-proof__sec">
        <div className="pe-page pe-page--narrow">
          <h2 className="pe-proof__h"><span className="pe-proof__n">01</span>Public code, every change timestamped</h2>
          <ul className="pe-proof__p">
            <li>
              This website&apos;s source, every change dated to the second:{" "}
              <a href="https://github.com/kyle4814/titanos-next/commits/main">
                github.com/kyle4814/titanos-next
              </a>
            </li>
            <li>
              SpoofGuard, our free open-source email security tool:{" "}
              <a href="https://github.com/kyle4814/spoofguard">
                github.com/kyle4814/spoofguard
              </a>
            </li>
          </ul>

          <h2 className="pe-proof__h"><span className="pe-proof__n">02</span>Full test runs, with timestamps</h2>
          <p className="pe-proof__p">Raw logs, each line stamped with the time it ran (7 October 2026, Brisbane time). No summary written afterwards, just the output:</p>
          <ul className="pe-proof__p">
            <li>
              <a href="/proof/trading-app-tests.log">
                Trading app: 250 of 250 tests passed
              </a>
            </li>
            <li>
              <a href="/proof/spoofguard-tests.log">
                SpoofGuard: 83 of 83 tests passed
              </a>
            </li>
          </ul>

          <h2 className="pe-proof__h"><span className="pe-proof__n">03</span>The 3.5-hour build, replayed commit by commit</h2>
          <p className="pe-proof__p">
            Think of a builder&apos;s time-lapse. We checked out every one of the 57 saved versions of the trading app in order and ran its tests. Each line of
            the replay shows when that version was saved, its ID, and how many tests passed. Tests grew from 20 at 05:41 to
            250 at 09:37.
          </p>
          <p className="pe-proof__p">
            <a href="/proof/trading-app-build-replay.log">
              Open the full replay log
            </a>
          </p>
          <p className="pe-proof__p">
            Here is the part we did not expect, shown as found: five in-between versions each have one test that fails when replayed today. Those tests depend on
            the time of day or on live market data (for example, a session-clock label and a live one-tap trade). Every one
            passes at the final version, 250 of 250.
          </p>
          <p className="pe-proof__p">How the replay was run, so anyone with the repository can repeat it:</p>
          <code tabIndex={0} className="pe-proof__code">{`for c in $(git rev-list --reverse HEAD); do
  git checkout -q "$c"
  echo "$(git log -1 --format=%ci) $(node --test tests/*.test.js | grep '^# pass')"
done`}</code>

          <h2 className="pe-proof__h">What this proves, and what it does not</h2>
          <p className="pe-proof__p">
            It proves the base: real code, real tests, real timestamps, and the speed of that build. Our larger figures (the
            compounding, the second account, the engineer-equivalents) are calculations built on this base, and each is labelled
            as a model. They become facts only as weekly results confirm them, and we publish those results too.
          </p>

          <div className="pe-proof__close">
          <p className="pe-proof__p">
            Would it be okay if I showed you what a build like this could look like for your business? A no is welcome.
          </p>
          <div className="pe-proof__cta">
            <AnimatedButton href="/case-studies/trading-app">The case study</AnimatedButton>
            <AnimatedButton href="/audit" variant="secondary">
              Book a free consultation
            </AnimatedButton>
          </div>
          </div>
        </div>
      </section>
      <ProofCharts />
    </div>
  );
}
