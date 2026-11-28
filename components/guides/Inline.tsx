import Link from "next/link";
import type { ReactNode } from "react";

/** Renders the guide inline markup: [text](href) links and **bold**. Internal links use next/link, external links get rel noopener. */
export default function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[3] !== undefined) out.push(<strong key={k++}>{m[3]}</strong>);
    else if (m[2].startsWith("/")) out.push(<Link key={k++} href={m[2]}>{m[1]}</Link>);
    else out.push(<a key={k++} href={m[2]} rel="noopener noreferrer">{m[1]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
