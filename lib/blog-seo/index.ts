import type { BlogPost, ContentBlock } from "@/lib/blog";
import { DISCLOSURE } from "@/lib/blog-seo/h";
import { POST_RELATED, guide, product, TOOLS } from "@/lib/seo-links";
import { post as missedCall } from "@/lib/blog-seo/missed-call-spam-act";
import { post as quoteFollowUp } from "@/lib/blog-seo/quote-follow-up";
import { post as aiReceptionist } from "@/lib/blog-seo/ai-receptionist-privacy";
import { post as callRecording } from "@/lib/blog-seo/call-recording";
import { post as breachEmail } from "@/lib/blog-seo/breach-email";
import { post as e8Cost } from "@/lib/blog-seo/e8-cost";
import { post as admWording } from "@/lib/blog-seo/adm-wording";
import { post as austender } from "@/lib/blog-seo/austender";

/** SEO push 2026-11-28: eight long-form posts for P1 terms in the SEO audit. */
const RAW: BlogPost[] = [missedCall, quoteFollowUp, aiReceptionist, callRecording, breachEmail, e8Cost, admWording, austender];

/** Closing "keep reading" links: the pillar guide, the shop product and any tool the post does not already link. */
function withRelated(post: BlogPost): BlogPost {
  const rel = POST_RELATED[post.slug];
  if (!rel) return post;
  const g = guide(rel.guide);
  const blocks: ContentBlock[] = [];
  blocks.push({ type: "p-link", before: "Want the whole picture? Read our guide: ", linkText: g.label, href: g.href, after: `. ${g.blurb}` });
  if (rel.product) {
    const pr = product(rel.product);
    blocks.push({ type: "p-link", before: "If you want a ready-made version, the shop has the ", linkText: pr.label, href: pr.href, after: `. ${pr.blurb}` });
  }
  const text = JSON.stringify(post.body);
  const missing = TOOLS.filter((t) => !text.includes(t.href)).slice(0, 2);
  for (const t of missing) blocks.push({ type: "p-link", before: "Free tool: ", linkText: t.label, href: t.href, after: `. ${t.blurb}` });
  // Keep the closing disclosure paragraph last when the post ends with it.
  const last = post.body[post.body.length - 1];
  const endsWithDisclosure = JSON.stringify(last) === JSON.stringify(DISCLOSURE);
  const body = endsWithDisclosure ? [...post.body.slice(0, -1), ...blocks, last] : [...post.body, ...blocks];
  return { ...post, body };
}

export const SEO_POSTS: BlogPost[] = RAW.map(withRelated);
