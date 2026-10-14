import type { ReactNode } from "react";
import "./w2c.css";

/** Scope wrapper for wave 2c pages. Server component, no client JS. Presentation only. */
export default function W2c({ children }: { children: ReactNode }) {
  return <div className="w2c">{children}</div>;
}
