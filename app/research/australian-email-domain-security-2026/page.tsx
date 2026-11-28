import type { Metadata } from "next";
import Link from "next/link";
import { withSeo } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import { article, breadcrumbs, dataset, faqPage } from "@/lib/jsonld";
import { longDate } from "@/lib/provenance";
import "@/components/home-redesign/home-redesign.css";
import {
  BANDS, SECURITY_TXT_SURVEY, STUDY_CSV, STUDY_DATE_PUBLISHED, STUDY_DATE_RUN, STUDY_PATH,
  pct, pct1, surveyNoFilePct, totals,
} from "@/lib/research/emailDomainSecurity";
import s from "./study.module.css";

const TITLE = "Australian email domain security study 2026";
const META_TITLE = "Australian email domain security study 2026 | TITANOS";
const META_DESC =
  "We checked DMARC and security.txt on 318 small Australian .com.au domains: 48.1% have both gaps. Method, sample size, charts and CSV, no business named.";

export const metadata: Metadata = withSeo(STUDY_PATH, {
  title: META_TITLE,
  description: META_DESC,
  alternates: { canonical: `https://titanos.tech${STUDY_PATH}` },
  openGraph: { title: META_TITLE, description: META_DESC, type: "article", url: `https://titanos.tech${STUDY_PATH}` },
  robots: { index: true, follow: true },
});

const T = totals();
const gapPct = pct1(T.dmarcGap, T.live);
const dblPct = pct1(T.doubleGap, T.live);
const [ciLo, ciHi] = T.ci;
const notDouble = T.dmarcGap - T.doubleGap;
const enforced = T.live - T.dmarcGap;
const survey = SECURITY_TXT_SURVEY;

const FAQ = [
  { q: "Is this a list of businesses?", a: "No. The page and the CSV hold counts per sample band only. No domain, business or person is named, and the per-domain rows are not published." },
  { q: "Is 48.1% the share of all Australian small businesses?", a: "No. It is the share of the 318 domains we could check. They were chosen from the lower end of a popularity ranking and spread evenly, not drawn at random, so it describes that sample and is a pointer, not a census." },
  { q: "What is the 99.76% figure I have seen quoted?", a: "It comes from a separate study by IoT Defense of 241,285,150 gTLD domains, and it is about security.txt, not email. It excludes .com.au. We cite it as theirs and did not recompute it." },
  { q: "What does a DMARC gap mean in plain terms?", a: "The domain has no DMARC record, or one set to p=none, which only watches. Nothing tells receiving mail systems to reject or quarantine mail that falsely claims to be from the business." },
];

function BandChart() {
  const W = 640, H = 300, L = 44, B = 46, TOP = 20, plotH = H - B - TOP, bw = 48, gap = (W - L - 16 - bw * BANDS.length) / (BANDS.length - 1);
  const y = (v: number) => TOP + plotH - (v / 60) * plotH;
  const pooled = pct(T.doubleGap, T.live);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="c1t c1d">
      <title id="c1t">Double gap rate by sample band</title>
      <desc id="c1d">{`Share of live domains with both a DMARC gap and no security.txt, per band: ${BANDS.map((b, i) => `band ${i + 1} ${pct1(b.doubleGap, b.live)}`).join(", ")}. Pooled ${dblPct}.`}</desc>
      {[0, 20, 40, 60].map((v) => (
        <g key={v}><line className={s.axis} x1={L} x2={W - 8} y1={y(v)} y2={y(v)} /><text className={s.tm} x={L - 6} y={y(v) + 4} textAnchor="end">{v}%</text></g>
      ))}
      {BANDS.map((b, i) => {
        const x = L + 8 + i * (bw + gap);
        const v = pct(b.doubleGap, b.live);
        return (
          <g key={b.id}>
            <rect className={s.gold} x={x} y={y(v)} width={bw} height={y(0) - y(v)} rx={3} />
            <text className={s.tb} x={x + bw / 2} y={y(v) - 6} textAnchor="middle">{v.toFixed(1)}%</text>
            <text className={s.tm} x={x + bw / 2} y={H - 26} textAnchor="middle">{`Band ${i + 1}`}</text>
            <text className={s.tm} x={x + bw / 2} y={H - 12} textAnchor="middle">{`${b.rankLow / 1000}k-${b.rankHigh / 1000}k`}</text>
          </g>
        );
      })}
      <line className={s.ref} x1={L} x2={W - 8} y1={y(pooled)} y2={y(pooled)} />
      <text className={s.t} x={W - 10} y={y(pooled) - 6} textAnchor="end">{`Pooled ${dblPct}`}</text>
    </svg>
  );
}

