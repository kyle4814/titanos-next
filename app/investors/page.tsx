import type { Metadata } from "next";
import { withSeo } from "@/lib/seo";
import type { CSSProperties } from "react";
import PageHero from "@/components/PageHero";
import AnimatedButton from "@/components/AnimatedButton";
import { FlexGrid, OpenLoop } from "@/components/FlexBlock";
import { FLEX } from "@/lib/flex";
import W2c from "@/components/w2c/W2c";
import GlowCard from "@/components/house/GlowCard";
import "./investors.css";
import { int, dec, aud, v, AS_OF_LONG } from "@/lib/ledger";

const META_TITLE = "Investors: what your money builds | TITANOS";
const META_DESC =
  "The measured base, what each dollar of compute builds, and where the profits go. Not an offer of shares; an invitation to talk.";

const baseMetadata: Metadata = {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: "https://titanos.tech/investors" },
  openGraph: { title: META_TITLE, description: META_DESC, type: "website", url: "https://titanos.tech/investors" },
  robots: { index: false, follow: false }, // D6: private link, shared by invitation, never listed
};

export const metadata: Metadata = withSeo("/investors", baseMetadata);

const A: CSSProperties = { color: "var(--pe-gold-hi)" };

const BASE: [string, string][] = [
  ["3.5 hours", "idea to a working, tested app (replay on the proof page)"],
  [`~${v("annual_ey")}`, `engineers' worth of output a year, priced by the COCOMO model (MODELLED, ${AS_OF_LONG})`],
  [aud("compute_today_aud_month"), "a month in AI tools behind all of it (operator figure, no receipt on file)"],
];

const COMPUTE: [string, string, string][] = [
  [`${aud("compute_today_aud_month")} a month (today)`, "1", `~${v("annual_ey")} engineers' worth a year (MODELLED: Basic COCOMO on measured lines)`],
];

export default function Investors() {
  return (
    <W2c>
      <PageHero
        badge="Investors, by private link"
        title="What your money builds."
        sub="A measured base you can check, what each dollar of compute turns into, and where every dollar of profit goes. This is not an offer of shares. It is an invitation to talk, and a no is welcome."
      />
      <div className="pe-page pe-page--narrow pe-section inv">
        <div>
          <h2 className="pe-sec-h">The measured base</h2>
          <p className="pe-muted pe-body">
            Each card carries its own label. The first is modelled with the COCOMO method, the second is measured off the
            running system, and the third is a recorded same-25-job comparison. The source is one tap away on each. This is
            the base, not an offer.
          </p>
          <FlexGrid items={[FLEX.engineers, FLEX.fleetJobs, FLEX.costPerJob]} />
          <p className="pe-muted pe-body" style={{ marginTop: 14 }}>
            Think of it as a whole engineering department for the price of one person, with the receipts kept. Before you
            ask: I am Kyle Deligny, a sole trader (ABN 34 318 502 254). Everything here is built from public records and our
            own logs, nothing of anyone&apos;s is touched, and nobody is replaced.
          </p>
          <OpenLoop>What does that look like as a few plain lines you can check yourself?</OpenLoop>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {BASE.map(([n, l]) => (
              <GlowCard key={l} className="w2c-stat pe-card">
                <div className="w2c-stat__n">{n}</div>
                <div className="w2c-stat__l">{l}</div>
              </GlowCard>
            ))}
          </div>
          <p className="pe-muted pe-body" style={{ marginTop: 12 }}>
            Check every line: <a href="/proof" style={A}>public code, timestamped test logs and a replayable build</a>, and
            the <a href="/engineering" style={A}>engineering maths</a>.
          </p>

          <OpenLoop>So what happens if the compute budget goes up? The next table is where that gets honest.</OpenLoop>
          <h2 className="pe-sec-h">What compute buys</h2>
          <p className="pe-muted pe-body">
            Each {aud("compute_today_aud_month")} a month buys one AI build account. Today that is about {dec("estate_ey")} engineer-years modelled over {v("span_days")} days
            (Basic COCOMO on {int("estate_sloc")} measured lines). More accounts would run more work in parallel, but the scale-up rows are
            scenarios with no result behind them, so none is printed here until weekly results confirm one.
          </p>
          <div tabIndex={0} className="pe-table-wrap">
            <table style={{ width: "100%", minWidth: 520 }}>
              <thead>
                <tr>
                  {["Monthly compute", "Build accounts", "Engineering output"].map((h) => (
                    <th key={h} style={{ textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPUTE.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c) => (
                      <td key={c}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <OpenLoop>And if it did scale, where would the money go?</OpenLoop>
          <h2 className="pe-sec-h">Where the profits go</h2>
          <p className="pe-muted pe-body">
            There is no revenue projection on this page, because there is no paying-client result behind one yet. What is on
            record is the founder&apos;s stated plan (a plan, not a result and not a guarantee): profit goes back into
            compute, people and reach first, and a world share follows once the company is established. The wording and
            its limits live on the <a href="/mission" style={A}>mission page</a>, and the first real revenue figure will
            appear here only once it is VERIFIED against a receipt.
          </p>

          <OpenLoop>Why would a big buyer pick this over the other options?</OpenLoop>
          <h2 className="pe-sec-h">Why it is defensible</h2>
          <ul className="pe-muted pe-body" style={{ paddingLeft: 20 }}>
            <li style={{ marginBottom: 8 }}>
              We build one enterprise platform, once. Each client gets a configured copy on their own account, so delivery
              takes days, not months.
            </li>
            <li style={{ marginBottom: 8 }}>
              The systems are about 99% code (ESTIMATE: a design ratio, not a measured share), so they run for about AU$20 to AU$50 a month. See <a href="/costs" style={A}>costs</a>.
            </li>
            <li style={{ marginBottom: 8 }}>
              Nothing replaced and nobody replaced, which removes the biggest reason large buyers say no. See{" "}
              <a href="/parallax" style={A}>Parallax</a>.
            </li>
          </ul>

          <h2 className="pe-sec-h">How investing works here</h2>
          <p className="pe-muted pe-body">
            TITANOS is run by Kyle Deligny as a sole trader (ABN 34 318 502 254), so there are no shares to offer today.
            Any investment would follow incorporation, proper legal and accounting advice, and documents that meet the
            law. The founder keeps control: total outside ownership is planned to stay under 49% (PROPOSED: the founder's stated position, not a legal commitment). Nothing on this page is financial
            advice or an offer of any financial product.
          </p>

          <p className="pe-muted pe-body" style={{ textAlign: "center", marginTop: 32 }}>
            If the numbers interest you, would it be okay if we had a conversation? There is no pressure, and a no is welcome. Or <a href="/audit" style={A}>book a free consultation</a>.
          </p>
          <div style={{ textAlign: "center", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <AnimatedButton href="/contact">Start a conversation</AnimatedButton>
            <AnimatedButton href="/proof" variant="secondary">
              Check the proof
            </AnimatedButton>
          </div>
        </div>
      </div>
    </W2c>
  );
}
