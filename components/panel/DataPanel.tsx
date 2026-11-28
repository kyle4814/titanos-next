import type { ReactNode } from "react";
import SectionReveal from "@/components/SectionReveal";
import css from "./DataPanel.module.css";

export function PanelList({ children }: { children: ReactNode }) {
  return <div className={`pe-page pe-page--narrow ${css.list}`}>{children}</div>;
}

export function Panel({ point, children }: { point: string; children: ReactNode }) {
  return (
    <SectionReveal className={`pe-card pe-card--pad ${css.panel}`}>
      <h2 className={css.h}>{point}</h2>
      <div className={css.body}>{children}</div>
    </SectionReveal>
  );
}

export const panelActions = css.actions;
