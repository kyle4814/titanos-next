import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { withSeo } from "@/lib/seo";
import { PROVIDERS, getProvider, providerPath, DMARC_SETUP_BASE } from "@/lib/dmarcSetup";
import "@/components/home-redesign/home-redesign.css";
import { Byline, Code, Crumbs, Cta, FaqList, FieldTable, Rollout, Schema, Sources, Verify, articleLd, crumbLd, faqPage, howToLd, s } from "../_parts";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROVIDERS.map((p) => ({ provider: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ provider: string }> }): Promise<Metadata> {
  const { provider } = await params;
  const p = getProvider(provider);
  if (!p) return {};
  const path = providerPath(p.slug);
  return withSeo(path, {
    title: p.title,
    description: p.description,
    alternates: { canonical: `https://titanos.tech${path}` },
    openGraph: { title: p.title, description: p.description, type: "article" },
    robots: { index: true, follow: true },
  });
}

export default async function ProviderPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const p = getProvider(provider);
  if (!p) notFound();
  const path = providerPath(p.slug);
  const siblings = p.related.map((slug) => getProvider(slug)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const howSteps = [
    ...p.findDns.steps.map((t) => ({ name: p.findDns.heading, text: t })),
    { name: p.spf.heading, text: `Publish one SPF TXT record: ${p.spf.record}` },
    ...p.dkim.steps.map((t) => ({ name: p.dkim.heading, text: t })),
    { name: p.dmarc.heading, text: `Publish a TXT record named _dmarc with the value: ${p.dmarc.record}` },
    { name: "Roll out the policy", text: "Stay at p=none for about four weeks reading the reports, then move to quarantine in steps, then reject." },
  ];
  return (
    <>
      <Schema
        items={[
          articleLd({ path, headline: p.h1, description: p.description }),
          howToLd({ path, name: p.h1, description: p.description, steps: howSteps }),
          faqPage(p.faq),
          crumbLd([
            { name: "Home", path: "/" },
            { name: "SPF, DKIM and DMARC setup", path: DMARC_SETUP_BASE },
            { name: p.name, path },
          ]),
        ]}
      />
      <main className={s.shell}>
        <div className={s.wrap}>
          <Crumbs trail={[{ name: "Home", path: "/" }, { name: "SPF, DKIM and DMARC setup", path: DMARC_SETUP_BASE }, { name: p.name }]} />
          <p className={s.kicker}>{p.group} guide</p>
          <h1 className={s.h1}>{p.h1}</h1>
          <Byline />
          <p className={s.bluf}>{p.summary}</p>
          {p.intro.map((t) => <p key={t} className={s.p}>{t}</p>)}
          <p className={s.note}><strong>What we checked.</strong> {p.checked}</p>

          <section className={s.sec} aria-labelledby="dns"><h2 id="dns">{p.findDns.heading}</h2>
            <ol className={s.list}>{p.findDns.steps.map((t) => <li key={t}>{t}</li>)}</ol>
          </section>

          <section className={s.sec} aria-labelledby="host"><h2 id="host">{p.hostFormat.heading}</h2>
            {p.hostFormat.body.map((t) => <p key={t} className={s.p}>{t}</p>)}
            <FieldTable rows={p.hostFormat.rows} />
            <p className={s.note}>Replace yourbusiness.com.au with your own domain. The example reporting mailbox is only a placeholder.</p>
          </section>

          <section className={s.sec} aria-labelledby="spf"><h2 id="spf">{p.spf.heading}</h2>
            {p.spf.body.map((t) => <p key={t} className={s.p}>{t}</p>)}
            <Code>{p.spf.record}</Code>
          </section>

          <section className={s.sec} aria-labelledby="dkim"><h2 id="dkim">{p.dkim.heading}</h2>
            {p.dkim.body.map((t) => <p key={t} className={s.p}>{t}</p>)}
            <ol className={s.list}>{p.dkim.steps.map((t) => <li key={t}>{t}</li>)}</ol>
          </section>

          <section className={s.sec} aria-labelledby="dmarc"><h2 id="dmarc">{p.dmarc.heading}</h2>
            {p.dmarc.body.map((t) => <p key={t} className={s.p}>{t}</p>)}
            <Code>{p.dmarc.record}</Code>
          </section>

          <Rollout name={p.name} />

          <Verify note={p.verifyNote} name={p.name} />

          <section className={s.sec} aria-labelledby="gotchas"><h2 id="gotchas">{p.name} gotchas</h2>
            <ul className={s.gotchas}>{p.gotchas.map((g) => <li key={g.t}><strong>{g.t}</strong><span>{g.d}</span></li>)}</ul>
          </section>

          <FaqList items={p.faq} />
          <Sources list={p.sources} />

          <section className={s.sec} aria-labelledby="related"><h2 id="related">Related setup guides</h2>
            <ul className={s.related}>
              <li><Link href={DMARC_SETUP_BASE}>All SPF, DKIM and DMARC setup guides</Link></li>
              {siblings.map((x) => <li key={x.slug}><Link href={providerPath(x.slug)}>{x.h1}</Link></li>)}
            </ul>
          </section>

          <Cta />
        </div>
      </main>
    </>
  );
}