function StackBar({ id, title, parts, total, label }: { id: string; title: string; parts: { name: string; n: number; cls: string }[]; total: number; label: string }) {
  const W = 640, L = 8, bw = W - 16;
  let x = L;
  return (
    <svg viewBox={`0 0 ${W} 120`} role="img" aria-labelledby={`${id}t ${id}d`}>
      <title id={`${id}t`}>{title}</title>
      <desc id={`${id}d`}>{`${label}: ${parts.map((p) => `${p.name} ${p.n} of ${total} (${pct1(p.n, total)})`).join(", ")}.`}</desc>
      {parts.map((p, i) => {
        const w = (p.n / total) * bw;
        const cx = x;
        x += w;
        return (
          <g key={p.name}>
            <rect className={s[p.cls as keyof typeof s]} x={cx} y={14} width={w} height={36} />
            <text className={s.tb} x={cx + w / 2} y={37} textAnchor="middle">{pct1(p.n, total)}</text>
            <rect className={s[p.cls as keyof typeof s]} x={8 + (i % 2) * 320} y={70 + Math.floor(i / 2) * 20} width={10} height={10} />
            <text className={s.t} x={24 + (i % 2) * 320} y={79 + Math.floor(i / 2) * 20}>{`${p.name}: ${p.n}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Study() {
  const path = STUDY_PATH;
  return (
    <>
      <JsonLd data={{ ...article({ path, headline: TITLE, description: META_DESC, datePublished: STUDY_DATE_PUBLISHED, dateModified: STUDY_DATE_PUBLISHED }), inLanguage: "en-AU" }} />
      <JsonLd data={dataset({ name: TITLE, description: "Per-band aggregate counts of DMARC and security.txt checks on 318 live Australian .com.au domains. No domain is named.", path, files: [{ url: STUDY_CSV, format: "text/csv" }], dateModified: STUDY_DATE_PUBLISHED, licenceNote: "Free to quote with a link to this page." })} />
      <JsonLd data={faqPage(FAQ)} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Open data", path: "/open-data" }, { name: TITLE, path }])} />
      <main className={s.shell}>
        <div className={s.wrap}>
          <nav aria-label="Breadcrumb">
            <ol className={s.crumbs}>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/open-data">Open data</Link></li>
              <li><span aria-current="page">Email domain security study</span></li>
            </ol>
          </nav>
          <p className={s.kicker}>Research</p>
          <h1 className={s.h1}>Australian email domain security study, 2026</h1>
          <p className={s.byline}>
            By <Link href="/about">Kyle Deligny</Link>, Brisbane. Data collected {STUDY_DATE_RUN}. Published <time dateTime={STUDY_DATE_PUBLISHED}>{longDate(STUDY_DATE_PUBLISHED)}</time>. Aggregates only, no business named.
          </p>
          <p className={s.bluf}>
            We checked {T.live} small Australian .com.au domains. {gapPct} had no enforced DMARC policy, which means anyone can send mail that looks like it came from them, and {dblPct} had that gap and also no security.txt file. The figure is a count of one dated sample, with the method, the sample size and the limits below.
          </p>

          <ul className={s.stats}>
            <li className={s.stat}><b>{T.live}</b><span>live domains checked, from {T.sampled} drawn across {BANDS.length} sample bands</span></li>
            <li className={s.stat}><b>{gapPct}</b><span>no DMARC record, or p=none ({T.dmarcGap} domains)</span></li>
            <li className={s.stat}><b>{dblPct}</b><span>double gap: DMARC gap and security.txt confirmed absent ({T.doubleGap} domains)</span></li>
          </ul>
          <p className={s.note}>Reading the double gap number: {ciLo.toFixed(1)}% to {ciHi.toFixed(1)}% is a 95% Wilson interval for the pooled rate if the sample were random. It was not random, so treat the interval as the size of the sampling noise, not a guarantee about all Australian domains.</p>

          <section className={s.sec} aria-labelledby="by-band"><h2 id="by-band">The double gap by sample band</h2>
            <p className={s.p}>Each band is a slice of 100,000 ranks in a public popularity list. The rate sits between 37.5% and 55.0% in every band, so the result does not hinge on one slice.</p>
            <figure className={s.fig}>
              <BandChart />
              <figcaption>Share of live domains in each band with a DMARC gap and no security.txt. Bands 1 to 8 run from the least popular slice (ranks 900,000 to 1,000,000) to ranks 200,000 to 300,000. The dashed line is the pooled rate of {dblPct}.</figcaption>
            </figure>
          </section>

          <section className={s.sec} aria-labelledby="where"><h2 id="where">Where the {T.live} domains land</h2>
            <figure className={s.fig}>
              <StackBar id="c2" title="Outcome for all live domains" label="Outcome for all live domains" total={T.live}
                parts={[
                  { name: "Double gap", n: T.doubleGap, cls: "gold" },
                  { name: "DMARC gap, security.txt not confirmed absent", n: notDouble, cls: "goldlo" },
                  { name: "DMARC at quarantine or reject", n: enforced, cls: "teal" },
                ]} />
              <figcaption>Of the {notDouble} domains with a DMARC gap but no confirmed security.txt absence, {T.unknown} were recorded as unreadable at the time (timeouts, security challenges or a catch-all page). We never count those as a double gap, so the double gap figure is a floor.</figcaption>
            </figure>
            <figure className={s.fig}>
              <StackBar id="c3" title="DMARC policy mix" label={`DMARC policy mix, ${T.mix.bands} bands with the full breakdown`} total={T.mix.live}
                parts={[
                  { name: "No DMARC record", n: T.mix.noRecord, cls: "slate" },
                  { name: "p=none (monitor only)", n: T.mix.pNone, cls: "gold" },
                  { name: "p=quarantine", n: T.mix.quarantine, cls: "goldlo" },
                  { name: "p=reject", n: T.mix.reject, cls: "teal" },
                ]} />
              <figcaption>DMARC policy of the {T.mix.live} domains in the {T.mix.bands} bands where the full breakdown was recorded (bands 1 to 6). The last two bands recorded only the gap count, so they are left out of this chart. Only {pct1(T.mix.reject, T.mix.live)} had the strongest policy, p=reject.</figcaption>
            </figure>
          </section>

          <section className={s.sec} aria-labelledby="table"><h2 id="table">Counts by band</h2>
            <div className={s.tablewrap}>
              <table className={s.table}>
                <caption className={s.tm} style={{ textAlign: "left", padding: "8px 12px" }}>Counts per band. A dash means the breakdown was not recorded for that band.</caption>
                <thead><tr><th>Band</th><th>Rank band</th><th>Run date</th><th>Drawn</th><th>Live</th><th>No record</th><th>p=none</th><th>Quarantine</th><th>Reject</th><th>DMARC gap</th><th>Double gap</th><th>Rate</th></tr></thead>
                <tbody>
                  {BANDS.map((b, i) => (
                    <tr key={b.id}><td>{i + 1}</td><td>{b.rankLow.toLocaleString("en-AU")} to {b.rankHigh.toLocaleString("en-AU")}</td><td>{b.run}</td><td>{b.sampled}</td><td>{b.live}</td><td>{b.noRecord ?? "-"}</td><td>{b.pNone ?? "-"}</td><td>{b.quarantine ?? "-"}</td><td>{b.reject ?? "-"}</td><td>{b.dmarcGap}</td><td>{b.doubleGap}</td><td>{pct1(b.doubleGap, b.live)}</td></tr>
                  ))}
                  <tr><td><strong>All</strong></td><td>200,000 to 1,000,000</td><td>{STUDY_DATE_RUN}</td><td>{T.sampled}</td><td>{T.live}</td><td>-</td><td>-</td><td>-</td><td>-</td><td>{T.dmarcGap}</td><td>{T.doubleGap}</td><td>{dblPct}</td></tr>
                </tbody>
              </table>
            </div>
            <p><a className={s.dl} href={STUDY_CSV} download>Download the aggregates as CSV</a></p>
          </section>

          <section className={s.sec} aria-labelledby="method"><h2 id="method">Method</h2>
            <ol className={s.list} style={{ listStyle: "decimal" }}>
              <li><strong>Seed list.</strong> The Tranco top one million domain ranking, fetched on each run day (9,711,704 bytes, 5,794 .com.au rows every time, so the same underlying list). The popularity rank is a cheap filter for independent small businesses: at ranks 50,000 to 60,000 the .com.au domains were national brands, and at ranks 900,000 to 1,000,000 they were small local shops and trades.</li>
              <li><strong>Bands.</strong> Eight non-overlapping slices of 100,000 ranks, from 1,000,000 down to 200,000.</li>
              <li><strong>Filtering.</strong> A cumulative list of large brands, government bodies, media, banks and hosting companies was removed first. Short terms match whole words only, after a substring bug was found in an early band and fixed.</li>
              <li><strong>Sampling.</strong> About 40 domains per band, spaced evenly through what was left. Domains that proved to be dead, suspended or a duplicate of a business already in the sample were excluded from the denominator. {T.sampled - T.live} of {T.sampled} were excluded.</li>
              <li><strong>DMARC check.</strong> One public DNS TXT lookup of the _dmarc name, run against two independent public resolvers. A control lookup on a domain known to enforce DMARC passed in the batches that recorded one. The two resolvers agreed on nearly every domain, and the one disagreement noted was re-checked and came out as a false alarm. A gap means no record or p=none. Records at p=quarantine or p=reject were not counted as gaps, and the pct tag was not inspected in most bands, so a few of those may enforce less than they appear to.</li>
              <li><strong>security.txt check.</strong> One plain HTTPS GET of /.well-known/security.txt, the path RFC 9116 sets aside for the public to read. Absent means a real not-found answer. Timeouts, security challenges and pages that return a normal page for every address count as unreadable, never as absent.</li>
              <li><strong>What was never done.</strong> No login, no scan of ports, no guessing, no email sent, no domain contacted beyond those two reads.</li>
            </ol>
          </section>

          <section className={s.sec} aria-labelledby="limits"><h2 id="limits">Limits</h2>
            <ul className={s.list}>
              <li>The sample is not random and covers {T.live} domains. It describes the lower popularity end of .com.au, not every Australian business and not .au names that are not .com.au.</li>
              <li>It is a single snapshot taken on {STUDY_DATE_RUN}. Records change, and nothing here is a trend.</li>
              <li>Unreadable security.txt answers are excluded, so the double gap rate is a floor. {T.unknown} domains with a DMARC gap sit in that bucket.</li>
              <li>Band 5 (rate 37.5%) had many sites on one hosted storefront platform that timed out on the security.txt read, which pushed them into the unreadable bucket.</li>
              <li>The per-domain rows are held privately and are not published. The counts on this page are taken from our per-band research reports, and the totals and rates are computed from them by the page code, so the arithmetic can be checked from the CSV.</li>
              <li>An earlier TITANOS article reported a pooled 47.5% (172 of 362). Recomputing from the per-band reports gives {dblPct} ({T.doubleGap} of {T.live}), so use the figures on this page.</li>
            </ul>
          </section>

          <section className={s.sec} aria-labelledby="stat"><h2 id="stat">About the 99.76% figure</h2>
            <p className={s.p}>You may have seen that 99.76% of domains are unguarded. That number is real, but it measures something different from this study. It comes from {survey.publisher}, which scanned {survey.scanned.toLocaleString("en-AU")} gTLD domains and found {survey.withFile.toLocaleString("en-AU")} publishing a security.txt file. That leaves {surveyNoFilePct().toFixed(2)}% without one.</p>
            <ul className={s.list}>
              <li>It is about security.txt only, a file that tells researchers where to report a problem. It says nothing about DMARC or email spoofing.</li>
              <li>Their scan covers gTLD zone files and states that country domains are not included, so .com.au is outside it.</li>
              <li>The underlying 68GB dataset is not published, so we could not recompute it. We quote it as theirs, from <a href={survey.url}>their article</a> of {longDate(survey.published)}.</li>
            </ul>
            <p className={s.p}>That is why this page rests on our own Australian counts instead.</p>
          </section>

          <section className={s.sec} aria-labelledby="mean"><h2 id="mean">What a DMARC gap means for a business</h2>
            <p className={s.p}>DMARC tells receiving mail systems what to do with mail that claims to be from your domain but fails your own checks. Without an enforced policy, a fake invoice that looks like it came from you can still land in a customer&apos;s inbox. Closing the gap is a staged job: start at p=none, read the reports, then move to quarantine and reject. Our <Link href="/email-security/setup">setup guides</Link> walk through it for the common mail providers. To see where your own domain stands, run the free <Link href="/tools/email-spoofing-check">email spoofing check</Link>. It reads public DNS only and touches nothing.</p>
          </section>

          <section className={s.sec} aria-labelledby="faq"><h2 id="faq">Questions</h2>
            <dl className={s.faq}>{FAQ.map((f) => (<div key={f.q}><dt>{f.q}</dt><dd>{f.a}</dd></div>))}</dl>
          </section>

          <section className={s.sec} aria-labelledby="src"><h2 id="src">Sources</h2>
            <ul className={s.sources}>
              <li>TITANOS SpoofGuard sampling run, nine per-band reports, {STUDY_DATE_RUN}. Counts in the <a href={STUDY_CSV}>CSV</a>.</li>
              <li><a href="https://tranco-list.eu/">Tranco list</a>, the research-oriented top sites ranking used for the seed list.</li>
              <li><a href="https://www.rfc-editor.org/rfc/rfc9116">RFC 9116, A File Format to Aid in Security Vulnerability Disclosure</a>.</li>
              <li><a href="https://www.rfc-editor.org/rfc/rfc7489">RFC 7489, DMARC</a>.</li>
              <li><a href={survey.url}>{survey.publisher}: {survey.title}</a>, {longDate(survey.published)}.</li>
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
