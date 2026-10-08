import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import ProofWall from "@/components/charts/ProofWall";

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

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 820, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "34px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const A: CSSProperties = { color: "var(--gold)" };
const CODE: CSSProperties = {
  display: "block",
  background: "#000",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "12px 14px",
  color: "var(--ice)",
  fontSize: 13,
  overflowX: "auto",
  whiteSpace: "pre",
};

export default function Proof() {
  return (
    <div>
      <PageHero
        badge="Proof"
        title="Check it yourself."
        sub="Every claim on this site rests on a base you can check: public code, timestamped test logs, and a build you can replay commit by commit. Bigger numbers elsewhere are maths on top of this, until weekly results confirm them."
      />
      <ProofWall />
      <section style={SECTION}>
        <div style={WRAP}>
          <h2 style={H}>1. Public code, every change timestamped</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            <li>
              This website&apos;s source, every change dated to the second:{" "}
              <a href="https://github.com/kyle4814/titanos-next/commits/main" style={A}>
                github.com/kyle4814/titanos-next
              </a>
            </li>
            <li>
              SpoofGuard, our free open-source email security tool:{" "}
              <a href="https://github.com/kyle4814/spoofguard" style={A}>
                github.com/kyle4814/spoofguard
              </a>
            </li>
          </ul>

          <h2 style={H}>2. Full test runs, with timestamps</h2>
          <p style={BODY}>Raw logs, each line stamped with the time it ran (7 October 2026, Brisbane time):</p>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            <li>
              <a href="/proof/trading-app-tests.log" style={A}>
                Trading app: 250 of 250 tests passed
              </a>
            </li>
            <li>
              <a href="/proof/spoofguard-tests.log" style={A}>
                SpoofGuard: 83 of 83 tests passed
              </a>
            </li>
          </ul>

          <h2 style={H}>3. The 3.5-hour build, replayed commit by commit</h2>
          <p style={BODY}>
            We checked out every one of the 57 saved versions of the trading app in order and ran its tests. Each line of
            the replay shows when that version was saved, its ID, and how many tests passed. Tests grew from 20 at 05:41 to
            250 at 09:37.
          </p>
          <p style={BODY}>
            <a href="/proof/trading-app-build-replay.log" style={A}>
              Open the full replay log
            </a>
          </p>
          <p style={BODY}>
            Shown as found: five in-between versions each have one test that fails when replayed today. Those tests depend on
            the time of day or on live market data (for example, a session-clock label and a live one-tap trade). Every one
            passes at the final version, 250 of 250.
          </p>
          <p style={BODY}>How the replay was run, so anyone with the repository can repeat it:</p>
          <code style={CODE}>{`for c in $(git rev-list --reverse HEAD); do
  git checkout -q "$c"
  echo "$(git log -1 --format=%ci) $(node --test tests/*.test.js | grep '^# pass')"
done`}</code>

          <h2 style={H}>What this proves, and what it does not</h2>
          <p style={BODY}>
            It proves the base: real code, real tests, real timestamps, and the speed of that build. Our larger figures (the
            compounding, the second account, the engineer-equivalents) are calculations built on this base. They become facts
            only as weekly results confirm them, and we publish those results too.
          </p>

          <div style={{ textAlign: "center", marginTop: 32, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/case-studies/trading-app">The case study</AnimatedButton>
            <AnimatedButton href="/audit" variant="secondary">
              Book a free consultation
            </AnimatedButton>
          </div>
        </div>
      </section>
    </div>
  );
}
