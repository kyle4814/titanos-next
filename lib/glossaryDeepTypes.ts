export type GlossaryDeep = {
  /** Short name for titles and headings, so the title stays within 60 characters. */
  name: string;
  /** Explanatory paragraphs (plain text, no markup). */
  body: string[];
  example: { title: string; text: string };
  /** What to do next, in order. */
  steps: string[];
  /** Common mistakes. */
  mistakes?: string[];
  /** Other glossary ids to link as related terms. */
  see: string[];
  /** Internal links (tools, blog, guides). Must be existing routes. */
  links: { label: string; href: string }[];
};
