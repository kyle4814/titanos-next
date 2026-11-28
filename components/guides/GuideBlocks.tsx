import type { Block } from "@/lib/guides";
import Inline from "./Inline";

export default function GuideBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "p": return <p key={i}><Inline text={b.x} /></p>;
          case "h3": return <h3 key={i}>{b.x}</h3>;
          case "ul": return <ul key={i} className="gd-list">{b.x.map((x, j) => <li key={j}><Inline text={x} /></li>)}</ul>;
          case "ol": return <ol key={i} className="gd-list gd-list--ol">{b.x.map((x, j) => <li key={j}><Inline text={x} /></li>)}</ol>;
          case "note": return (
            <aside key={i} className="gd-note"><p className="gd-note__t">{b.title}</p><p><Inline text={b.x} /></p></aside>
          );
          case "example": return (
            <aside key={i} className="gd-example"><p className="gd-note__t">{b.title}</p>{b.x.map((x, j) => <p key={j}><Inline text={x} /></p>)}</aside>
          );
          case "table": return (
            <div key={i} className="gd-tablewrap" role="region" aria-label={b.caption} tabIndex={0}>
              <table className="gd-table">
                <caption>{b.caption}</caption>
                <thead><tr>{b.head.map((h, j) => <th key={j} scope="col">{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => k === 0 ? <th key={k} scope="row"><Inline text={c} /></th> : <td key={k}><Inline text={c} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
      })}
    </>
  );
}
