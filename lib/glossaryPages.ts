/**
 * Glossary term pages: joins the short definitions (lib/glossary.ts) with the long-form content,
 * and derives the title, description and word count the page and its tests share.
 * Free of path-alias imports so scripts can load it directly.
 */
import { GLOSSARY, GLOSSARY_REVIEWED, type GlossaryEntry } from "./glossary.ts";
import { DEEP_EMAIL } from "./glossaryDeepEmail.ts";
import { DEEP_SECURITY } from "./glossaryDeepSecurity.ts";
import { DEEP_PRIVACY } from "./glossaryDeepPrivacy.ts";
import type { GlossaryDeep } from "./glossaryDeepTypes.ts";

export type { GlossaryDeep };
export { GLOSSARY_REVIEWED };

export const DEEP: Record<string, GlossaryDeep> = { ...DEEP_EMAIL, ...DEEP_SECURITY, ...DEEP_PRIVACY };

export type GlossaryPage = { entry: GlossaryEntry; deep: GlossaryDeep; title: string; description: string };

/** "<Name> explained" keeps the full title under 60 characters with the site suffix. */
export function pageTitle(deep: GlossaryDeep): string {
  return `What is ${deep.name.replace(/^(the|an|a) /, "")}? | Titanos`;
}

export function pageDescription(entry: GlossaryEntry, _deep: GlossaryDeep): string {
  const sentences = entry.definition.split(/(?<=[.?!])\s/);
  const tail = " A plain-English guide with an example and next steps.";
  let d = sentences[0];
  if (d.length >= 140 && d.length <= 160) return d;
  if (d.length < 140 && d.length + tail.length >= 140 && d.length + tail.length <= 160) return d + tail;
  for (let i = 1; d.length < 140 && sentences[i]; i++) d += " " + sentences[i];
  if (d.length > 160) {
    const cut = d.slice(0, 157);
    d = cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "") + "...";
  }
  return d;
}

export function buildPages(): GlossaryPage[] {
  return GLOSSARY.filter((e) => DEEP[e.id]).map((entry) => {
    const deep = DEEP[entry.id];
    return { entry, deep, title: pageTitle(deep), description: pageDescription(entry, deep) };
  });
}

export const GLOSSARY_PAGES: GlossaryPage[] = buildPages();

export function getGlossaryPage(id: string): GlossaryPage | undefined {
  return GLOSSARY_PAGES.find((p) => p.entry.id === id);
}

/** Every visible text block of a page, for word counts and style checks. */
export function pageTexts(p: GlossaryPage): string[] {
  const { entry, deep } = p;
  return [entry.term, entry.definition, ...deep.body, deep.example.title, deep.example.text, ...deep.steps, ...(deep.mistakes ?? []), ...deep.links.map((l) => l.label)];
}

export function pageWordCount(p: GlossaryPage): number {
  return pageTexts(p).join(" ").trim().split(/\s+/).length;
}

export function deepWordCount(d: GlossaryDeep): number {
  return [...d.body, d.example.text, ...d.steps, ...(d.mistakes ?? [])].join(" ").trim().split(/\s+/).length;
}
