import type { Metadata } from "next";
import Link from "next/link";
import { withSeo, SITE } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import PageHero from "@/components/PageHero";
import { breadcrumbs } from "@/lib/jsonld";
import { personGraph, profilePage, KYLE_KNOWS_ABOUT } from "@/lib/entityJsonld";
import { POSTS } from "@/lib/blog";
import "@/components/home-redesign/home-redesign.css";

const baseMetadata: Metadata = {
  title: "Kyle Deligny, founder of Titanos | Author profile",
  description:
    "Kyle Deligny is the founder and sole operator of Titanos in Brisbane: what he builds, what he writes on, how to verify his ABN and every article he has written.",
  openGraph: { type: "profile" },
  robots: { index: true, follow: true },
};

export const metadata: Metadata = withSeo("/authors/kyle-deligny", baseMetadata);

const REVIEWED = "2026-11-28";
const ABR_VERIFY = "https://abr.business.gov.au/ABN/View?id=34318502254";

function fmt(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

const card = { padding: "22px 24px", marginBottom: 16 } as const;
const h2 = { fontSize: "clamp(1.35rem, 2.2vw, 1.8rem)", color: "var(--pe-gold-hi)", margin: "40px 0 14px" } as const;
const p = { margin: "0 0 14px", lineHeight: 1.75, color: "var(--pe-text)" } as const;
const a = { color: "var(--pe-gold-hi)" } as const;

export default function KyleAuthorPage() {
  const posts = [...POSTS].sort((x, y) => y.date.localeCompare(x.date));
  return (
    <>
      <JsonLd data={personGraph()} />
      <JsonLd data={profilePage({ datePublished: "2026-11-28", dateModified: REVIEWED })} />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Kyle Deligny", path: "/authors/kyle-deligny" }])} />
      <PageHero
        badge="AUTHOR"
        title="Kyle Deligny"
        tagline="Founder and sole operator of Titanos, Brisbane"
        sub="I write about email security, the Privacy Act, the Essential Eight and practical AI automation for Australian small business."
      />
      <div className="pe-wrap" style={{ maxWidth: 860, padding: "0 0 80px", position: "relative", zIndex: 2, color: "var(--pe-text)" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: 14, color: "var(--pe-mute)", marginBottom: 20 }}>
          <Link href="/" style={a}>Home</Link> / <Link href="/about" style={a}>About</Link> / <span aria-current="page">Kyle Deligny</span>
        </nav>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start", marginBottom: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kyle.jpg" alt="Kyle Deligny, founder of Titanos, Brisbane" width={180} height={220} style={{ width: 180, height: 220, objectFit: "cover", borderRadius: 10, border: "1px solid var(--pe-line-gold)" }} />
          <div style={{ flex: "1 1 320px" }}>
            <p style={p}>
              I am Kyle Deligny, the founder and only operator of <Link href="/" style={a}>Titanos</Link>, an AI implementation, Privacy Act compliance and email security practice based in Brisbane, Queensland. My business is registered as a sole trader under ABN 34 318 502 254, and you can check that on the Australian Business Register.
            </p>
            <p style={{ ...p, color: "var(--pe-mute)", fontSize: 14 }}>Profile last reviewed {fmt(REVIEWED)}.</p>
          </div>
        </div>

        <h2 style={h2}>What I build</h2>
        <p style={p}>
          Everything I describe on this site, I build and run myself, so I write about it from direct use. The pieces that are live on titanos.tech are:
        </p>
        <ul style={{ ...p, paddingLeft: 22 }}>
          <li style={{ marginBottom: 8 }}>A free external check of a business domain that reads public records only, including its email authentication settings, and that I run only on a domain the owner asks me to look at. <Link href="/scan" style={a}>See the scan</Link> and <Link href="/methodology" style={a}>the exact method</Link>.</li>
          <li style={{ marginBottom: 8 }}>A fixed-price Privacy Act and Essential Eight engagement for small businesses preparing for the changes that start on 10 December 2026. <Link href="/compliance" style={a}>See the compliance pack</Link>.</li>
          <li style={{ marginBottom: 8 }}>Recurring security and compliance monitoring. <Link href="/monitor" style={a}>See the monitor</Link>.</li>
          <li style={{ marginBottom: 8 }}>AI implementation: I find the repetitive task eating a team&apos;s week and build the system that does it, without replacing anyone. <Link href="/ai-delivery" style={a}>See how an engagement works</Link>.</li>
        </ul>

        <h2 style={h2}>How I work</h2>
        <p style={p}>
          I diagnose, plan and scope each job myself. Claude Code, Anthropic&apos;s coding tool, does the keystroke-level build under my direction, and I decide what is allowed to ship and sign it off. I say that openly because a reader should know when AI helped produce a page, and because the person you deal with is accountable for it. If a number on this site is wrong, tell me and I will correct it and note the date.
        </p>
        <p style={p}>
          My writing follows three rules. Every figure carries its method and date. Every legal or technical claim links to a primary source, such as the OAIC, the Australian Cyber Security Centre, legislation.gov.au or the relevant standard. And a modelled number is never presented as revenue or as a client result. Titanos is early in its life, and the <Link href="/about" style={a}>about page</Link> says plainly where things stand.
        </p>

        <h2 style={h2}>What I write about</h2>
        <p style={p}>These are the areas I cover, each with a place to start:</p>
        <ul style={{ ...p, paddingLeft: 22 }}>
          {KYLE_KNOWS_ABOUT.map((k) => (
            <li key={k} style={{ marginBottom: 6 }}>{k}</li>
          ))}
        </ul>
        <p style={p}>
          If you meet an unfamiliar term, the <Link href="/glossary" style={a}>glossary</Link> defines {" "}DMARC, SPF, DKIM, the Essential Eight, the Australian Privacy Principles, the Notifiable Data Breaches scheme and more, each with a primary source.
        </p>

        <h2 style={h2}>How to check who I am</h2>
        <ul style={{ ...p, paddingLeft: 22 }}>
          <li style={{ marginBottom: 8 }}>ABN 34 318 502 254 on the <a href={ABR_VERIFY} rel="noopener noreferrer" style={a}>Australian Business Register</a>.</li>
          <li style={{ marginBottom: 8 }}>My own domain&apos;s scan, published in full on the <Link href="/scan" style={a}>scan page</Link>.</li>
          <li style={{ marginBottom: 8 }}>The full operator profile on the <Link href="/about" style={a}>about page</Link>, including how I handle your data (<Link href="/your-data" style={a}>your data</Link> and <Link href="/privacy" style={a}>privacy policy</Link>).</li>
        </ul>

        <h2 style={h2}>Articles by Kyle ({posts.length})</h2>
        <p style={p}>Newest first. Each article shows its publication date.</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {posts.map((x) => (
            <li key={x.slug} className="pe-card" style={{ ...card, marginBottom: 10 }}>
              <Link href={`/blog/${x.slug}`} style={{ ...a, fontWeight: 600 }}>{x.title}</Link>
              <div style={{ fontSize: 13, color: "var(--pe-mute)", marginTop: 6 }}>{fmt(x.date)} | {x.tag}</div>
            </li>
          ))}
        </ul>

        <h2 style={h2}>Contact</h2>
        <p style={p}>
          The fastest route is email: <a href="mailto:kyle@titanos.tech" style={a}>kyle@titanos.tech</a>. To talk through a specific problem, <Link href="/audit" style={a}>book the free half-hour consultation</Link>. The first step costs nothing and a no is welcome. Canonical profile address: {SITE}/authors/kyle-deligny.
        </p>
      </div>
    </>
  );
}
