import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { FlexGrid, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";

const META_TITLE = "Investors: what your money builds | TITANOS";
const META_DESC =
  "The measured base, what each dollar of compute builds, the ladder to AU$1 million a month, and where the profits go. Not an offer of shares; an invitation to talk.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/investors" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/investors" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/investors", baseMetadata);

const SECTION: CSSProperties = { padding: "var(--space-12) 20px", position: "relative", zIndex: 2 };
const WRAP: CSSProperties = { maxWidth: 860, margin: "0 auto" };
const H: CSSProperties = { color: "var(--gold)", fontSize: 22, margin: "34px 0 10px" };
const BODY: CSSProperties = { color: "var(--ice)", fontSize: "var(--fs-body)", lineHeight: 1.75, margin: "0 0 14px" };
const CARD: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: "16px 18px",
};
const CELL: CSSProperties = { padding: "10px 8px", borderBottom: "1px solid var(--border)", color: "var(--ice)", fontSize: 15 };
const A: CSSProperties = { color: "var(--gold)" };

const BASE: [string, string][] = [
  ["3.5 hours", "idea to a working, tested app (replay on the proof page)"],
  ["~132", "engineers' worth of output a year, priced by the COCOMO model"],
  ["AU$300", "a month in AI tools behind all of it"],
  ["~6,400x", "engineering value per dollar of compute (AU$23M a year of work on AU$3,600 a year)"],
];

const COMPUTE: [string, string, string][] = [
  ["AU$300 a month (today)", "1", "~132 engineers' worth a year (measured)"],
  ["AU$1,000 a month", "3", "~19,000 engineers' worth a year (modelled)"],
  ["AU$10,000 a month", "33", "~209,000 engineers' worth a year (modelled)"],
  ["AU$100,000 a month", "333", "~2.1 million engineers' worth a year (modelled)"],
];

const LADDER: [string, string, string, string, string][] = [
  ["AU$10,000", "AU$10,000 (living)", "-", "-", "Founder full focus funded"],
  ["AU$20,000", "AU$10,000", "AU$10,000", "-", "~33 build accounts"],
  ["AU$100,000", "AU$10,000 (10%)", "AU$15,000 (15%)", "AU$75,000 (75%)", "~50 build accounts; AU$900k a year to the world"],
  ["AU$1,000,000", "AU$50,000 (5%)", "AU$150,000 (15%)", "AU$800,000 (80%)", "~500 build accounts; AU$9.6M a year to the world"],
];

export default function Investors() {
  return (
    <div>
      <PageHero
        badge="Investors"
        title="What your money builds."
        sub="A measured base you can check, what each dollar of compute turns into, and where every dollar of profit goes. This is not an offer of shares. It is an invitation to talk, and a no is welcome."
      />
      <section style={SECTION}>
        <div style={WRAP}>
          <h2 style={H}>The measured base</h2>
          <p style={BODY}>
            Each card carries its own label. The first is modelled with the COCOMO method, the second is measured off the
            running system, and the third is a recorded same-25-job comparison. The source is one tap away on each. This is
            the base, not an offer.
          </p>
          <FlexGrid items={[FLEX.engineers, FLEX.fleetJobs, FLEX.costPerJob]} />
          <p style={{ ...BODY, marginTop: 14 }}>
            Think of it as a whole engineering department for the price of one person, with the receipts kept. Before you
            ask: I am Kyle Deligny, a sole trader (ABN 34 318 502 254). Everything here is built from public records and our
            own logs, nothing of anyone&apos;s is touched, and nobody is replaced.
          </p>
          <OpenLoop>What does that look like as a few plain lines you can check yourself?</OpenLoop>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {BASE.map(([n, l]) => (
              <div key={l} style={CARD}>
                <div style={{ color: "var(--gold)", fontSize: 26, fontWeight: 700 }}>{n}</div>
                <div style={{ color: "var(--ice)", fontSize: 14, lineHeight: 1.5 }}>{l}</div>
              </div>
            ))}
          </div>
          <p style={{ ...BODY, marginTop: 12 }}>
            Check every line: <a href="/proof" style={A}>public code, timestamped test logs and a replayable build</a>, and
            the <a href="/engineering" style={A}>engineering maths</a>.
          </p>

          <OpenLoop>So what happens if the compute budget goes up? The next table is where that gets honest.</OpenLoop>
          <h2 style={H}>What compute buys</h2>
          <p style={BODY}>
            Each AU$300 a month buys one AI build account. The first row is measured. The rest are calculations built on it,
            including the speed-ups from turning repeated work into code; they become facts only as weekly results confirm
            them, and we publish those results.
          </p>
          <div tabIndex={0} style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr>
                  {["Monthly compute", "Build accounts", "Engineering output"].map((h) => (
                    <th key={h} style={{ ...CELL, color: "var(--gold)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPUTE.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c) => (
                      <td key={c} style={CELL}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <OpenLoop>And if it did scale, where would the money go?</OpenLoop>
          <h2 style={H}>The ladder to AU$1 million a month, and where it goes</h2>
          <p style={BODY}>
            Monthly revenue, split between the founder, the system (compute, people, the next product) and the world
            (charities, education, housing, jobs). The founder&apos;s share is capped at what a good life needs; the
            rest compounds or goes back out.
          </p>
          <div tabIndex={0} style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  {["Revenue a month", "Founder", "System", "World", "What it means"].map((h) => (
                    <th key={h} style={{ ...CELL, color: "var(--gold)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LADDER.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c, i) => (
                      <td key={i} style={CELL}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ ...BODY, fontSize: 13, opacity: 0.75, marginTop: 8 }}>
            The split is the founder&apos;s stated plan, not a guarantee. More on the world share on the{" "}
            <a href="/mission" style={A}>mission page</a>.
          </p>

          <OpenLoop>Why would a big buyer pick this over the other options?</OpenLoop>
          <h2 style={H}>Why it is defensible</h2>
          <ul style={{ ...BODY, paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              We build one enterprise platform, once. Each client gets a configured copy on their own account, so delivery
              takes days, not months.
            </li>
            <li style={{ marginBottom: 8 }}>
              The systems are 99% code, so they run for about AU$20 to AU$50 a month. See <a href="/costs" style={A}>costs</a>.
            </li>
            <li style={{ marginBottom: 8 }}>
              Nothing replaced and nobody replaced, which removes the biggest reason large buyers say no. See{" "}
              <a href="/parallax" style={A}>Parallax</a>.
            </li>
          </ul>

          <h2 style={H}>How investing works here</h2>
          <p style={BODY}>
            TITANOS is run by Kyle Deligny as a sole trader (ABN 34 318 502 254), so there are no shares to offer today.
            Any investment would follow incorporation, proper legal and accounting advice, and documents that meet the
            law. The founder keeps control: total outside ownership stays under 49%. Nothing on this page is financial
            advice or an offer of any financial product.
          </p>

          <p style={{ ...BODY, textAlign: "center", marginTop: 30 }}>
            If the numbers interest you, would it be okay if we had a conversation? There is no pressure, and a no is welcome. Or <a href="/audit" style={{ color: "var(--gold)" }}>book a free consultation</a>.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/contact">Start a conversation</AnimatedButton>
            <AnimatedButton href="/proof" variant="secondary">
              Check the proof
            </AnimatedButton>
          </div>
        </div>
      </section>
    </div>
  );
}
