"use client";

import { type ReactNode } from "react";
import VaultKeyhole from "./VaultKeyhole";
import { SigilMark } from "./Sigil";

export default function SectionHeading({
  title,
  lead,
  showKeyhole = true,
  sigilIndex = 0,
}: {
  title: ReactNode;
  lead?: ReactNode;
  showKeyhole?: boolean;
  sigilIndex?: number;
}) {
  return (
    <div data-phi-reveal className="pe-sechead">
      <SigilMark index={sigilIndex} />
      <h2>
        {showKeyhole && <VaultKeyhole />}
        {title}
      </h2>
      <div aria-hidden="true" className="pe-sechead__rule" />
      {lead && <p className="pe-sechead__lead">{lead}</p>}
    </div>
  );
}
