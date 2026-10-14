import type { ReactNode } from "react";
import W2c from "@/components/w2c/W2c";
import "./w2d.css";

/** Wave 2d scope wrapper: W2c plus long-read and form extras. Server component, no client JS. Presentation only. */
export default function W2d({ children }: { children: ReactNode }) {
  return <W2c>{children}</W2c>;
}
