"use client";

import { MeshGradient } from "@paper-design/shaders-react";

/** The WebGL half. Only ever imported dynamically by HeroMesh after the GPU + interaction gate passes. */
export default function HeroMeshGpu() {
  return (
    <MeshGradient
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      colors={["#05060a", "#14110a", "#d4af37", "#7fa6c4"]}
      distortion={0.9}
      swirl={0.35}
      speed={0.18}
      grainOverlay={0.12}
    />
  );
}
