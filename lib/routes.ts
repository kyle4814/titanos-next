// Build-time route registry (Node only: reads the app/ directory). Feeds sitemap.xml, llms.txt
// and the SEO tests, so a new page is in the sitemap without anyone remembering to add it.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { SITE } from "@/lib/seo";
import { POSTS } from "@/lib/blog";
import { ALL_OFFERS } from "@/lib/offers";
import { CASES } from "@/lib/caseStudies";
import { PRODUCTS } from "@/lib/products";
import { SECTORS } from "@/lib/site-data";
import { arianceVisible, ariancePath } from "@/lib/case-studies/ariance";
import { titanosPath } from "@/lib/case-studies/titanos";

export type SiteRoute = { path: string; url: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; lastModified?: Date };

const APP = path.join(process.cwd(), "app");

const PRIORITY: Record<string, number> = {
  "/": 1, "/audit": 0.95, "/offers": 0.9, "/compliance": 0.9, "/monitor": 0.9, "/efficiency": 0.9,
  "/engineering": 0.8, "/scan": 0.8, "/tradies": 0.8, "/leads": 0.8, "/ai-delivery": 0.8, "/find": 0.8,
  "/privacy": 0.5, "/terms": 0.5, "/your-data": 0.5,
};
const FREQ: Record<string, SiteRoute["changeFrequency"]> = { "/": "weekly", "/blog": "weekly", "/offers": "weekly", "/compliance": "weekly" };

function lastCommit(rel: string): Date | undefined {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cI", "--", rel], { cwd: process.cwd(), stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    return out ? new Date(out) : undefined;
  } catch {
    return undefined;
  }
}

function walk(dir: string, rel = "", inheritedNoindex = false): { route: string; file: string; noindex: boolean }[] {
  const out: { route: string; file: string; noindex: boolean }[] = [];
  const page = path.join(dir, "page.tsx");
  const texts = [page, path.join(dir, "layout.tsx")].filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8"));
  // a layout's robots metadata covers every page beneath it (the /demo/tix subpages inherit the demo layout's noindex)
  const noindex = inheritedNoindex || texts.some((t) => /index:\s*false/.test(t));
  if (fs.existsSync(page)) out.push({ route: rel || "/", file: path.relative(process.cwd(), page), noindex });
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith("[") && !e.name.startsWith("_") && !e.name.startsWith("(")) out.push(...walk(path.join(dir, e.name), `${rel}/${e.name}`, noindex));
  }
  return out;
}

export function staticRoutes() {
  return walk(APP);
}

export function indexableRoutes(): SiteRoute[] {
  const mk = (p: string, file?: string, extra: Partial<SiteRoute> = {}): SiteRoute => ({
    path: p,
    url: `${SITE}${p === "/" ? "/" : p}`,
    priority: PRIORITY[p] ?? 0.6,
    changeFrequency: FREQ[p] ?? "monthly",
    lastModified: file ? lastCommit(file) : undefined,
    ...extra,
  });
  const out: SiteRoute[] = staticRoutes().filter((r) => !r.noindex).map((r) => mk(r.route, r.file));
  for (const o of ALL_OFFERS) out.push(mk(`/offers/${o.slug}`, "lib/offers", { priority: 0.7 }));
  for (const p of POSTS) out.push(mk(`/blog/${p.slug}`, undefined, { priority: 0.6, lastModified: new Date(p.updated || p.date) }));
  for (const c of CASES) out.push(mk(`/case-studies/${c.slug}`, "lib/caseStudies.ts", { priority: 0.7 }));
  for (const p of PRODUCTS) out.push(mk(`/products/${p.slug}`, "lib/products", { priority: 0.6 }));
  for (const s of SECTORS) out.push(mk(`/sectors/${s.slug}`, "lib/site-data", { priority: 0.6 }));
  out.push(mk(titanosPath, "lib/case-studies", { priority: 0.8 }));
  // Consent-gated: the page file always reads as noindex (its robots is conditional), so it is added only when Kyle flips the switch.
  if (arianceVisible) out.push(mk(ariancePath, "lib/case-studies", { priority: 0.8 }));
  return out.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));
}
