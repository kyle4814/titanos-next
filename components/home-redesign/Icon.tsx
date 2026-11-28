import { CodeXml, Layers, Zap, TrendingUp, Cog, Monitor, ChartNoAxesColumn, Brain, CircleCheck, Rocket, Clock, ShieldCheck, Link2, Receipt, FileText, Download, ArrowRight, Play, ExternalLink } from "lucide-react";

const MAP = {
  code: CodeXml, layers: Layers, bolt: Zap, trend: TrendingUp, cog: Cog, monitor: Monitor, chart: ChartNoAxesColumn, brain: Brain,
  check: CircleCheck, rocket: Rocket, clock: Clock, gate: ShieldCheck, link: Link2, receipt: Receipt, doc: FileText, download: Download,
  arrow: ArrowRight, play: Play, external: ExternalLink,
} as const;
export type IconName = keyof typeof MAP;

/** Thin gold line icon, decorative (aria-hidden) unless a label is given. */
export default function Icon({ name, size = 22, stroke = 1.7 }: { name: IconName; size?: number; stroke?: number }) {
  const C = MAP[name];
  return <C size={size} strokeWidth={stroke} aria-hidden="true" focusable="false" />;
}
