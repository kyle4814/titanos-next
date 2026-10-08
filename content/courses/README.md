# Courses content format (written courses, AI use disclosed, text only)

Each course lives in content/courses/<slug>/ :
- course.json         metadata, module list, worksheet list, quiz (schema below)
- lessons/<lesson-slug>.mdx       one file per lesson listed in course.json
- worksheets/<worksheet-slug>.mdx one file per worksheet listed in course.json

MDX subset (rendered by lib/courses/mdx.ts, no other syntax is supported):
- `## Heading` and `### Heading`
- paragraphs (blank-line separated; **bold** and *italic* markers are stripped to plain text)
- `- item` bullet lists, `1. item` numbered lists, `- [ ] item` checklist lines
- `> quote` blockquote
- no tables, no images, no HTML, no JSX, no code fences, no links

course.json:
{
  "slug": "...", "title": "...", "tagline": "one sentence",
  "audience": ["who it is for", "..."],
  "offerSlug": "...",              // price comes from lib/offers/offers.json, NEVER write a price in copy
  "outcomes": ["what you can do after", "... (4 to 6)"],
  "modules": [ { "title": "Module 1: ...", "lessons": [ { "slug": "kebab", "title": "...", "outcome": "one line", "minutes": 12 } ] } ],
  "worksheets": [ { "slug": "kebab", "title": "...", "blurb": "one line" } ],
  "quiz": { "passPct": 75, "questions": [ { "q": "...", "options": ["a","b","c","d"], "answer": 0, "why": "one or two sentences" } ] }
}
